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
  VariableAssignment,
  WorkflowStepAST,
} from '../ast/steps.js'
import {
  Expression,
  FunctionInvocation,
  ParenthesizedExpression,
  Term,
  VariableReference,
  primitiveToExpression,
} from '../ast/expressions.js'
import { InternalTranspilingError, WorkflowSyntaxError } from '../errors.js'
import { isRecord } from '../utils.js'
import { transformAST } from '../transformations.js'
import { assertType } from './asserts.js'
import { convertExpression, convertObjectExpression } from './expressions.js'

const {
  ArrayExpression,
  ArrowFunctionExpression,
  AssignmentExpression,
  BlockStatement,
  BreakStatement,
  CallExpression,
  ContinueStatement,
  DoWhileStatement,
  ExpressionStatement,
  ForInStatement,
  ForOfStatement,
  Identifier,
  IfStatement,
  LabeledStatement,
  ObjectExpression,
  ReturnStatement,
  ThrowStatement,
  TryStatement,
  VariableDeclaration,
  VariableDeclarator,
  WhileStatement,
} = AST_NODE_TYPES

// Blocking calls and their argument names. Blocking call must be run from a
// call step (not inside an expression)
const blockingFunctions = new Map([
  ['events.await_callback', ['callback', 'timeout']],
  [
    'http.delete',
    [
      'url',
      'timeout',
      'body',
      'headers',
      'query',
      'auth',
      'private_service_name',
      'ca_certificate',
    ],
  ],
  [
    'http.get',
    [
      'url',
      'timeout',
      'headers',
      'query',
      'auth',
      'private_service_name',
      'ca_certificate',
    ],
  ],
  [
    'http.patch',
    [
      'url',
      'timeout',
      'body',
      'headers',
      'query',
      'auth',
      'private_service_name',
      'ca_certificate',
    ],
  ],
  [
    'http.post',
    [
      'url',
      'timeout',
      'body',
      'headers',
      'query',
      'auth',
      'private_service_name',
      'ca_certificate',
    ],
  ],
  [
    'http.put',
    [
      'url',
      'timeout',
      'body',
      'headers',
      'query',
      'auth',
      'private_service_name',
      'ca_certificate',
    ],
  ],
  [
    'http.request',
    [
      'method',
      'url',
      'timeout',
      'body',
      'headers',
      'query',
      'auth',
      'private_service_name',
      'ca_certificate',
    ],
  ],
  ['sys.log', ['data', 'severity', 'text', 'json', 'timeout']],
  ['sys.sleep', ['seconds']],
  ['sys.sleep_until', ['time']],
])

export interface ParsingContext {
  breakTarget?: StepName
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
    const maybeBlockingcall = getBlockingCallParameters(decl.init)

    if (!decl.init) {
      return new AssignStepAST([[targetName, primitiveToExpression(null)]])
    } else if (maybeBlockingcall.isBlockingCall) {
      return blockingFunctionCallStep(
        maybeBlockingcall.functionName,
        maybeBlockingcall.argumentNames,
        decl.init.arguments,
        targetName,
      )
    } else {
      return new AssignStepAST([[targetName, convertExpression(decl.init)]])
    }
  })
}

function assignmentExpressionToSteps(node: any): WorkflowStepAST[] {
  assertType(node, AssignmentExpression)

  let compoundOperator: string | undefined = undefined
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

  if (!targetExpression.isFullyQualifiedName()) {
    throw new WorkflowSyntaxError(
      'The left-hand side of an assignment must be an identifier or a property access',
      node.loc,
    )
  }

  const steps: WorkflowStepAST[] = []
  const targetName = targetExpression.toString()
  const maybeBlockingcall = getBlockingCallParameters(node.right)

  if (maybeBlockingcall.isBlockingCall) {
    // Convert a blocking call to a call step

    // A temp variable is needed if the target is something else than a plain
    // identifier or if this is a compound assignments
    const useTemp = node.left.type !== Identifier || compoundOperator
    const resultVariable = useTemp ? '__temp' : targetName
    steps.push(
      blockingFunctionCallStep(
        maybeBlockingcall.functionName,
        maybeBlockingcall.argumentNames,
        node.right.arguments,
        resultVariable,
      ),
    )

    if (useTemp) {
      const tempRef = new Term(new VariableReference('__temp'))
      let ex: Expression
      if (compoundOperator) {
        ex = new Expression(new Term(new VariableReference(targetName)), [
          { binaryOperator: compoundOperator, right: tempRef },
        ])
      } else {
        ex = new Expression(tempRef, [])
      }

      steps.push(new AssignStepAST([[targetName, ex]]))
    }

    return steps
  } else {
    // assignment of an expression value
    let valueExpression: Expression = convertExpression(node.right)

    if (compoundOperator) {
      let right: Term
      if (valueExpression.isSingleValue()) {
        right = valueExpression.left
      } else {
        right = new Term(new ParenthesizedExpression(valueExpression))
      }

      valueExpression = new Expression(
        new Term(new VariableReference(targetName)),
        [{ binaryOperator: compoundOperator, right }],
      )
    }

    return [new AssignStepAST([[targetName, valueExpression]])]
  }
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
  if (calleeExpression.isFullyQualifiedName()) {
    const calleeName = calleeExpression.left.toString()

    if (calleeName === 'parallel') {
      // A custom implementation for "parallel"
      return callExpressionToParallelStep(node, ctx)
    } else if (calleeName === 'retry_policy') {
      return callExpressionToCallStep(calleeName, node.arguments)
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
  const invocation = new FunctionInvocation(functionName, argumentExpressions)
  const assignments: VariableAssignment[] = [
    ['', new Expression(new Term(invocation), [])],
  ]

  return new AssignStepAST(assignments)
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

  const primitiveOrExpArguments = convertObjectExpression(argumentsNode[0])
  const workflowArguments = Object.fromEntries(
    Object.entries(primitiveOrExpArguments).map(([key, val]) => {
      const valEx = val instanceof Expression ? val : primitiveToExpression(val)
      return [key, valEx]
    }),
  )

  return new CallStepAST(functionName, workflowArguments)
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
        steps = parseParallelBranches(node.arguments[0], ctx)
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

function parseParallelBranches(
  node: any,
  ctx: ParsingContext,
): Record<StepName, StepsStepAST> {
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
    if (x instanceof Expression || typeof x !== 'string') {
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
  return new AssignStepAST([['', convertExpression(node)]])
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
): SwitchConditionAST[] {
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
        condition: primitiveToExpression(true),
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
    listExpression.isLiteral() &&
    (isRecord(listExpression.left.value) ||
      typeof listExpression.left.value === 'number' ||
      typeof listExpression.left.value === 'string' ||
      typeof listExpression.left.value === 'boolean' ||
      listExpression.left.value === null)
  ) {
    throw new WorkflowSyntaxError('Must be list expression', node.right.loc)
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

  if (node.label != null) {
    throw new WorkflowSyntaxError(
      'Break with a label is not supported',
      node.label.loc,
    )
  }

  return new NextStepAST(ctx.breakTarget ?? 'break')
}

function continueStatementToNextStep(
  node: any,
  ctx: ParsingContext,
): NextStepAST {
  assertType(node, ContinueStatement)

  if (node.label != null) {
    throw new WorkflowSyntaxError(
      'Continue with a label is not supported',
      node.label.loc,
    )
  }

  return new NextStepAST(ctx.continueTarget ?? 'continue')
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
    steps[0].label = node.label.name as string
  }

  return steps
}
