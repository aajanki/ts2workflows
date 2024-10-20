/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import {
  BinaryExpression,
  BinaryOperator,
  Expression,
  FunctionInvocationExpression,
  MemberExpression,
  Primitive,
  PrimitiveExpression,
  UnaryExpression,
  VariableReferenceExpression,
  isExpression,
  isFullyQualifiedName,
} from '../ast/expressions.js'
import { WorkflowSyntaxError } from '../errors.js'
import { assertOneOfManyTypes, assertType } from './asserts.js'

const {
  ArrayExpression,
  AwaitExpression,
  CallExpression,
  ConditionalExpression,
  Identifier,
  Literal,
  LogicalExpression,
  ObjectExpression,
  TemplateLiteral,
  TSAsExpression,
  TSNonNullExpression,
} = AST_NODE_TYPES

export function convertExpression(instance: any): Expression {
  const expOrPrimitive = convertExpressionOrPrimitive(instance)
  if (isExpression(expOrPrimitive)) {
    return expOrPrimitive
  } else {
    return new PrimitiveExpression(expOrPrimitive)
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

export function convertObjectAsExpressionValues(
  node: any,
): Record<string, Expression> {
  const primitiveOrExpArguments = convertObjectExpression(node)

  // Convert Primitive values to PrimitiveExpressions
  return Object.fromEntries(
    Object.entries(primitiveOrExpArguments).map(([key, val]) => {
      const valEx = isExpression(val) ? val : new PrimitiveExpression(val)
      return [key, valEx]
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

    case TemplateLiteral:
      return convertTemplateLiteralToExpression(instance)

    case Identifier:
      if (instance.name === 'null' || instance.name === 'undefined') {
        return null
      } else if (instance.name === 'True' || instance.name === 'TRUE') {
        return true
      } else if (instance.name === 'False' || instance.name === 'FALSE') {
        return false
      } else {
        return new VariableReferenceExpression(instance.name as string)
      }

    case AST_NODE_TYPES.UnaryExpression:
      return convertUnaryExpression(instance)

    case AST_NODE_TYPES.BinaryExpression:
    case LogicalExpression:
      return convertBinaryExpression(instance)

    case AST_NODE_TYPES.MemberExpression:
      return convertMemberExpression(instance)

    case CallExpression:
      return convertCallExpression(instance)

    case ConditionalExpression:
      return convertConditionalExpression(instance)

    case TSAsExpression:
      return convertExpressionOrPrimitive(instance.expression)

    case TSNonNullExpression:
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
  assertOneOfManyTypes(instance, [
    AST_NODE_TYPES.BinaryExpression,
    LogicalExpression,
  ])

  // Special case for nullish coalescing becuase the result is a function call
  // expression, not a binary expression
  if (instance.operator === '??') {
    return nullishCoalescingExpression(instance.left, instance.right)
  }

  let op: BinaryOperator
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
      op = instance.operator as BinaryOperator
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

  return new BinaryExpression(
    convertExpression(instance.left),
    op,
    convertExpression(instance.right),
  )
}

function nullishCoalescingExpression(left: any, right: any): Expression {
  return new FunctionInvocationExpression('default', [
    convertExpression(left),
    convertExpression(right),
  ])
}

function convertUnaryExpression(instance: any): Expression {
  assertType(instance, AST_NODE_TYPES.UnaryExpression)

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

  const ex = convertExpression(instance.argument)
  return op ? new UnaryExpression(op, ex) : ex
}

export function convertMemberExpression(node: any): Expression {
  assertType(node, AST_NODE_TYPES.MemberExpression)

  const object = convertExpression(node.object)
  return new MemberExpression(
    object,
    convertExpression(node.property),
    node.computed,
  )
}

function convertCallExpression(node: any): Expression {
  assertType(node, CallExpression)

  const calleeExpression = convertExpression(node.callee)
  if (isFullyQualifiedName(calleeExpression)) {
    const nodeArguments = node.arguments as any[]
    const argumentExpressions = nodeArguments.map(convertExpression)
    return new FunctionInvocationExpression(
      calleeExpression.toString(),
      argumentExpressions,
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

  return new FunctionInvocationExpression('if', [test, consequent, alternate])
}

function convertTemplateLiteralToExpression(node: any): Expression {
  assertType(node, TemplateLiteral)

  const elements = node.quasis as { value: { cooked: string } }[]
  const stringTerms = elements
    .map((x) => x.value.cooked)
    .map((x) => new PrimitiveExpression(x))

  const expressionNodes = node.expressions as any[]
  const templateTerms = expressionNodes.map(convertExpression)

  // interleave string parts and the expression parts starting with strings
  const interleavedTerms: Expression[] = stringTerms
    .slice(0, stringTerms.length - 1)
    .flatMap((stringTerm, i) => {
      const combined: Expression[] = [stringTerm]
      if (i < templateTerms.length) {
        combined.push(templateTerms[i])
      }

      return combined
    })
  if (stringTerms[stringTerms.length - 1].value !== '') {
    interleavedTerms.push(stringTerms[stringTerms.length - 1])
  }

  if (interleavedTerms.length === 0) {
    return new PrimitiveExpression('')
  } else if (interleavedTerms.length === 1) {
    return interleavedTerms[0]
  } else {
    return interleavedTerms.reduce((previous, current) => {
      return new BinaryExpression(previous, '+', current)
    })
  }
}
