import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import { TSESTree } from '@typescript-eslint/typescript-estree'
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
import { InternalTranspilingError, WorkflowSyntaxError } from '../errors.js'
import { assertOneOfManyTypes, assertType } from './asserts.js'

const {
  ArrayExpression,
  AssignmentPattern,
  AwaitExpression,
  CallExpression,
  ChainExpression,
  ConditionalExpression,
  Identifier,
  Literal,
  LogicalExpression,
  ObjectExpression,
  PrivateIdentifier,
  SpreadElement,
  TemplateLiteral,
  TSAsExpression,
  TSEmptyBodyFunctionExpression,
  TSNonNullExpression,
} = AST_NODE_TYPES

export function convertExpression(instance: TSESTree.Expression): Expression {
  const expOrPrimitive = convertExpressionOrPrimitive(instance)
  if (isExpression(expOrPrimitive)) {
    return expOrPrimitive
  } else {
    return new PrimitiveExpression(expOrPrimitive)
  }
}

export function convertObjectExpression(
  node: TSESTree.ObjectExpression,
): Record<string, Primitive | Expression> {
  assertType(node, ObjectExpression)

  const unsupported = node.properties.find(
    (prop) => prop.type === SpreadElement,
  )
  if (unsupported) {
    throw new WorkflowSyntaxError(
      'The spread syntax is not supported',
      unsupported.loc,
    )
  }

  return Object.fromEntries(
    node.properties
      .filter((prop) => prop.type !== SpreadElement)
      .map(({ key, value }) => {
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

        if (
          value.type === AssignmentPattern ||
          value.type === TSEmptyBodyFunctionExpression
        ) {
          throw new WorkflowSyntaxError('Value not supported', value.loc)
        }

        return [keyPrimitive, convertExpressionOrPrimitive(value)]
      }),
  )
}

