/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { AST_NODE_TYPES } from '@typescript-eslint/utils'
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
  stepWithLabel,
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
import { assertType } from './asserts.js'
import {
  convertExpression,
  convertMemberExpression,
  convertObjectExpression,
  convertObjectAsExpressionValues,
} from './expressions.js'
import { blockingFunctions } from './generated/functionMetadata.js'

const {
  ArrayExpression,
  ArrowFunctionExpression,
  AssignmentExpression,
  BlockStatement,
  BreakStatement,
  CallExpression,
  ContinueStatement,
  DoWhileStatement,
  EmptyStatement,
  ExpressionStatement,
  ForInStatement,
  ForOfStatement,
  FunctionDeclaration,
  Identifier,
  IfStatement,
  LabeledStatement,
  MemberExpression,
  ObjectExpression,
  ReturnStatement,
  SwitchCase,
  SwitchStatement,
  ThrowStatement,
  TryStatement,
  TSDeclareFunction,
  TSTypeAliasDeclaration,
  TSInterfaceDeclaration,
  VariableDeclaration,
  VariableDeclarator,
  WhileStatement,
} = AST_NODE_TYPES

export interface ParsingContext {
  // a jump target for an unlabeled break statement
  breakTarget?: StepName
  // a jump target for an unlabeled continue statement
  continueTarget?: StepName
}

export function parseBlockStatement(
  node: any,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  assertType(node, BlockStatement)

  const body = node.body as any[]
  return transformAST(body.flatMap((x) => parseStep(x, ctx)))
}

function parseStep(node: any, ctx: ParsingContext): WorkflowStepAST[] {
  switch (node.type) {
    case VariableDeclaration:
      return convertVariableDeclarations(node.declarations)

    case ExpressionStatement:
      if (node.expression.type === AssignmentExpression) {
        return assignmentExpressionToSteps(node.expression)
      } else if (node.expression.type === CallExpression) {
        return [callExpressionToStep(node.expression, ctx)]
      } else {
        return [generalExpressionToAssignStep(node.expression)]
      }

    case ReturnStatement:
      return [returnStatementToReturnStep(node)]

    case ThrowStatement:
      return [throwStatementToRaiseStep(node)]

    case IfStatement:
      return [ifStatementToSwitchStep(node, ctx)]

    case SwitchStatement:
      return switchStatementToSteps(node, ctx)

    case ForInStatement:
      throw new WorkflowSyntaxError(
        'for...in is not a supported construct. Use for...of.',
        node.loc,
      )

    case ForOfStatement:
      return [forOfStatementToForStep(node, ctx)]

    case DoWhileStatement:
      return doWhileStatementSteps(node, ctx)

    case WhileStatement:
      return whileStatementSteps(node, ctx)

    case BreakStatement:
      return [breakStatementToNextStep(node, ctx)]

    case ContinueStatement:
      return [continueStatementToNextStep(node, ctx)]

    case TryStatement:
      return [tryStatementToTryStep(node, ctx)]

    case LabeledStatement:
      return labeledStep(node, ctx)

    case EmptyStatement:
      return []

    case FunctionDeclaration:
      throw new WorkflowSyntaxError(
        'Functions must be defined at the top level of a source file',
        node.loc,
      )

    case TSInterfaceDeclaration:
    case TSTypeAliasDeclaration:
    case TSDeclareFunction:
      // Ignore "type", "interface" and "declare function"
      return []

    default:
      throw new WorkflowSyntaxError(
        `TODO: encountered unsupported type: ${node.type}`,
        node.loc,
      )
  }
}

