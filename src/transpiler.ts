/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import * as parser from '@typescript-eslint/typescript-estree'
import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import * as YAML from 'yaml'
import {
  AssignStepAST,
  CallStepAST,
  ForStepAST,
  NextStepAST,
  ParallelStepAST,
  RaiseStepAST,
  ReturnStepAST,
  StepName,
  StepsStepAST,
  SubworkflowAST,
  SwitchConditionAST,
  SwitchStepAST,
  TryStepAST,
  VariableAssignment,
  WorkflowStepAST,
} from './ast/steps.js'
import {
  Expression,
  FunctionInvocation,
  ParenthesizedExpression,
  Primitive,
  Term,
  VariableReference,
  primitiveToExpression,
} from './ast/expressions.js'
import { InternalTranspilingError, WorkflowSyntaxError } from './errors.js'
import { WorkflowParameter } from './ast/workflows.js'
import { generateStepNames } from './ast/stepnames.js'
import { isRecord } from './utils.js'
import { transformAST } from './transformations.js'

const {
  ArrayExpression,
  ArrowFunctionExpression,
  AwaitExpression,
  AssignmentExpression,
  AssignmentPattern,
  BinaryExpression,
  BlockStatement,
  BreakStatement,
  CallExpression,
  ConditionalExpression,
  ContinueStatement,
  ExportNamedDeclaration,
  ExpressionStatement,
  ForInStatement,
  ForOfStatement,
  FunctionDeclaration,
  Identifier,
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  IfStatement,
  LabeledStatement,
  Literal,
  LogicalExpression,
  MemberExpression,
  ObjectExpression,
  Program,
  ReturnStatement,
  ThrowStatement,
  TryStatement,
  TSAsExpression,
  UnaryExpression,
  VariableDeclaration,
  VariableDeclarator,
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

export function transpile(code: string): string {
  const parserOptions = {
    comment: true,
    loggerFn: false as const,
    loc: true,
    range: true,
  }

  const ast = parser.parse(code, parserOptions)
  assertType(ast, Program)

  const workflowAst = { subworkflows: ast.body.flatMap(parseTopLevelStatement) }
  const workflow = generateStepNames(workflowAst)
  return YAML.stringify(workflow.render())
}

function assertType(node: { type: string }, expectedType: string): void {
  if (node?.type !== expectedType) {
    throw new InternalTranspilingError(
      `Expected ${expectedType}, got ${node?.type}`,
    )
  }
}

function assertOneOfManyTypes(
  node: { type: string },
  expectAnyOfTheseTypes: string[],
): void {
  if (!expectAnyOfTheseTypes.includes(node?.type)) {
    throw new InternalTranspilingError(
      `Expected ${expectAnyOfTheseTypes.join(' or ')}, got ${node?.type}`,
    )
  }
}

function parseTopLevelStatement(node: any): SubworkflowAST[] {
  switch (node?.type) {
    case FunctionDeclaration:
      return [parseSubworkflows(node)]

    case ImportDeclaration:
      if (
        node.specifiers.some(
          (spec: any) =>
            spec.type === ImportNamespaceSpecifier ||
            spec.type === ImportDefaultSpecifier,
        )
      ) {
        throw new WorkflowSyntaxError(
          'Only named imports are allowed',
          node.loc,
        )
      }

      return []

    case ExportNamedDeclaration:
      // "export" keyword is ignored, but a possible function declaration is transpiled.
      if (node?.declaration) {
        return parseTopLevelStatement(node.declaration)
      } else {
        return []
      }

    default:
      throw new WorkflowSyntaxError(
        `Only function declarations and imports allowed on the top level, encountered ${node?.type}`,
        node?.loc,
      )
  }
}

function parseSubworkflows(node: any): SubworkflowAST {
  assertType(node, FunctionDeclaration)

  if (node.id.type !== Identifier) {
    throw new WorkflowSyntaxError(
      'Expected Identifier as a function name',
      node.id.loc,
    )
  }

  const workflowParams: WorkflowParameter[] = node.params.map((param: any) => {
    switch (param.type) {
      case Identifier:
        return { name: param.name }

      case AssignmentPattern:
        assertType(param.left, Identifier)
        if (param.right.type !== Literal) {
          throw new WorkflowSyntaxError(
            'The default value must be a literal',
            param.right.loc,
          )
        }

        return { name: param.left.name, default: param.right.value }

      default:
        throw new WorkflowSyntaxError(
          'Function parameter must be an identifier or an assignment',
          param.loc,
        )
    }
  })

  const steps = parseBlockStatement(node.body)

  return new SubworkflowAST(node.id.name, steps, workflowParams)
}

function parseBlockStatement(node: any): WorkflowStepAST[] {
  assertType(node, BlockStatement)

  const steps = node.body.flatMap(parseStep) as WorkflowStepAST[]
  return transformAST(steps)
}

function parseStep(node: any): WorkflowStepAST[] {
  switch (node.type) {
    case VariableDeclaration:
      return convertVariableDeclarations(node.declarations)

    case ExpressionStatement:
      if (node.expression.type === AssignmentExpression) {
        return assignmentExpressionToSteps(node.expression)
      } else if (node.expression.type === CallExpression) {
        return [callExpressionToStep(node.expression)]
      } else {
        return [generalExpressionToAssignStep(node.expression)]
      }

    case ReturnStatement:
      return [returnStatementToReturnStep(node)]

    case ThrowStatement:
      return [throwStatementToRaiseStep(node)]

    case IfStatement:
      return [ifStatementToSwitchStep(node)]

    case ForInStatement:
      throw new WorkflowSyntaxError(
        'for...in is not a supported construct. Use for...of.',
        node.loc,
      )

    case ForOfStatement:
      return [forOfStatementToForStep(node)]

    case BreakStatement:
      return [breakStatementToNextStep(node)]

    case ContinueStatement:
      return [continueStatementToNextStep(node)]

    case TryStatement:
      return [tryStatementToTryStep(node)]

    case LabeledStatement:
      return labeledStep(node)

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

function convertExpressionOrPrimitive(instance: any): Primitive | Expression {
  switch (instance.type) {
    case ArrayExpression:
      return (instance.elements as any[]).map(convertExpressionOrPrimitive)

    case ObjectExpression:
      return convertObjectExpression(instance)

    case Literal:
      return instance.value as Primitive

    case Identifier:
      if (instance.name === 'null' || instance.name === 'undefined') {
        return null
      } else if (instance.name === 'True' || instance.name === 'TRUE') {
        return true
      } else if (instance.name === 'False' || instance.name === 'FALSE') {
        return false
      } else {
        return new Expression(
          new Term(new VariableReference(instance.name as string)),
          [],
        )
      }

    case UnaryExpression:
      return convertUnaryExpression(instance)

    case BinaryExpression:
    case LogicalExpression:
      return convertBinaryExpression(instance)

    case MemberExpression:
      return new Expression(new Term(convertMemberExpression(instance)), [])

    case CallExpression:
      return convertCallExpression(instance)

    case ConditionalExpression:
      return convertConditionalExpression(instance)

    case TSAsExpression:
      return convertExpressionOrPrimitive(instance.expression)

    case AwaitExpression:
      return convertExpressionOrPrimitive(instance.argument)

    default:
      throw new WorkflowSyntaxError(
        `Not implemented expression type: ${instance.type}`,
        instance.loc,
      )
  }
}

export function convertExpression(instance: any): Expression {
  const expOrPrimitive = convertExpressionOrPrimitive(instance)
  if (expOrPrimitive instanceof Expression) {
    return expOrPrimitive
  } else {
    return primitiveToExpression(expOrPrimitive)
  }
}

function convertBinaryExpression(instance: any): Expression {
  assertOneOfManyTypes(instance, [BinaryExpression, LogicalExpression])

  // Special case for nullish coalescing becuase the result is a function call
  // expression, not a binary expression
  if (instance.operator === '??') {
    return nullishCoalescingExpression(instance.left, instance.right)
  }

  let op: string
  switch (instance.operator) {
    case '+':
    case '-':
    case '*':
    case '/':
    case '%':
    case '==':
    case '!=':
    case '>':
    case '>=':
    case '<':
    case '<=':
    case 'in':
      op = instance.operator
      break

    case '===':
      op = '=='
      break

    case '!==':
      op = '!='
      break

    case '&&':
      op = 'and'
      break

    case '||':
      op = 'or'
      break

    default:
      throw new WorkflowSyntaxError(
        `Unsupported binary operator: ${instance.operator}`,
        instance.loc,
      )
  }

  const leftEx = convertExpressionOrPrimitive(instance.left)
  const rightEx = convertExpressionOrPrimitive(instance.right)

  let rightTerm: Term
  if (rightEx instanceof Expression && rightEx.rest.length === 0) {
    rightTerm = rightEx.left
  } else if (rightEx instanceof Expression) {
    rightTerm = new Term(new ParenthesizedExpression(rightEx))
  } else {
    rightTerm = new Term(rightEx)
  }

  const rest = [
    {
      binaryOperator: op,
      right: rightTerm,
    },
  ]

  let leftTerm: Term
  if (leftEx instanceof Expression && leftEx.rest.length === 0) {
    leftTerm = leftEx.left
  } else if (leftEx instanceof Expression) {
    leftTerm = new Term(new ParenthesizedExpression(leftEx))
  } else {
    leftTerm = new Term(leftEx)
  }

  return new Expression(leftTerm, rest)
}

function nullishCoalescingExpression(left: any, right: any): Expression {
  return new Expression(
    new Term(
      new FunctionInvocation('default', [
        convertExpression(left),
        convertExpression(right),
      ]),
    ),
    [],
  )
}

function convertUnaryExpression(instance: any): Expression {
  assertType(instance, UnaryExpression)

  if (instance.prefix === false) {
    throw new WorkflowSyntaxError(
      'only prefix unary operators are supported',
      instance.loc,
    )
  }

  let op: string | undefined
  switch (instance.operator) {
    case '+':
    case '-':
    case undefined:
      op = instance.operator
      break

    case '!':
      op = 'not'
      break

    case 'void':
      // Just evalute the side-effecting expression.
      // This is wrong: the return value should be ignored.
      op = undefined
      break

    default:
      throw new WorkflowSyntaxError(
        `Unsupported unary operator: ${instance.operator}`,
        instance.loc,
      )
  }

  const ex = convertExpressionOrPrimitive(instance.argument)

  let val
  if (ex instanceof Expression && ex.isSingleValue()) {
    val = ex.left.value
  } else if (ex instanceof Expression) {
    val = new ParenthesizedExpression(ex)
  } else {
    val = ex
  }

  return new Expression(new Term(val, op), [])
}

function convertObjectExpression(
  node: any,
): Record<string, Primitive | Expression> {
  assertType(node, ObjectExpression)

  const properties = node.properties as {
    key: any
    value: any
  }[]

  return Object.fromEntries(
    properties.map(({ key, value }) => {
      let keyPrimitive: string
      if (key.type === Identifier) {
        keyPrimitive = key.name
      } else if (key.type === Literal) {
        if (typeof key.value === 'string') {
          keyPrimitive = key.value
        } else {
          throw new WorkflowSyntaxError(
            `Map keys must be identifiers or strings, encountered: ${typeof key.value}`,
            key.loc,
          )
        }
      } else {
        throw new WorkflowSyntaxError(
          `Not implemented object key type: ${key.type}`,
          key.loc,
        )
      }

      return [keyPrimitive, convertExpressionOrPrimitive(value)]
    }),
  )
}

function convertMemberExpression(memberExpression: any): VariableReference {
  assertType(memberExpression, MemberExpression)

  let objectName: string
  if (memberExpression.object.type === Identifier) {
    objectName = memberExpression.object.name
  } else if (memberExpression.object.type === MemberExpression) {
    objectName = convertMemberExpression(memberExpression.object).name
  } else {
    throw new WorkflowSyntaxError(
      `Unexpected type in member expression: ${memberExpression.object.type}`,
      memberExpression.loc,
    )
  }

  if (memberExpression.computed) {
    const member = convertExpression(memberExpression.property).toString()

    return new VariableReference(`${objectName}[${member}]`)
  } else {
    return new VariableReference(
      `${objectName}.${memberExpression.property.name}`,
    )
  }
}

function convertCallExpression(node: any): Expression {
  assertType(node, CallExpression)

  const calleeExpression = convertExpression(node.callee)
  if (calleeExpression.isFullyQualifiedName()) {
    const argumentExpressions: Expression[] =
      node.arguments.map(convertExpression)
    const invocation = new FunctionInvocation(
      calleeExpression.left.toString(),
      argumentExpressions,
    )
    return new Expression(new Term(invocation), [])
  } else {
    throw new WorkflowSyntaxError('Callee should be a qualified name', node.loc)
  }
}

function convertConditionalExpression(node: any): Expression {
  assertType(node, ConditionalExpression)

  const test = convertExpression(node.test)
  const consequent = convertExpression(node.consequent)
  const alternate = convertExpression(node.alternate)

  return new Expression(
    new Term(new FunctionInvocation('if', [test, consequent, alternate])),
    [],
  )
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

function callExpressionToStep(node: any): WorkflowStepAST {
  assertType(node, CallExpression)

  const calleeExpression = convertExpression(node.callee)
  if (calleeExpression.isFullyQualifiedName()) {
    const calleeName = calleeExpression.left.toString()

    if (calleeName === 'parallel') {
      // A custom implementation for "parallel"
      return callExpressionToParallelStep(node)
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

function callExpressionToParallelStep(node: any): ParallelStepAST {
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
        steps = parseParallelIteration(node.arguments[0])
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

  const stepsArray: [string, StepsStepAST][] = node.elements.map(
    (arg: any, idx: number) => {
      const branchName = `branch${idx + 1}`

      switch (arg.type) {
        case Identifier:
          return [branchName, new StepsStepAST([new CallStepAST(arg.name)])]

        case ArrowFunctionExpression:
          return [branchName, new StepsStepAST(parseBlockStatement(arg.body))]

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

function parseParallelIteration(node: any): ForStepAST {
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

  return forOfStatementToForStep(node.body.body[0])
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

function ifStatementToSwitchStep(node: any): SwitchStepAST {
  assertType(node, IfStatement)

  return new SwitchStepAST(flattenIfBranches(node))
}

function flattenIfBranches(ifStatement: any): SwitchConditionAST[] {
  assertType(ifStatement, IfStatement)
  assertType(ifStatement.consequent, BlockStatement)

  const branches = [
    {
      condition: convertExpression(ifStatement.test),
      steps: parseBlockStatement(ifStatement.consequent),
    },
  ]

  if (ifStatement.alternate) {
    if (ifStatement.alternate.type === BlockStatement) {
      branches.push({
        condition: primitiveToExpression(true),
        steps: parseBlockStatement(ifStatement.alternate),
      })
    } else if (ifStatement.alternate.type === IfStatement) {
      branches.push(...flattenIfBranches(ifStatement.alternate))
    } else {
      throw new InternalTranspilingError(
        `Expected BlockStatement or IfStatement, got ${ifStatement.alternate.type}`,
      )
    }
  }

  return branches
}

function forOfStatementToForStep(node: any): ForStepAST {
  assertType(node, ForOfStatement)
  assertType(node.body, BlockStatement)

  const steps = parseBlockStatement(node.body)

  let loopVariableName: string
  if (node.left.type === Identifier) {
    loopVariableName = node.left.name
  } else if (node.left.type === VariableDeclaration) {
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

    assertType(declaration.id, Identifier)

    loopVariableName = declaration.id.name
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

function breakStatementToNextStep(node: any): NextStepAST {
  assertType(node, BreakStatement)

  if (node.label != null) {
    throw new WorkflowSyntaxError(
      'Break with a label is not supported',
      node.label.loc,
    )
  }

  return new NextStepAST('break')
}

function continueStatementToNextStep(node: any): NextStepAST {
  assertType(node, ContinueStatement)

  if (node.label != null) {
    throw new WorkflowSyntaxError(
      'Continue with a label is not supported',
      node.label.loc,
    )
  }

  return new NextStepAST('continue')
}

function tryStatementToTryStep(node: any): TryStepAST {
  assertType(node, TryStatement)

  const steps = parseBlockStatement(node.block)
  const exceptSteps = parseBlockStatement(node.handler.body)

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

function labeledStep(node: any): WorkflowStepAST[] {
  assertType(node, LabeledStatement)

  const steps = parseStep(node.body)
  if (steps.length > 0) {
    steps[0].label = node.label.name as string
  }

  return steps
}
