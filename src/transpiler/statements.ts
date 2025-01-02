import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/typescript-estree'
import {
  AssignStepAST,
  CallStepAST,
  CustomRetryPolicy,
  ForStepAST,
  JumpTargetAST,
  NextStepAST,
  ParallelStepAST,
  RaiseStepAST,
  ReturnStepAST,
  StepName,
  StepsStepAST,
  SwitchConditionAST,
  SwitchStepAST,
  TryStepAST,
  WorkflowParameters,
  WorkflowStepAST,
} from '../ast/steps.js'
import {
  BinaryExpression,
  BinaryOperator,
  Expression,
  FunctionInvocationExpression,
  Primitive,
  PrimitiveExpression,
  VariableName,
  VariableReferenceExpression,
  expressionToLiteralValueOrLiteralExpression,
  isExpression,
  isFullyQualifiedName,
  isLiteral,
} from '../ast/expressions.js'
import {
  InternalTranspilingError,
  SourceCodeLocation,
  WorkflowSyntaxError,
} from '../errors.js'
import { flatMapPair, isRecord } from '../utils.js'
import { transformAST } from './transformations.js'
import {
  convertExpression,
  convertMemberExpression,
  convertObjectExpression,
  convertObjectAsExpressionValues,
  isMagicFunction,
  throwIfSpread,
  isMagicFunctionStatmentOnly,
} from './expressions.js'
import { blockingFunctions } from './generated/functionMetadata.js'

export interface ParsingContext {
  // a jump target for an unlabeled break statement
  breakTarget?: StepName
  // a jump target for an unlabeled continue statement
  continueTarget?: StepName
  // a jump target of a return statement, for delaying a return until a finally block.
  // This also used as a flag to indicate that we are in a try or catch block
  // that has a related finally block.
  finalizerTarget?: StepName
}

const finalizerVariableName = '__fin_exc'
const finNoException = 'no exception'
const finNoExceptionAndReturn = 'no exception and return'

export function parseStatement(
  node: TSESTree.Statement,
  ctx: ParsingContext,
  postSteps?: WorkflowStepAST[],
): WorkflowStepAST[] {
  const steps = parseStatementRecursively(node, undefined, ctx)
  return transformAST(steps.concat(postSteps ?? []))
}

function parseStatementRecursively(
  node: TSESTree.Statement,
  nextNode: TSESTree.Statement | undefined,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  switch (node.type) {
    case AST_NODE_TYPES.BlockStatement:
      return flatMapPair(node.body, (statement, nextStatement) =>
        parseStatementRecursively(statement, nextStatement, ctx),
      )

    case AST_NODE_TYPES.VariableDeclaration:
      return convertVariableDeclarations(node.declarations, ctx)

    case AST_NODE_TYPES.ExpressionStatement:
      if (node.expression.type === AST_NODE_TYPES.AssignmentExpression) {
        return assignmentExpressionToSteps(node.expression, ctx)
      } else if (node.expression.type === AST_NODE_TYPES.CallExpression) {
        return callExpressionToStep(node.expression, undefined, ctx)
      } else {
        return [generalExpressionToAssignStep(node.expression)]
      }

    case AST_NODE_TYPES.ReturnStatement:
      return [returnStatementToReturnStep(node, ctx)]

    case AST_NODE_TYPES.ThrowStatement:
      return [throwStatementToRaiseStep(node)]

    case AST_NODE_TYPES.IfStatement:
      return [ifStatementToSwitchStep(node, ctx)]

    case AST_NODE_TYPES.SwitchStatement:
      return switchStatementToSteps(node, ctx)

    case AST_NODE_TYPES.ForInStatement:
      throw new WorkflowSyntaxError(
        'for...in is not a supported construct. Use for...of.',
        node.loc,
      )

    case AST_NODE_TYPES.ForOfStatement:
      return [forOfStatementToForStep(node, ctx)]

    case AST_NODE_TYPES.DoWhileStatement:
      return doWhileStatementSteps(node, ctx)

    case AST_NODE_TYPES.WhileStatement:
      return whileStatementSteps(node, ctx)

    case AST_NODE_TYPES.BreakStatement:
      return [breakStatementToNextStep(node, ctx)]

    case AST_NODE_TYPES.ContinueStatement:
      return [continueStatementToNextStep(node, ctx)]

    case AST_NODE_TYPES.TryStatement: {
      let retryPolicy: CustomRetryPolicy | string | undefined = undefined
      if (
        nextNode?.type === AST_NODE_TYPES.ExpressionStatement &&
        nextNode.expression.type === AST_NODE_TYPES.CallExpression
      ) {
        retryPolicy = parseRetryPolicy(nextNode.expression)
      }

      return [tryStatementToTryStep(node, retryPolicy, ctx)]
    }

    case AST_NODE_TYPES.LabeledStatement:
      return labeledStep(node, ctx)

    case AST_NODE_TYPES.EmptyStatement:
      return []

    case AST_NODE_TYPES.FunctionDeclaration:
      throw new WorkflowSyntaxError(
        'Functions must be defined at the top level of a source file',
        node.loc,
      )

    case AST_NODE_TYPES.TSInterfaceDeclaration:
    case AST_NODE_TYPES.TSTypeAliasDeclaration:
    case AST_NODE_TYPES.TSDeclareFunction:
      // Ignore "type", "interface" and "declare function"
      return []

    default:
      throw new WorkflowSyntaxError(
        `TODO: encountered unsupported type: ${node.type}`,
        node.loc,
      )
  }
}

