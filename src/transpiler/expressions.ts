/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import {
  Expression,
  FunctionInvocationTerm,
  ParenthesizedTerm,
  Primitive,
  PrimitiveTerm,
  Term,
  VariableName,
  VariableReferenceTerm,
  binaryExpression,
  primitiveExpression,
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
    return primitiveExpression(expOrPrimitive)
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
          new VariableReferenceTerm(instance.name as string),
        )
      }

    case UnaryExpression:
      return convertUnaryExpression(instance)

    case BinaryExpression:
    case LogicalExpression:
      return convertBinaryExpression(instance)

    case MemberExpression:
      return new Expression(
        new VariableReferenceTerm(convertMemberExpression(instance)),
      )

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

  const left = convertExpressionOrPrimitive(instance.left)
  const right = convertExpressionOrPrimitive(instance.right)

  return binaryExpression(left, op, right)
}

function nullishCoalescingExpression(left: any, right: any): Expression {
  return new Expression(
    new FunctionInvocationTerm('default', [
      convertExpression(left),
      convertExpression(right),
    ]),
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

  let op: '+' | '-' | 'not' | undefined
  switch (instance.operator) {
    case '+':
      op = '+'
      break

    case '-':
      op = '-'
      break

    case '!':
      op = 'not'
      break

    case 'void':
      // Just evalute the side-effecting expression.
      // This is wrong: the return value should be ignored.
      op = undefined
      break

    case undefined:
      op = undefined
      break

    default:
      throw new WorkflowSyntaxError(
        `Unsupported unary operator: ${instance.operator}`,
        instance.loc,
      )
  }

  const ex = convertExpressionOrPrimitive(instance.argument)
  let term: Term
  if (
    ex instanceof Expression &&
    ex.isLiteral() &&
    ex.left instanceof PrimitiveTerm
  ) {
    term = new PrimitiveTerm(ex.left.value, op)
  } else if (
    ex instanceof Expression &&
    ex.isSingleValue() &&
    ex.left instanceof VariableReferenceTerm
  ) {
    term = new VariableReferenceTerm(ex.left.variableName, op)
  } else if (
    ex instanceof Expression &&
    ex.isSingleValue() &&
    ex.left instanceof FunctionInvocationTerm
  ) {
    term = new FunctionInvocationTerm(
      ex.left.functionName,
      ex.left.arguments,
      op,
    )
  } else if (ex instanceof Expression) {
    term = new ParenthesizedTerm(ex, op)
  } else {
    term = new PrimitiveTerm(ex, op)
  }

  return new Expression(term)
}

function convertMemberExpression(memberExpression: any): VariableName {
  assertType(memberExpression, MemberExpression)

  let objectName: string
  if (memberExpression.object.type === Identifier) {
    objectName = memberExpression.object.name as string
  } else if (memberExpression.object.type === MemberExpression) {
    objectName = convertMemberExpression(memberExpression.object)
  } else {
    throw new WorkflowSyntaxError(
      `Unexpected type in member expression: ${memberExpression.object.type}`,
      memberExpression.loc,
    )
  }

  if (memberExpression.computed) {
    const member = convertExpression(memberExpression.property).toString()

    return `${objectName}[${member}]`
  } else {
    return `${objectName}.${memberExpression.property.name}`
  }
}

function convertCallExpression(node: any): Expression {
  assertType(node, CallExpression)

  const calleeExpression = convertExpression(node.callee)
  if (calleeExpression.isFullyQualifiedName()) {
    const nodeArguments = node.arguments as any[]
    const argumentExpressions = nodeArguments.map(convertExpression)
    return new Expression(
      new FunctionInvocationTerm(
        calleeExpression.left.toString(),
        argumentExpressions,
      ),
    )
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
    new FunctionInvocationTerm('if', [test, consequent, alternate]),
  )
}
