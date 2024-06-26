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

const {
  ArrayExpression,
  ArrowFunctionExpression,
  AssignmentExpression,
  AssignmentPattern,
  BinaryExpression,
  BlockStatement,
  BreakStatement,
  CallExpression,
  ContinueStatement,
  ExpressionStatement,
  ForInStatement,
  ForOfStatement,
  FunctionDeclaration,
  Identifier,
  ImportDeclaration,
  IfStatement,
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
      // TODO
      return []

    default:
      throw new WorkflowSyntaxError(
        `Only function declarations and imports allowed on the top level, encountered ${node?.type}`,
        node?.loc,
      )
  }
}

function parseSubworkflows(node: any): SubworkflowAST {
  assertType(node, FunctionDeclaration)

  // TODO: warn if async

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

  const steps: WorkflowStepAST[] = node.body.body.map(parseStep)

  return new SubworkflowAST(node.id.name, steps, workflowParams)
}

function parseStep(node: any): WorkflowStepAST {
  switch (node.type) {
    case VariableDeclaration:
      return convertVariableDeclarations(node.declarations)

    case ExpressionStatement:
      if (node.expression.type === AssignmentExpression) {
        return assignmentExpressionToAssignStep(node.expression)
      } else if (node.expression.type === CallExpression) {
        return callExpressionToStep(node.expression)
      } else {
        return generalExpressionToAssignStep(node.expression)
      }

    case ReturnStatement:
      return returnStatementToReturnStep(node)

    case ThrowStatement:
      return throwStatementToRaiseStep(node)

    case IfStatement:
      return ifStatementToSwitchStep(node)

    case ForInStatement:
      throw new WorkflowSyntaxError(
        'for...in is not a supported construct. Use for...of.',
        node.loc,
      )

    case ForOfStatement:
      return forOfStatementToForStep(node)

    case BreakStatement:
      return breakStatementToNextStep(node)

    case ContinueStatement:
      return continueStatementToNextStep(node)

    case TryStatement:
      return tryStatementToTryStep(node)

    default:
      throw new WorkflowSyntaxError(
        `TODO: encountered unsupported type: ${node.type}`,
        node.loc,
      )
  }
}

function convertVariableDeclarations(declarations: any): AssignStepAST {
  const assignments: VariableAssignment[] = declarations.map((decl: any) => {
    if (decl.type !== VariableDeclarator) {
      throw new WorkflowSyntaxError('Not a VariableDeclarator', decl.loc)
    }

    if (decl.id.type !== Identifier) {
      throw new WorkflowSyntaxError('Expected Identifier', decl.loc)
    }

    return [decl.id.name as string, convertExpression(decl.init)]
  })

  return new AssignStepAST(assignments)
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

    case TSAsExpression:
      return convertExpressionOrPrimitive(instance.expression)

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

    default:
      throw new WorkflowSyntaxError(
        `Unsupported unary operator: ${instance.operation}`,
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
    const calleeName = calleeExpression.left.toString()
    const argumentExpressions: Expression[] =
      node.arguments.map(convertExpression)
    const invocation = new FunctionInvocation(calleeName, argumentExpressions)
    return new Expression(new Term(invocation), [])
  } else {
    throw new WorkflowSyntaxError('Callee should be a qualified name', node.loc)
  }
}

function assignmentExpressionToAssignStep(node: any): AssignStepAST {
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

  const targetName = targetExpression.toString()

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

  const assignments: VariableAssignment[] = [[targetName, valueExpression]]

  return new AssignStepAST(assignments)
}

function callExpressionToStep(node: any): WorkflowStepAST {
  assertType(node, CallExpression)

  const calleeExpression = convertExpression(node.callee)
  if (calleeExpression.isFullyQualifiedName()) {
    const calleeName = calleeExpression.left.toString()

    // Convert special functions
    if (calleeName === 'parallel') {
      return callExpressionToParallelStep(node)
    } else {
      // a "normal" subworkflow or standard library function call
      const argumentExpressions: Expression[] =
        node.arguments.map(convertExpression)
      const invocation = new FunctionInvocation(calleeName, argumentExpressions)
      const assignments: VariableAssignment[] = [
        ['', new Expression(new Term(invocation), [])],
      ]

      return new AssignStepAST(assignments)
    }
  } else {
    throw new WorkflowSyntaxError(
      'Expeced a subworkflow or a standard library function name',
      node.callee.loc,
    )
  }
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
          return [
            branchName,
            new StepsStepAST(arg.body.body.map(parseStep) as WorkflowStepAST[]),
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
      steps: ifStatement.consequent.body.map(parseStep) as WorkflowStepAST[],
    },
  ]

  if (ifStatement.alternate) {
    if (ifStatement.alternate.type === BlockStatement) {
      branches.push({
        condition: primitiveToExpression(true),
        steps: ifStatement.alternate.body.map(parseStep) as WorkflowStepAST[],
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

  const steps = node.body.body.map(parseStep) as WorkflowStepAST[]

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
  return new NextStepAST('break')
}

function continueStatementToNextStep(node: any): NextStepAST {
  assertType(node, ContinueStatement)
  return new NextStepAST('continue')
}

function tryStatementToTryStep(node: any): TryStepAST {
  assertType(node, TryStatement)

  const steps: WorkflowStepAST[] = node.block.body.map(parseStep)
  const exceptSteps: WorkflowStepAST[] = node.handler.body.body.map(parseStep)

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