function convertVariableDeclarations(
  declarations: TSESTree.LetOrConstOrVarDeclarator[],
  ctx: ParsingContext,
): WorkflowStepAST[] {
  return declarations.flatMap((decl) => {
    if (decl.id.type !== AST_NODE_TYPES.Identifier) {
      throw new WorkflowSyntaxError('Expected Identifier', decl.loc)
    }

    const targetName = decl.id.name

    if (decl.init?.type === AST_NODE_TYPES.CallExpression) {
      const calleeName =
        decl.init.callee.type === AST_NODE_TYPES.Identifier
          ? decl.init.callee.name
          : undefined
      if (calleeName && isMagicFunctionStatmentOnly(calleeName)) {
        throw new WorkflowSyntaxError(
          `"${calleeName}" can't be called as part of an expression`,
          decl.init.callee.loc,
        )
      }

      return callExpressionToStep(decl.init, targetName, ctx)
    } else {
      const value =
        decl.init == null
          ? new PrimitiveExpression(null)
          : convertExpression(decl.init)

      return [new AssignStepAST([[targetName, value]])]
    }
  })
}

function assignmentExpressionToSteps(
  node: TSESTree.AssignmentExpression,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  let compoundOperator: BinaryOperator | undefined = undefined
  switch (node.operator) {
    case '=':
      compoundOperator = undefined
      break

    case '+=':
      compoundOperator = '+'
      break

    case '-=':
      compoundOperator = '-'
      break

    case '*=':
      compoundOperator = '*'
      break

    case '/=':
      compoundOperator = '/'
      break

    case '%=':
      compoundOperator = '%'
      break

    case '&&=':
      compoundOperator = 'and'
      break

    case '||=':
      compoundOperator = 'or'
      break

    default:
      throw new WorkflowSyntaxError(
        `Operator ${node.operator} is not supported in assignment expressions`,
        node.loc,
      )
  }

  const targetExpression = convertExpression(node.left)

  if (!isFullyQualifiedName(targetExpression)) {
    throw new WorkflowSyntaxError(
      'The left-hand side of an assignment must be an identifier or a property access',
      node.loc,
    )
  }

  let valueExpression: Expression
  const steps: WorkflowStepAST[] = []
  const targetName = targetExpression.toString()

  if (
    node.right.type === AST_NODE_TYPES.CallExpression &&
    node.right.callee.type === AST_NODE_TYPES.Identifier &&
    isMagicFunction(node.right.callee.name)
  ) {
    const calleeName = node.right.callee.name
    if (isMagicFunctionStatmentOnly(calleeName)) {
      throw new WorkflowSyntaxError(
        `"${calleeName}" can't be called as part of an expression`,
        node.right.callee.loc,
      )
    }

    const needsTempVariable =
      compoundOperator === undefined ||
      node.left.type !== AST_NODE_TYPES.Identifier
    const resultVariable = needsTempVariable ? '__temp' : targetName
    steps.push(...callExpressionToStep(node.right, resultVariable, ctx))

    if (!needsTempVariable) {
      return steps
    }

    valueExpression = new VariableReferenceExpression('__temp')
  } else {
    valueExpression = convertExpression(node.right)
  }

  if (compoundOperator) {
    valueExpression = new BinaryExpression(
      new VariableReferenceExpression(targetName),
      compoundOperator,
      valueExpression,
    )
  }

  steps.push(new AssignStepAST([[targetName, valueExpression]]))

  return steps
}

