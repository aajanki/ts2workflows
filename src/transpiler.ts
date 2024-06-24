/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import * as parser from '@typescript-eslint/typescript-estree'
import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import * as YAML from 'yaml'
import {
  AssignStepAST,
  ForStepAST,
  RaiseStepAST,
  ReturnStepAST,
  SubworkflowAST,
  SwitchConditionAST,
  SwitchStepAST,
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

const {
  ArrayExpression,
  AssignmentExpression,
  BinaryExpression,
  BlockStatement,
  CallExpression,
  ExpressionStatement,
  ForInStatement,
  ForOfStatement,
  FunctionDeclaration,
  Identifier,
  IfStatement,
  Literal,
  LogicalExpression,
  MemberExpression,
  ObjectExpression,
  Program,
  ReturnStatement,
  ThrowStatement,
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

  const workflowAst = { subworkflows: ast.body.map(parseSubworkflows) }
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

function parseSubworkflows(node: any): SubworkflowAST {
  if (node?.type !== FunctionDeclaration) {
    throw new WorkflowSyntaxError(
      `Only function declarations allowed on the top level, encountered ${node?.type}`,
      node?.loc,
    )
  }

  // TODO: warn if async

  if (node.id.type !== Identifier) {
    throw new WorkflowSyntaxError(
      'Expected Identifier as a function name',
      node.id.loc,
    )
  }

  const workflowParams: WorkflowParameter[] = node.params.map((param: any) => {
    if (param.type !== Identifier) {
      throw new WorkflowSyntaxError(
        'TODO: function parameters besides Identifiers are not yet supported',
        param.loc,
      )
    }

    return { name: param.name }
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
        return callExpressionToAssignStep(node.expression)
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
      throw new WorkflowSyntaxError('for...in is not a supported construct. Use for...of.', node.loc)

    case ForOfStatement:
      return forOfStatementToForStep(node)

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

  if (node.operator !== '=') {
    throw new WorkflowSyntaxError(
      `Operator ${node.operator} is not supported in assignment expressions`,
      node.loc,
    )
  }

  const targetExpression = convertExpression(node.left)

  if (!targetExpression.isFullyQualifiedName()) {
    throw new WorkflowSyntaxError(
      'Unexpected left hand side on an assignment expression',
      node.loc,
    )
  }

  const assignments: VariableAssignment[] = [
    [targetExpression.toString(), convertExpression(node.right)],
  ]

  return new AssignStepAST(assignments)
}

function callExpressionToAssignStep(node: any): AssignStepAST {
  assertType(node, CallExpression)

  const calleeExpression = convertExpression(node.callee)
  if (calleeExpression.isFullyQualifiedName()) {
    const calleeName = calleeExpression.left.toString()
    const argumentExpressions: Expression[] =
      node.arguments.map(convertExpression)
    const invocation = new FunctionInvocation(calleeName, argumentExpressions)
    const assignments: VariableAssignment[] = [
      ['', new Expression(new Term(invocation), [])],
    ]

    return new AssignStepAST(assignments)
  } else {
    throw new WorkflowSyntaxError(
      'Callee should be a qualified name',
      node.callee.loc,
    )
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
    (typeof listExpression.left.value === 'number' ||
      typeof listExpression.left.value === 'string' ||
      typeof listExpression.left.value === 'boolean' ||
      listExpression.left.value === null)
  ) {
    throw new WorkflowSyntaxError('Must be list expression', node.right.loc)
  }

  return new ForStepAST(steps, loopVariableName, listExpression)
}