function convertVariableDeclarations(declarations: any[]): WorkflowStepAST[] {
  return declarations.map((decl: any) => {
    if (decl.type !== VariableDeclarator) {
      throw new WorkflowSyntaxError('Not a VariableDeclarator', decl.loc)
    }

    if (decl.id.type !== Identifier) {
      throw new WorkflowSyntaxError('Expected Identifier', decl.loc)
    }

    const targetName = decl.id.name as string

    if (!decl.init) {
      return new AssignStepAST([[targetName, new PrimitiveExpression(null)]])
    } else if (decl.init.type === CallExpression) {
      const maybeBlockingcall = getBlockingCallParameters(decl.init)

      if (maybeBlockingcall.isBlockingCall) {
        // This branch could be removed. The transform step for extracting
        // blocking function would take care of this, but it creates an
        // unnecessary temporary variable assignment step.
        return blockingFunctionCallStep(
          maybeBlockingcall.functionName,
          maybeBlockingcall.argumentNames,
          decl.init.arguments,
          targetName,
        )
      } else if (
        decl.init.callee.type === Identifier &&
        decl.init.callee.name === 'call_step'
      ) {
        return createCallStep(decl.init.arguments, targetName)
      } else {
        return new AssignStepAST([[targetName, convertExpression(decl.init)]])
      }
    } else {
      return new AssignStepAST([[targetName, convertExpression(decl.init)]])
    }
  })
}

function assignmentExpressionToSteps(node: any): WorkflowStepAST[] {
  assertType(node, AssignmentExpression)

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

  const targetName = targetExpression.toString()
  let valueExpression: Expression = convertExpression(node.right)

  if (compoundOperator) {
    valueExpression = new BinaryExpression(
      new VariableReferenceExpression(targetName),
      compoundOperator,
      valueExpression,
    )
  }

  return [new AssignStepAST([[targetName, valueExpression]])]
}

function getBlockingCallParameters(
  node: any,
):
  | { isBlockingCall: false }
  | { isBlockingCall: true; functionName: string; argumentNames: string[] } {
  if (node?.type === CallExpression) {
    const functionName = convertExpression(node.callee).toString()
    const argumentNames = blockingFunctions.get(functionName)
    if (argumentNames) {
      return { isBlockingCall: true, functionName, argumentNames }
    }
  }

  return { isBlockingCall: false }
}

