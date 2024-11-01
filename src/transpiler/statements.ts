import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/typescript-estree'
import {
  AssignStepAST,
  CallStepAST,
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
  PrimitiveExpression,
  VariableName,
  VariableReferenceExpression,
  isExpression,
  isFullyQualifiedName,
  isLiteral,
} from '../ast/expressions.js'
import { InternalTranspilingError, WorkflowSyntaxError } from '../errors.js'
import { isRecord } from '../utils.js'
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
}

export function parseStatement(
  node: TSESTree.Statement,
  ctx: ParsingContext,
  postSteps?: WorkflowStepAST[],
): WorkflowStepAST[] {
  const steps = parseStatementRecursively(node, ctx)
  return transformAST(steps.concat(postSteps ?? []))
}

function parseStatementRecursively(
  node: TSESTree.Statement,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  switch (node.type) {
    case AST_NODE_TYPES.BlockStatement:
      return node.body.flatMap((statement) =>
        parseStatementRecursively(statement, ctx),
      )

    case AST_NODE_TYPES.VariableDeclaration:
      return convertVariableDeclarations(node.declarations, ctx)

    case AST_NODE_TYPES.ExpressionStatement:
      if (node.expression.type === AST_NODE_TYPES.AssignmentExpression) {
        return assignmentExpressionToSteps(node.expression, ctx)
      } else if (node.expression.type === AST_NODE_TYPES.CallExpression) {
        return [callExpressionToStep(node.expression, undefined, ctx)]
      } else {
        return [generalExpressionToAssignStep(node.expression)]
      }

    case AST_NODE_TYPES.ReturnStatement:
      return [returnStatementToReturnStep(node)]

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

    case AST_NODE_TYPES.TryStatement:
      return [tryStatementToTryStep(node, ctx)]

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
  return declarations.map((decl) => {
    if (decl.type !== AST_NODE_TYPES.VariableDeclarator) {
      throw new WorkflowSyntaxError('Not a VariableDeclarator', decl.loc)
    }

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

      return new AssignStepAST([[targetName, value]])
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
    steps.push(callExpressionToStep(node.right, resultVariable, ctx))

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
): WorkflowStepAST {
  const calleeExpression = convertExpression(node.callee)
  if (isFullyQualifiedName(calleeExpression)) {
    const calleeName = calleeExpression.toString()

    if (calleeName === 'parallel') {
      // A custom implementation for "parallel"
      return callExpressionToParallelStep(node, ctx)
    } else if (calleeName === 'retry_policy') {
      return callExpressionToCallStep(
        calleeName,
        node.arguments,
        resultVariable,
      )
    } else if (calleeName === 'call_step') {
      return createCallStep(node.arguments, resultVariable)
    } else if (blockingFunctions.has(calleeName)) {
      const argumentNames = blockingFunctions.get(calleeName) ?? []
      return blockingFunctionCallStep(
        calleeName,
        argumentNames,
        node.arguments,
        resultVariable,
      )
    } else {
      return callExpressionAssignStep(
        calleeName,
        node.arguments,
        resultVariable,
      )
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

function callExpressionToCallStep(
  functionName: string,
  argumentsNode: TSESTree.CallExpressionArgument[],
  resultVariable?: VariableName,
): CallStepAST {
  if (
    argumentsNode.length < 1 ||
    argumentsNode[0].type !== AST_NODE_TYPES.ObjectExpression
  ) {
    throw new WorkflowSyntaxError(
      'Expected one object parameter',
      argumentsNode[0].loc,
    )
  }

  const workflowArguments = convertObjectAsExpressionValues(argumentsNode[0])

  return new CallStepAST(functionName, workflowArguments, resultVariable)
}

function createCallStep(
  argumentsNode: TSESTree.CallExpressionArgument[],
  resultVariable?: VariableName,
): CallStepAST {
  if (argumentsNode.length < 1) {
    throw new WorkflowSyntaxError(
      'The first argument must be a Function',
      argumentsNode[0].loc,
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
): ReturnStepAST {
  const value = node.argument ? convertExpression(node.argument) : undefined
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
  ctx: ParsingContext,
): TryStepAST {
  const steps = parseStatement(node.block, ctx)
  let exceptSteps: WorkflowStepAST[] = []
  let errorVariable: string | undefined = undefined
  if (node.handler) {
    exceptSteps = parseStatement(node.handler.body, ctx)

    const handlerParam = node.handler.param
    if (handlerParam) {
      if (handlerParam.type !== AST_NODE_TYPES.Identifier) {
        throw new WorkflowSyntaxError(
          'The error variable must be an identifier',
          handlerParam.loc,
        )
      }

      errorVariable = handlerParam.name
    }
  }

  if (node.finalizer !== null) {
    // TODO
    throw new WorkflowSyntaxError(
      'finally block not yet supported',
      node.finalizer.loc,
    )
  }

  return new TryStepAST(steps, exceptSteps, undefined, errorVariable)
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