function callExpressionToStep(
  node: TSESTree.CallExpression,
  resultVariable: string | undefined,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  const calleeExpression = convertExpression(node.callee)
  if (isFullyQualifiedName(calleeExpression)) {
    const calleeName = calleeExpression.toString()

    if (calleeName === 'parallel') {
      // A custom implementation for "parallel"
      return [callExpressionToParallelStep(node, ctx)]
    } else if (calleeName === 'retry_policy') {
      // retry_policy() is handled by AST_NODE_TYPES.TryStatement and therefore ignored here
      return []
    } else if (calleeName === 'call_step') {
      return [createCallStep(node, node.arguments, resultVariable)]
    } else if (blockingFunctions.has(calleeName)) {
      const argumentNames = blockingFunctions.get(calleeName) ?? []
      return [
        blockingFunctionCallStep(
          calleeName,
          argumentNames,
          node.arguments,
          resultVariable,
        ),
      ]
    } else {
      return [
        callExpressionAssignStep(calleeName, node.arguments, resultVariable),
      ]
    }
  } else {
    throw new WorkflowSyntaxError(
      'Expeced a subworkflow or a standard library function name',
      node.callee.loc,
    )
  }
}

function callExpressionAssignStep(
  functionName: string,
  argumentsNode: TSESTree.CallExpressionArgument[],
  resultVariable?: VariableName,
): AssignStepAST {
  const argumentExpressions =
    throwIfSpread(argumentsNode).map(convertExpression)

  return new AssignStepAST([
    [
      resultVariable ?? '__temp',
      new FunctionInvocationExpression(functionName, argumentExpressions),
    ],
  ])
}

function createCallStep(
  node: TSESTree.CallExpression,
  argumentsNode: TSESTree.CallExpressionArgument[],
  resultVariable?: VariableName,
): CallStepAST {
  if (argumentsNode.length < 1) {
    throw new WorkflowSyntaxError(
      'The first argument must be a Function',
      node.loc,
    )
  }

  let functionName: string
  if (argumentsNode[0].type === AST_NODE_TYPES.Identifier) {
    functionName = argumentsNode[0].name
  } else if (argumentsNode[0].type === AST_NODE_TYPES.MemberExpression) {
    const memberExp = convertMemberExpression(argumentsNode[0])

    if (!isFullyQualifiedName(memberExp)) {
      throw new WorkflowSyntaxError(
        'Function name must be a fully-qualified name',
        argumentsNode[0].loc,
      )
    }

    functionName = memberExp.toString()
  } else {
    throw new WorkflowSyntaxError(
      'Expected an identifier or a member expression',
      argumentsNode[0].loc,
    )
  }

  let args: WorkflowParameters = {}
  if (argumentsNode.length >= 2) {
    if (argumentsNode[1].type !== AST_NODE_TYPES.ObjectExpression) {
      throw new WorkflowSyntaxError(
        'The second argument must be an object',
        argumentsNode[1].loc,
      )
    }

    args = convertObjectAsExpressionValues(argumentsNode[1])
  }

  return new CallStepAST(functionName, args, resultVariable)
}