export function convertObjectAsExpressionValues(
  node: TSESTree.ObjectExpression,
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

function convertExpressionOrPrimitive(
  instance: TSESTree.Expression,
): Primitive | Expression {
  switch (instance.type) {
    case ArrayExpression:
      return convertArrayExpression(instance)

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
        return new VariableReferenceExpression(instance.name)
      }

    case AST_NODE_TYPES.UnaryExpression:
      return convertUnaryExpression(instance)

    case AST_NODE_TYPES.BinaryExpression:
    case LogicalExpression:
      return convertBinaryExpression(instance)

    case AST_NODE_TYPES.MemberExpression:
      return convertMemberExpression(instance)

    case ChainExpression:
      return convertChainExpression(instance)

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

function convertArrayExpression(instance: TSESTree.ArrayExpression) {
  const unsupported = instance.elements.find((e) => e?.type === SpreadElement)
  if (unsupported) {
    throw new WorkflowSyntaxError(
      'The spread syntax is not supported',
      unsupported.loc,
    )
  }

  return instance.elements
    .filter((e) => e?.type !== SpreadElement)
    .map((e) =>
      e === null
        ? new PrimitiveExpression(null)
        : convertExpressionOrPrimitive(e),
    )
}

function convertBinaryExpression(
  instance: TSESTree.BinaryExpression | TSESTree.LogicalExpression,
): Expression {
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

  if (instance.left.type === PrivateIdentifier) {
    throw new WorkflowSyntaxError(
      'Private identifier not supported',
      instance.left.loc,
    )
  }

  return new BinaryExpression(
    convertExpression(instance.left),
    op,
    convertExpression(instance.right),
  )
}

function nullishCoalescingExpression(
  left: TSESTree.Expression,
  right: TSESTree.Expression,
): Expression {
  return new FunctionInvocationExpression('default', [
    convertExpression(left),
    convertExpression(right),
  ])
}

function convertUnaryExpression(
  instance: TSESTree.UnaryExpression,
): Expression {
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

export function convertMemberExpression(
  node: TSESTree.MemberExpression,
): Expression {
  assertType(node, AST_NODE_TYPES.MemberExpression)

  if (node.property.type === PrivateIdentifier) {
    throw new WorkflowSyntaxError(
      'Private identifier not supported',
      node.property.loc,
    )
  }

  const object = convertExpression(node.object)
  return new MemberExpression(
    object,
    convertExpression(node.property),
    node.computed,
  )
}

function convertChainExpression(node: TSESTree.ChainExpression): Expression {
  assertType(node, ChainExpression)

  const properties = chainExpressionToFlatArray(node.expression)
  const args = optinalChainToMapGetArguments(properties)

  return new FunctionInvocationExpression('map.get', args)
}

interface ChainedProperty {
  property: TSESTree.Expression
  optional: boolean
  computed: boolean
}

function chainExpressionToFlatArray(
  node: TSESTree.Expression,
): ChainedProperty[] {
  if (node.type === AST_NODE_TYPES.MemberExpression) {
    if (node.property.type === PrivateIdentifier) {
      throw new WorkflowSyntaxError(
        'Private identifier not supported',
        node.property.loc,
      )
    }

    const data = {
      property: node.property,
      optional: node.optional,
      computed: node.computed,
    }

    return chainExpressionToFlatArray(node.object).concat([data])
  } else {
    return [
      {
        property: node,
        optional: false,
        computed: false,
      },
    ]
  }
}

function optinalChainToMapGetArguments(
  properties: ChainedProperty[],
): Expression[] {
  if (properties.length <= 0) {
    // this shouldn't happen
    return []
  }

  let base: Expression
  let optionalSliceStart: number
  const firstOptional = properties.findIndex((p) => p.optional)

  if (firstOptional > 2) {
    const baseProperties = properties.slice(0, firstOptional - 1)
    base = memberExpressionFromList(baseProperties)
    optionalSliceStart = firstOptional - 1
  } else if (firstOptional >= 0) {
    base = convertExpression(properties[0].property)
    optionalSliceStart = 1
  } else {
    // firstOptional < 0, this shouldn't happen
    base = memberExpressionFromList(properties)
    optionalSliceStart = properties.length
  }

  const optionals = properties.slice(optionalSliceStart).map((opt) => {
    const propertyExp = convertExpression(opt.property)
    if (opt.computed) {
      return propertyExp
    } else if (isFullyQualifiedName(propertyExp)) {
      return new PrimitiveExpression(propertyExp.toString())
    } else {
      throw new WorkflowSyntaxError(
        'Unexpected property in an optional chain',
        opt.property.loc,
      )
    }
  })

  const args = [base]
  if (optionals.length > 1) {
    args.push(new PrimitiveExpression(optionals))
  } else if (optionals.length === 1) {
    args.push(optionals[0])
  }

  return args
}

function memberExpressionFromList(properties: ChainedProperty[]): Expression {
  if (properties.length >= 2) {
    const base = new MemberExpression(
      convertExpression(properties[0].property),
      convertExpression(properties[1].property),
      properties[1].computed,
    )

    return properties
      .slice(2)
      .reduce(
        (exp, current) =>
          new MemberExpression(
            exp,
            convertExpression(current.property),
            current.computed,
          ),
        base,
      )
  } else if (properties.length === 1) {
    return convertExpression(properties[0].property)
  } else {
    throw new InternalTranspilingError(
      'Empty array in memberExpressionFromList()',
    )
  }
}

function convertCallExpression(node: TSESTree.CallExpression): Expression {
  assertType(node, CallExpression)

  if (node.optional) {
    throw new WorkflowSyntaxError(
      'Optional call expressions are not supported',
      node.loc,
    )
  }

  const calleeExpression = convertExpression(node.callee)
  if (isFullyQualifiedName(calleeExpression)) {
    const unsupported = node.arguments.find((arg) => arg.type === SpreadElement)
    if (unsupported) {
      throw new WorkflowSyntaxError(
        'The spread syntax is not supported',
        unsupported.loc,
      )
    }

    const argumentExpressions = node.arguments
      .filter((arg) => arg.type !== SpreadElement)
      .map(convertExpression)

    return new FunctionInvocationExpression(
      calleeExpression.toString(),
      argumentExpressions,
    )
  } else {
    throw new WorkflowSyntaxError('Callee should be a qualified name', node.loc)
  }
}

function convertConditionalExpression(
  node: TSESTree.ConditionalExpression,
): Expression {
  assertType(node, ConditionalExpression)

  const test = convertExpression(node.test)
  const consequent = convertExpression(node.consequent)
  const alternate = convertExpression(node.alternate)

  return new FunctionInvocationExpression('if', [test, consequent, alternate])
}

function convertTemplateLiteralToExpression(
  node: TSESTree.TemplateLiteral,
): Expression {
  assertType(node, TemplateLiteral)

  const stringTerms = node.quasis
    .map((x) => x.value.cooked)
    .map((x) => new PrimitiveExpression(x))
  const templateTerms = node.expressions.map(convertExpression)

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