function callExpressionToStep(node: any, ctx: ParsingContext): WorkflowStepAST {
  assertType(node, CallExpression)

  const calleeExpression = convertExpression(node.callee)
  if (isFullyQualifiedName(calleeExpression)) {
    const calleeName = calleeExpression.toString()

    if (calleeName === 'parallel') {
      // A custom implementation for "parallel"
      return callExpressionToParallelStep(node, ctx)
    } else if (calleeName === 'retry_policy') {
      return callExpressionToCallStep(calleeName, node.arguments)
    } else if (calleeName === 'call_step') {
      return createCallStep(node.arguments)
    } else if (blockingFunctions.has(calleeName)) {
      const argumentNames = blockingFunctions.get(calleeName) ?? []
      return blockingFunctionCallStep(calleeName, argumentNames, node.arguments)
    } else {
      return callExpressionAssignStep(calleeName, node.arguments)
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
  argumentsNode: any[],
): AssignStepAST {
  const argumentExpressions: Expression[] = argumentsNode.map(convertExpression)

  return new AssignStepAST([
    [
      '__temp',
      new FunctionInvocationExpression(functionName, argumentExpressions),
    ],
  ])
}

function callExpressionToCallStep(
  functionName: string,
  argumentsNode: any[],
): CallStepAST {
  if (argumentsNode.length < 1 || argumentsNode[0].type !== ObjectExpression) {
    throw new WorkflowSyntaxError(
      'Expected one object parameter',
      argumentsNode[0].loc,
    )
  }

  const workflowArguments = convertObjectAsExpressionValues(argumentsNode[0])

  return new CallStepAST(functionName, workflowArguments)
}

function createCallStep(
  argumentsNode: any[],
  resultVariable?: VariableName,
): CallStepAST {
  if (argumentsNode.length < 1) {
    throw new WorkflowSyntaxError(
      'The first argument must be a Function',
      argumentsNode[0].loc,
    )
  }

  let functionName: string
  if (argumentsNode[0].type === Identifier) {
    functionName = argumentsNode[0].name as string
  } else if (argumentsNode[0].type === MemberExpression) {
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
    if (argumentsNode[1].type !== ObjectExpression) {
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
  argumentsNode: any[],
  resultName?: string,
): CallStepAST {
  const argumentExpressions = argumentsNode.map(convertExpression)
  const args: Record<string, Expression> = Object.fromEntries(
    argumentNames.flatMap((argName, i) => {
      if (i >= argumentExpressions.length) {
        return []
      } else if (
        argumentsNode[i].type === Identifier &&
        argumentsNode[i].name === 'undefined'
      ) {
        return []
      } else {
        return [[argName, argumentExpressions[i]]] as [[string, Expression]]
      }
    }),
  )

  return new CallStepAST(functionName, args, resultName)
}

function callExpressionToParallelStep(
  node: any,
  ctx: ParsingContext,
): ParallelStepAST {
  assertType(node, CallExpression)
  assertType(node.callee, Identifier)
  if (node.callee.name !== 'parallel') {
    throw new TypeError(`The parameter must be a call to "parallel"`)
  }

  let steps: Record<StepName, StepsStepAST> | ForStepAST = {}
  if (node.arguments.length > 0) {
    switch (node.arguments[0].type) {
      case ArrayExpression:
        steps = parseParallelBranches(node.arguments[0])
        break

      case ArrowFunctionExpression:
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

function parseParallelBranches(node: any): Record<StepName, StepsStepAST> {
  assertType(node, ArrayExpression)

  const nodeElements = node.elements as any[]
  const stepsArray: [string, StepsStepAST][] = nodeElements.map(
    (arg: any, idx: number) => {
      const branchName = `branch${idx + 1}`

      switch (arg.type) {
        case Identifier:
          return [branchName, new StepsStepAST([new CallStepAST(arg.name)])]

        case ArrowFunctionExpression:
          return [
            branchName,
            new StepsStepAST(parseBlockStatement(arg.body, {})),
          ]

        default:
          throw new WorkflowSyntaxError(
            'Argument should be a function call of type () => void',
            arg.loc,
          )
      }
    },
  )

  return Object.fromEntries(stepsArray)
}

function parseParallelIteration(node: any, ctx: ParsingContext): ForStepAST {
  assertType(node, ArrowFunctionExpression)

  if (
    node.body.body.length !== 1 ||
    node.body.body[0].type !== ForOfStatement
  ) {
    throw new WorkflowSyntaxError(
      'The parallel function body must be a single for...of statement',
      node.body.loc,
    )
  }

  return forOfStatementToForStep(node.body.body[0], ctx)
}

function parseParallelOptions(node: any) {
  if (node.type !== ObjectExpression) {
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

function generalExpressionToAssignStep(node: any): AssignStepAST {
  return new AssignStepAST([['__temp', convertExpression(node)]])
}

function returnStatementToReturnStep(node: any): ReturnStepAST {
  assertType(node, ReturnStatement)

  const value = node.argument ? convertExpression(node.argument) : undefined
  return new ReturnStepAST(value)
}

function throwStatementToRaiseStep(node: any): RaiseStepAST {
  assertType(node, ThrowStatement)

  return new RaiseStepAST(convertExpression(node.argument))
}

function ifStatementToSwitchStep(
  node: any,
  ctx: ParsingContext,
): SwitchStepAST {
  assertType(node, IfStatement)

  return new SwitchStepAST(flattenIfBranches(node, ctx))
}

function flattenIfBranches(
  ifStatement: any,
  ctx: ParsingContext,
): SwitchConditionAST<WorkflowStepAST>[] {
  assertType(ifStatement, IfStatement)
  assertType(ifStatement.consequent, BlockStatement)

  const branches = [
    {
      condition: convertExpression(ifStatement.test),
      steps: parseBlockStatement(ifStatement.consequent, ctx),
    },
  ]

  if (ifStatement.alternate) {
    if (ifStatement.alternate.type === BlockStatement) {
      branches.push({
        condition: new PrimitiveExpression(true),
        steps: parseBlockStatement(ifStatement.alternate, ctx),
      })
    } else if (ifStatement.alternate.type === IfStatement) {
      branches.push(...flattenIfBranches(ifStatement.alternate, ctx))
    } else {
      throw new InternalTranspilingError(
        `Expected BlockStatement or IfStatement, got ${ifStatement.alternate.type}`,
      )
    }
  }

  return branches
}

function switchStatementToSteps(
  node: any,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  assertType(node, SwitchStatement)

  const endOfSwitch = new JumpTargetAST()
  const switchCtx = Object.assign({}, ctx, { breakTarget: endOfSwitch.label })

  const steps: WorkflowStepAST[] = []
  const branches: SwitchConditionAST<WorkflowStepAST>[] = []
  const discriminant = convertExpression(node.discriminant)
  const cases = node.cases as any[]

  cases.forEach((caseNode) => {
    assertType(caseNode, SwitchCase)

    let condition: Expression
    if (caseNode.test) {
      const test = convertExpression(caseNode.test)
      condition = new BinaryExpression(discriminant, '==', test)
    } else {
      condition = new PrimitiveExpression(true)
    }

    const jumpTarget = new JumpTargetAST()
    const consequent = caseNode.consequent as any[]
    const body = transformAST(
      consequent.flatMap((x) => parseStep(x, switchCtx)),
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

function forOfStatementToForStep(node: any, ctx: ParsingContext): ForStepAST {
  assertType(node, ForOfStatement)
  assertType(node.body, BlockStatement)

  const bodyCtx = Object.assign({}, ctx, {
    continueTarget: undefined,
    breakTarget: undefined,
  })
  const steps = parseBlockStatement(node.body, bodyCtx)

  let loopVariableName: string
  if (node.left.type === Identifier) {
    loopVariableName = node.left.name as string
  } else if (node.left.type === VariableDeclaration) {
    if (node.left.declarations.length !== 1) {
      throw new WorkflowSyntaxError(
        'Only one variable can be declared here',
        node.left.loc,
      )
    }

    const declaration = node.left.declarations[0] as { init: any; id: any }
    if (declaration.init !== null) {
      throw new WorkflowSyntaxError(
        'Initial value not allowed',
        declaration.init.loc,
      )
    }

    assertType(declaration.id, Identifier)

    loopVariableName = declaration.id.name as string
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
  node: any,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  assertType(node, WhileStatement)

  const startOfLoop = new JumpTargetAST()
  const endOfLoop = new JumpTargetAST()
  const ctx2 = Object.assign({}, ctx, {
    continueTarget: startOfLoop.label,
    breakTarget: endOfLoop.label,
  })

  const steps: WorkflowStepAST[] = parseBlockStatement(node.body, ctx2)
  steps.push(new NextStepAST(startOfLoop.label))

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
  node: any,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  assertType(node, DoWhileStatement)

  const startOfLoop = new JumpTargetAST()
  const endOfLoop = new JumpTargetAST()
  const ctx2 = Object.assign({}, ctx, {
    continueTarget: startOfLoop.label,
    breakTarget: endOfLoop.label,
  })

  const steps: WorkflowStepAST[] = [startOfLoop]
  steps.push(...parseBlockStatement(node.body, ctx2))
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

function breakStatementToNextStep(node: any, ctx: ParsingContext): NextStepAST {
  assertType(node, BreakStatement)

  let target: StepName
  if (node.label) {
    assertType(node.label, Identifier)

    target = node.label.name as string
  } else if (ctx.breakTarget) {
    target = ctx.breakTarget
  } else {
    target = 'break'
  }

  return new NextStepAST(target)
}

function continueStatementToNextStep(
  node: any,
  ctx: ParsingContext,
): NextStepAST {
  assertType(node, ContinueStatement)

  let target: StepName
  if (node.label) {
    assertType(node.label, Identifier)

    target = node.label.name as string
  } else if (ctx.continueTarget) {
    target = ctx.continueTarget
  } else {
    target = 'continue'
  }

  return new NextStepAST(target)
}

function tryStatementToTryStep(node: any, ctx: ParsingContext): TryStepAST {
  assertType(node, TryStatement)

  const steps = parseBlockStatement(node.block, ctx)
  const exceptSteps = parseBlockStatement(node.handler.body, ctx)

  let errorVariable: string | undefined = undefined
  const handlerParam = node.handler.param as {
    type: string
    name: string
  } | null
  if (handlerParam) {
    assertType(handlerParam, Identifier)

    errorVariable = handlerParam.name
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

function labeledStep(node: any, ctx: ParsingContext): WorkflowStepAST[] {
  assertType(node, LabeledStatement)

  const steps = parseStep(node.body, ctx)
  if (steps.length > 0) {
    steps[0] = stepWithLabel(steps[0], node.label.name as string)
    return steps
  }

  return steps
}