function blockingFunctionCallStep(
  functionName: string,
  argumentNames: string[],
  argumentsNode: TSESTree.CallExpressionArgument[],
  resultName?: string,
): CallStepAST {
  const argumentExpressions =
    throwIfSpread(argumentsNode).map(convertExpression)
  const args: Record<string, Expression> = Object.fromEntries(
    argumentNames.flatMap((argName, i) => {
      if (i >= argumentExpressions.length) {
        return []
      } else if (
        argumentsNode[i].type === AST_NODE_TYPES.Identifier &&
        argumentsNode[i].name === 'undefined'
      ) {
        return []
      } else {
        return [[argName, argumentExpressions[i]]] as const
      }
    }),
  )

  return new CallStepAST(functionName, args, resultName)
}

function callExpressionToParallelStep(
  node: TSESTree.CallExpression,
  ctx: ParsingContext,
): ParallelStepAST {
  if (
    node.callee.type !== AST_NODE_TYPES.Identifier ||
    node.callee.name !== 'parallel'
  ) {
    throw new InternalTranspilingError(
      `The parameter must be a call to "parallel"`,
    )
  }

  let steps: Record<StepName, StepsStepAST> | ForStepAST = {}
  if (node.arguments.length > 0) {
    switch (node.arguments[0].type) {
      case AST_NODE_TYPES.ArrayExpression:
        steps = parseParallelBranches(node.arguments[0])
        break

      case AST_NODE_TYPES.ArrowFunctionExpression:
        steps = parseParallelIteration(node.arguments[0], ctx)
        break

      default:
        throw new WorkflowSyntaxError(
          'The first parameter must be an array of functions or an arrow function',
          node.arguments[0].loc,
        )
    }
  }

  let shared: string[] | undefined = undefined
  let concurrencyLimit: number | undefined = undefined
  let exceptionPolicy: string | undefined = undefined
  if (node.arguments.length > 1) {
    const options = parseParallelOptions(node.arguments[1])
    shared = options.shared
    concurrencyLimit = options.concurrencyLimit
    exceptionPolicy = options.exceptionPolicy
  }

  return new ParallelStepAST(steps, shared, concurrencyLimit, exceptionPolicy)
}

function parseParallelBranches(
  node: TSESTree.ArrayExpression,
): Record<StepName, StepsStepAST> {
  const stepsArray: [string, StepsStepAST][] = node.elements.map((arg, idx) => {
    const branchName = `branch${idx + 1}`

    if (arg === null) {
      throw new WorkflowSyntaxError(
        'Argument should be a function call of type () => void',
        node.loc,
      )
    }

    switch (arg.type) {
      case AST_NODE_TYPES.Identifier:
        return [branchName, new StepsStepAST([new CallStepAST(arg.name)])]

      case AST_NODE_TYPES.ArrowFunctionExpression:
        if (arg.body.type !== AST_NODE_TYPES.BlockStatement) {
          throw new WorkflowSyntaxError(
            'The body must be a block statement',
            arg.body.loc,
          )
        }
        return [branchName, new StepsStepAST(parseStatement(arg.body, {}))]

      default:
        throw new WorkflowSyntaxError(
          'Argument should be a function call of type () => void',
          arg.loc,
        )
    }
  })

  return Object.fromEntries(stepsArray)
}

function parseParallelIteration(
  node: TSESTree.ArrowFunctionExpression,
  ctx: ParsingContext,
): ForStepAST {
  if (
    node.body.type !== AST_NODE_TYPES.BlockStatement ||
    node.body.body.length !== 1 ||
    node.body.body[0].type !== AST_NODE_TYPES.ForOfStatement
  ) {
    throw new WorkflowSyntaxError(
      'The parallel function body must be a single for...of statement',
      node.body.loc,
    )
  }

  return forOfStatementToForStep(node.body.body[0], ctx)
}

