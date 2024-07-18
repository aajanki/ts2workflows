/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import {
  Expression,
  FunctionInvocation,
  ParenthesizedExpression,
  Primitive,
  Term,
  VariableReference,
  primitiveToExpression,
} from '../ast/expressions.js'
import { WorkflowSyntaxError } from '../errors.js'
import { assertOneOfManyTypes, assertType } from './asserts.js'

const {
  ArrayExpression,
  AwaitExpression,
  BinaryExpression,
  CallExpression,
  ConditionalExpression,
  Identifier,
  Literal,
  LogicalExpression,
  MemberExpression,
  ObjectExpression,
  TSAsExpression,
  UnaryExpression,
} = AST_NODE_TYPES

export function convertExpression(instance: any): Expression {
  const expOrPrimitive = convertExpressionOrPrimitive(instance)
  if (expOrPrimitive instanceof Expression) {
    return expOrPrimitive
  } else {
    return primitiveToExpression(expOrPrimitive)
  }
}

export function convertObjectExpression(
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
        keyPrimitive = key.name as string
      } else if (key.type === Literal) {
        if (typeof key.value === 'string') {
          keyPrimitive = key.value as string
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
      op = instance.operator as string
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
      op = instance.operator as string | undefined
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

function convertMemberExpression(memberExpression: any): VariableReference {
  assertType(memberExpression, MemberExpression)

  let objectName: string
  if (memberExpression.object.type === Identifier) {
    objectName = memberExpression.object.name as string
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
    const nodeArguments = node.arguments as any[]
    const argumentExpressions = nodeArguments.map(convertExpression)
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