function parseParallelOptions(node: TSESTree.CallExpressionArgument) {
  if (node.type !== AST_NODE_TYPES.ObjectExpression) {
    throw new WorkflowSyntaxError(
      'The second parameter must be an object',
      node.loc,
    )
  }

  const parallelOptions = convertObjectExpression(node)
  const sharedExpression = parallelOptions.shared
  if (!Array.isArray(sharedExpression)) {
    throw new WorkflowSyntaxError(
      '"shared" must be an array or strings',
      node.loc,
    )
  }

  const shared = sharedExpression.map((x) => {
    if (isExpression(x) || typeof x !== 'string') {
      throw new WorkflowSyntaxError(
        '"shared" must be an array of strings',
        node.loc,
      )
    }

    return x
  })

  const concurrencyLimitExpression = parallelOptions.concurrency_limit
  if (
    typeof concurrencyLimitExpression !== 'number' &&
    typeof concurrencyLimitExpression !== 'undefined'
  ) {
    throw new WorkflowSyntaxError(
      '"concurrency_limit" must be a number',
      node.loc,
    )
  }

  const concurrencyLimit = concurrencyLimitExpression

  const exceptionPolicyExpression = parallelOptions.exception_policy
  if (
    typeof exceptionPolicyExpression !== 'string' &&
    typeof exceptionPolicyExpression !== 'undefined'
  ) {
    throw new WorkflowSyntaxError(
      '"exception_policy" must be a string',
      node.loc,
    )
  }

  const exceptionPolicy = exceptionPolicyExpression

  return {
    shared,
    concurrencyLimit,
    exceptionPolicy,
  }
}

function generalExpressionToAssignStep(
  node: TSESTree.Expression,
): AssignStepAST {
  return new AssignStepAST([['__temp', convertExpression(node)]])
}

function returnStatementToReturnStep(
  node: TSESTree.ReturnStatement,
  ctx: ParsingContext,
): ReturnStepAST | AssignStepAST {
  const value = node.argument ? convertExpression(node.argument) : undefined

  if (ctx.finalizerTarget) {
    // If we are in try statement with a finally block, return statements are
    // replaced by a jump to finally back with a captured return value.
    return jumpToFinalizerWithDelayedReturn(ctx.finalizerTarget, value)
  }

  return new ReturnStepAST(value)
}

function throwStatementToRaiseStep(
  node: TSESTree.ThrowStatement,
): RaiseStepAST {
  return new RaiseStepAST(convertExpression(node.argument))
}

function ifStatementToSwitchStep(
  node: TSESTree.IfStatement,
  ctx: ParsingContext,
): SwitchStepAST {
  return new SwitchStepAST(flattenIfBranches(node, ctx))
}

function flattenIfBranches(
  ifStatement: TSESTree.IfStatement,
  ctx: ParsingContext,
): SwitchConditionAST<WorkflowStepAST>[] {
  const branches = [
    {
      condition: convertExpression(ifStatement.test),
      steps: parseStatement(ifStatement.consequent, ctx),
    },
  ]

  if (ifStatement.alternate) {
    if (ifStatement.alternate.type === AST_NODE_TYPES.IfStatement) {
      branches.push(...flattenIfBranches(ifStatement.alternate, ctx))
    } else {
      branches.push({
        condition: new PrimitiveExpression(true),
        steps: parseStatement(ifStatement.alternate, ctx),
      })
    }
  }

  return branches
}

function switchStatementToSteps(
  node: TSESTree.SwitchStatement,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  const endOfSwitch = new JumpTargetAST()
  const switchCtx = Object.assign({}, ctx, { breakTarget: endOfSwitch.label })

  const steps: WorkflowStepAST[] = []
  const branches: SwitchConditionAST<WorkflowStepAST>[] = []
  const discriminant = convertExpression(node.discriminant)

  node.cases.forEach((caseNode) => {
    let condition: Expression
    if (caseNode.test) {
      const test = convertExpression(caseNode.test)
      condition = new BinaryExpression(discriminant, '==', test)
    } else {
      condition = new PrimitiveExpression(true)
    }

    const jumpTarget = new JumpTargetAST()
    const body = transformAST(
      caseNode.consequent.flatMap((x) => parseStatement(x, switchCtx)),
    )

    steps.push(jumpTarget)
    steps.push(...body)

    branches.push({
      condition,
      steps: [],
      next: jumpTarget.label,
    })
  })

  steps.unshift(new SwitchStepAST(branches))
  steps.push(endOfSwitch)

  return steps
}

function forOfStatementToForStep(
  node: TSESTree.ForOfStatement,
  ctx: ParsingContext,
): ForStepAST {
  const bodyCtx = Object.assign({}, ctx, {
    continueTarget: undefined,
    breakTarget: undefined,
  })
  const steps = parseStatement(node.body, bodyCtx)

  let loopVariableName: string
  if (node.left.type === AST_NODE_TYPES.Identifier) {
    loopVariableName = node.left.name
  } else if (node.left.type === AST_NODE_TYPES.VariableDeclaration) {
    if (node.left.declarations.length !== 1) {
      throw new WorkflowSyntaxError(
        'Only one variable can be declared here',
        node.left.loc,
      )
    }

    const declaration = node.left.declarations[0]
    if (declaration.init !== null) {
      throw new WorkflowSyntaxError(
        'Initial value not allowed',
        declaration.init.loc,
      )
    }

    if (declaration.id.type !== AST_NODE_TYPES.Identifier) {
      throw new WorkflowSyntaxError(
        `Expected identifier, got ${declaration.id.type}`,
        declaration.id.loc,
      )
    }

    loopVariableName = declaration.id.name
  } else {
    throw new InternalTranspilingError(
      `Expected Identifier or VariableDeclaration, got ${node.left.type}`,
    )
  }

  const listExpression = convertExpression(node.right)

  if (
    isLiteral(listExpression) &&
    listExpression.expressionType === 'primitive' &&
    (isRecord(listExpression.value) ||
      typeof listExpression.value === 'number' ||
      typeof listExpression.value === 'string' ||
      typeof listExpression.value === 'boolean' ||
      listExpression.value === null)
  ) {
    throw new WorkflowSyntaxError('Must be a list expression', node.right.loc)
  }

  return new ForStepAST(steps, loopVariableName, listExpression)
}

function whileStatementSteps(
  node: TSESTree.WhileStatement,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  const startOfLoop = new JumpTargetAST()
  const endOfLoop = new JumpTargetAST()
  const ctx2 = Object.assign({}, ctx, {
    continueTarget: startOfLoop.label,
    breakTarget: endOfLoop.label,
  })
  const postSteps = [new NextStepAST(startOfLoop.label)]
  const steps = parseStatement(node.body, ctx2, postSteps)

  return [
    startOfLoop,
    new SwitchStepAST([
      {
        condition: convertExpression(node.test),
        steps,
      },
    ]),
    endOfLoop,
  ]
}

function doWhileStatementSteps(
  node: TSESTree.DoWhileStatement,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  const startOfLoop = new JumpTargetAST()
  const endOfLoop = new JumpTargetAST()
  const ctx2 = Object.assign({}, ctx, {
    continueTarget: startOfLoop.label,
    breakTarget: endOfLoop.label,
  })

  const steps: WorkflowStepAST[] = [startOfLoop]
  steps.push(...parseStatement(node.body, ctx2))
  steps.push(
    new SwitchStepAST([
      {
        condition: convertExpression(node.test),
        steps: [],
        next: startOfLoop.label,
      },
    ]),
  )
  steps.push(endOfLoop)

  return steps
}

function breakStatementToNextStep(
  node: TSESTree.BreakStatement,
  ctx: ParsingContext,
): NextStepAST {
  if (ctx.finalizerTarget) {
    // TODO: would need to detect if this breaks out of the try or catch block,
    // execute the finally block first and then do the break.
    throw new WorkflowSyntaxError(
      'break is not supported inside a try-finally block',
      node.loc,
    )
  }

  let target: StepName
  if (node.label) {
    target = node.label.name
  } else if (ctx.breakTarget) {
    target = ctx.breakTarget
  } else {
    target = 'break'
  }

  return new NextStepAST(target)
}

function continueStatementToNextStep(
  node: TSESTree.ContinueStatement,
  ctx: ParsingContext,
): NextStepAST {
  if (ctx.finalizerTarget) {
    // TODO: would need to detect if continue breaks out of the try or catch block,
    // execute the finally block first and then do the continue.
    throw new WorkflowSyntaxError(
      'continue is not supported inside a try-finally block',
      node.loc,
    )
  }

  let target: StepName
  if (node.label) {
    target = node.label.name
  } else if (ctx.continueTarget) {
    target = ctx.continueTarget
  } else {
    target = 'continue'
  }

  return new NextStepAST(target)
}

function tryStatementToTryStep(
  node: TSESTree.TryStatement,
  retryPolicy: string | CustomRetryPolicy | undefined,
  ctx: ParsingContext,
): TryStepAST {
  const startOfFinalizer = new JumpTargetAST()
  if (node.finalizer) {
    ctx = Object.assign({}, ctx, { finalizerTarget: startOfFinalizer.label })
  }

  const trySteps = parseStatement(node.block, ctx)

  let exceptSteps: WorkflowStepAST[] | undefined = undefined
  let errorVariable: string | undefined = undefined
  if (node.handler) {
    exceptSteps = parseStatement(node.handler.body, ctx)
    errorVariable = extractErrorVariableName(node.handler.param)
  }

  const baseTryStep = new TryStepAST(
    trySteps,
    exceptSteps,
    retryPolicy,
    errorVariable,
  )

  if (!node.finalizer) {
    return baseTryStep
  } else {
    // Try-finally is translated to two nested try blocks. The innermost try is
    // the actual try body with control flow statements (return, in the future
    //  also break/continue) replaced by jumps to the outer catch block.
    //
    // The outer try's catch block is the finally block. The outer catch runs
    // the original finally block and re-throws an exception or returns a
    // delayed value returned by the try block.
    const innerTry = [
      baseTryStep,
      jumpToFinalizerWithDelayedReturn(startOfFinalizer.label),
    ]

    delete ctx.finalizerTarget // Reset ctx before parsing the finally block

    const finalizerBlock = [
      startOfFinalizer,
      ...parseStatement(node.finalizer, ctx),
      finalizerFooter(finalizerVariableName),
    ]

    return new TryStepAST(
      innerTry,
      finalizerBlock,
      undefined,
      finalizerVariableName,
    )
  }
}

function extractErrorVariableName(
  param: TSESTree.BindingName | null,
): string | undefined {
  if (!param) {
    return undefined
  }

  if (param.type !== AST_NODE_TYPES.Identifier) {
    throw new WorkflowSyntaxError(
      'The error variable must be an identifier',
      param.loc,
    )
  }

  return param.name
}

/**
 * The common footer of a finalizer block that re-throws the exception or
 * returns the value returned by the try body.
 *
 * The footer code in TypeScript:
 *
 * if (__fin_exc.t2w_finally_tag === "no exception and return") {
 *   return __fin_exc.value
 * } else if (__fin_exc.t2w_finally_tag !== "no exception") {
 *   throw __fin_exc
 * }
 */
function finalizerFooter(finalizerVariable: string) {
  return new SwitchStepAST([
    {
      condition: new BinaryExpression(
        new FunctionInvocationExpression('map.get', [
          new VariableReferenceExpression(finalizerVariable),
          new PrimitiveExpression('t2w_finally_tag'),
        ]),
        '==',
        new PrimitiveExpression(finNoExceptionAndReturn),
      ),
      steps: [
        new ReturnStepAST(
          new FunctionInvocationExpression('map.get', [
            new VariableReferenceExpression(finalizerVariable),
            new PrimitiveExpression('value'),
          ]),
        ),
      ],
    },
    {
      condition: new BinaryExpression(
        new FunctionInvocationExpression('map.get', [
          new VariableReferenceExpression(finalizerVariable),
          new PrimitiveExpression('t2w_finally_tag'),
        ]),
        '!=',
        new PrimitiveExpression(finNoException),
      ),
      steps: [
        new RaiseStepAST(new VariableReferenceExpression(finalizerVariable)),
      ],
    },
  ])
}

function jumpToFinalizerWithDelayedReturn(
  finalizerTarget: string,
  value?: Expression,
): AssignStepAST {
  let val
  if (value) {
    val = {
      t2w_finally_tag: finNoExceptionAndReturn,
      value: value,
    }
  } else {
    val = { t2w_finally_tag: finNoException }
  }

  return new AssignStepAST(
    [[finalizerVariableName, new PrimitiveExpression(val)]],
    finalizerTarget,
  )
}

function labeledStep(
  node: TSESTree.LabeledStatement,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  const steps = parseStatement(node.body, ctx)
  if (steps.length > 0 && steps[0].tag !== 'jumptarget') {
    steps[0] = steps[0].withLabel(node.label.name)
  }

  return steps
}

function parseRetryPolicy(
  node: TSESTree.CallExpression,
): CustomRetryPolicy | string | undefined {
  const callee = node.callee
  if (
    callee.type !== AST_NODE_TYPES.Identifier ||
    callee.name !== 'retry_policy'
  ) {
    // Ignore everything else besides retry_policy()
    return undefined
  }

  let retryPolicy: string | CustomRetryPolicy | undefined = undefined
  const argumentsNode = node.arguments
  const argsLoc = argumentsNode[0].loc
  if (
    argumentsNode.length < 1 ||
    argumentsNode[0].type !== AST_NODE_TYPES.ObjectExpression
  ) {
    throw new WorkflowSyntaxError('Expected one object parameter', argsLoc)
  }

  const workflowArguments = convertObjectAsExpressionValues(argumentsNode[0])

  if ('policy' in workflowArguments) {
    const policyEx = workflowArguments.policy

    if (isFullyQualifiedName(policyEx)) {
      retryPolicy = policyEx.toString()
    } else {
      throw new WorkflowSyntaxError('"policy" must be a function name', argsLoc)
    }
  }

  if (!retryPolicy) {
    if (
      'predicate' in workflowArguments &&
      'max_retries' in workflowArguments &&
      'backoff' in workflowArguments
    ) {
      let predicate = ''
      const predicateEx = workflowArguments.predicate

      if (isFullyQualifiedName(predicateEx)) {
        predicate = predicateEx.toString()
      } else {
        throw new WorkflowSyntaxError(
          '"predicate" must be a function name',
          argsLoc,
        )
      }

      const maxRetries = parseRetryPolicyNumber(
        workflowArguments,
        'max_retries',
        argsLoc,
      )

      let initialDelay = 1
      let maxDelay = 1
      let multiplier = 1

      const backoffEx = workflowArguments.backoff

      if (isLiteral(backoffEx) && backoffEx.expressionType === 'primitive') {
        const backoffLit = backoffEx.value

        if (isRecord(backoffLit)) {
          initialDelay = parseRetryPolicyNumber(
            backoffLit,
            'initial_delay',
            argsLoc,
          )
          maxDelay = parseRetryPolicyNumber(backoffLit, 'max_delay', argsLoc)
          multiplier = parseRetryPolicyNumber(backoffLit, 'multiplier', argsLoc)
        }
      }

      retryPolicy = {
        predicate,
        maxRetries,
        backoff: {
          initialDelay,
          maxDelay,
          multiplier,
        },
      }
    } else {
      throw new WorkflowSyntaxError(
        'Some required retry policy parameters are missing',
        argsLoc,
      )
    }
  }

  return retryPolicy
}

function parseRetryPolicyNumber(
  record: Record<string, Expression | Primitive | undefined>,
  keyName: string,
  loc: SourceCodeLocation,
): number {
  const primitiveOrExpression = record[keyName]

  if (!primitiveOrExpression) {
    throw new WorkflowSyntaxError(`"${keyName}" expected`, loc)
  }

  let primitiveValue
  if (isExpression(primitiveOrExpression)) {
    primitiveValue = expressionToLiteralValueOrLiteralExpression(
      primitiveOrExpression,
    )
  } else {
    primitiveValue = primitiveOrExpression
  }

  if (typeof primitiveValue !== 'number') {
    throw new WorkflowSyntaxError(`"${keyName}" must be a number`, loc)
  }

  return primitiveValue
}
