import { TSESTree, AST_NODE_TYPES } from '@typescript-eslint/typescript-estree'
import {
  BinaryExpression,
  BinaryOperator,
  Expression,
  FunctionInvocationExpression,
  ListExpression,
  MapExpression,
  MemberExpression,
  VariableReferenceExpression,
  binaryEx,
  booleanEx,
  expressionToString,
  functionInvocationEx,
  isQualifiedName,
  listEx,
  mapEx,
  memberEx,
  nullEx,
  numberEx,
  stringEx,
  unaryEx,
  variableReferenceEx,
} from '../ast/expressions.js'
import { InternalTranspilingError, WorkflowSyntaxError } from '../errors.js'

export function convertExpression(instance: TSESTree.Expression): Expression {
  switch (instance.type) {
    case AST_NODE_TYPES.ArrayExpression:
      return convertArrayExpression(instance)

    case AST_NODE_TYPES.ObjectExpression:
      return convertObjectExpression(instance)

    case AST_NODE_TYPES.Literal:
      if (instance.value instanceof RegExp) {
        throw new WorkflowSyntaxError('RegExp is not supported', instance.loc)
      } else if (typeof instance.value === 'bigint') {
        throw new WorkflowSyntaxError('BigInt is not supported', instance.loc)
      } else if (typeof instance.value === 'string') {
        return stringEx(instance.value)
      } else if (typeof instance.value === 'number') {
        return numberEx(instance.value)
      } else if (typeof instance.value === 'boolean') {
        return booleanEx(instance.value)
      } else {
        return nullEx
      }

    case AST_NODE_TYPES.TemplateLiteral:
      return convertTemplateLiteralToExpression(instance)

    case AST_NODE_TYPES.Identifier:
      if (instance.name === 'undefined') {
        return nullEx
      } else {
        return variableReferenceEx(instance.name)
      }

    case AST_NODE_TYPES.UnaryExpression:
      return convertUnaryExpression(instance)

    case AST_NODE_TYPES.BinaryExpression:
    case AST_NODE_TYPES.LogicalExpression:
      return convertBinaryExpression(instance)

    case AST_NODE_TYPES.MemberExpression:
      return convertMemberExpression(instance)

    case AST_NODE_TYPES.ChainExpression:
      return convertChainExpression(instance)

    case AST_NODE_TYPES.CallExpression:
      return convertCallExpression(instance)

    case AST_NODE_TYPES.ConditionalExpression:
      return convertConditionalExpression(instance)

    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSNonNullExpression:
    case AST_NODE_TYPES.TSInstantiationExpression:
    case AST_NODE_TYPES.TSSatisfiesExpression:
      return convertExpression(instance.expression)

    case AST_NODE_TYPES.AwaitExpression:
      return convertExpression(instance.argument)

    default:
      throw new WorkflowSyntaxError(
        `Not implemented expression type: ${instance.type}`,
        instance.loc,
      )
  }
}

export function convertObjectExpression(
  node: TSESTree.ObjectExpression,
): MapExpression {
  return mapEx(
    Object.fromEntries(
      throwIfSpread(node.properties).map(({ key, value }) => {
        let keyPrimitive: string
        if (key.type === AST_NODE_TYPES.Identifier) {
          keyPrimitive = key.name
        } else if (
          key.type === AST_NODE_TYPES.Literal &&
          typeof key.value === 'string'
        ) {
          keyPrimitive = key.value
        } else {
          throw new WorkflowSyntaxError(
            `Map keys must be identifiers or strings, encountered: ${key.type}`,
            key.loc,
          )
        }

        if (
          value.type === AST_NODE_TYPES.AssignmentPattern ||
          value.type === AST_NODE_TYPES.TSEmptyBodyFunctionExpression
        ) {
          throw new WorkflowSyntaxError('Value not supported', value.loc)
        }

        return [keyPrimitive, convertExpression(value)]
      }),
    ),
  )
}

function convertArrayExpression(
  instance: TSESTree.ArrayExpression,
): ListExpression {
  return listEx(
    throwIfSpread(instance.elements).map((e) =>
      e === null ? nullEx : convertExpression(e),
    ),
  )
}

function convertBinaryExpression(
  instance: TSESTree.BinaryExpression | TSESTree.LogicalExpression,
): BinaryExpression | FunctionInvocationExpression {
  // Special case for nullish coalescing because the result is a function call
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

  return binaryEx(
    convertExpression(throwIfPrivateIdentifier(instance.left)),
    op,
    convertExpression(instance.right),
  )
}

function nullishCoalescingExpression(
  left: TSESTree.Expression,
  right: TSESTree.Expression,
): FunctionInvocationExpression {
  return functionInvocationEx('default', [
    convertExpression(left),
    convertExpression(right),
  ])
}

function convertUnaryExpression(
  instance: TSESTree.UnaryExpression,
): Expression {
  if (!instance.prefix) {
    throw new WorkflowSyntaxError(
      'only prefix unary operators are supported',
      instance.loc,
    )
  }

  let op: '+' | '-' | 'not' | undefined
  let istypeof = false
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

    case 'typeof':
      op = undefined
      istypeof = true
      break

    default:
      throw new WorkflowSyntaxError(
        `Unsupported unary operator: ${instance.operator}`,
        instance.loc,
      )
  }

  const ex = convertExpression(instance.argument)

  if (istypeof) {
    return convertTypeOfExpression(ex)
  } else if (op) {
    return unaryEx(op, ex)
  } else {
    return ex
  }
}

function convertTypeOfExpression(
  value: Expression,
): FunctionInvocationExpression {
  // Note for future refactoring: evalute value only once (in case it has side effects)
  return functionInvocationEx('text.replace_all_regex', [
    functionInvocationEx('text.replace_all_regex', [
      functionInvocationEx('get_type', [value]),
      stringEx('^(bytes|list|map|null)$'),
      stringEx('object'),
    ]),
    stringEx('^(double|integer)$'),
    stringEx('number'),
  ])
}

export function convertMemberExpression(
  node: TSESTree.MemberExpression,
): MemberExpression {
  const object = convertExpression(node.object)
  return memberEx(
    object,
    convertExpression(throwIfPrivateIdentifier(node.property)),
    node.computed,
  )
}

function convertChainExpression(
  node: TSESTree.ChainExpression,
): FunctionInvocationExpression {
  const properties = chainExpressionToFlatArray(node.expression)
  const args = optionalChainToMapGetArguments(properties)

  return functionInvocationEx('map.get', args)
}

interface ChainedProperty {
  property: TSESTree.Expression
  optional: boolean
  computed: boolean
}

function chainExpressionToFlatArray(
  node: TSESTree.Expression,
): ChainedProperty[] {
  switch (node.type) {
    case TSESTree.AST_NODE_TYPES.Identifier:
    case TSESTree.AST_NODE_TYPES.ChainExpression:
      return [
        {
          property: node,
          optional: false,
          computed: false,
        },
      ]

    case TSESTree.AST_NODE_TYPES.MemberExpression: {
      const data = {
        property: throwIfPrivateIdentifier(node.property),
        optional: node.optional,
        computed: node.computed,
      }

      return chainExpressionToFlatArray(node.object).concat([data])
    }

    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSNonNullExpression:
    case AST_NODE_TYPES.TSInstantiationExpression:
    case AST_NODE_TYPES.TSSatisfiesExpression:
      return chainExpressionToFlatArray(node.expression)

    default:
      throw new WorkflowSyntaxError(
        `Type ${node.type} is not supported in optional chaining`,
        node.loc,
      )
  }
}

function optionalChainToMapGetArguments(
  properties: ChainedProperty[],
): Expression[] {
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
    } else if (isQualifiedName(propertyExp)) {
      return stringEx(expressionToString(propertyExp))
    } else {
      throw new WorkflowSyntaxError(
        'Unexpected property in an optional chain',
        opt.property.loc,
      )
    }
  })

  const args = [base]
  if (optionals.length > 1) {
    args.push(listEx(optionals))
  } else if (optionals.length === 1) {
    args.push(optionals[0])
  }

  return args
}

function memberExpressionFromList(properties: ChainedProperty[]): Expression {
  if (properties.length >= 2) {
    const base = memberEx(
      convertExpression(properties[0].property),
      convertExpression(properties[1].property),
      properties[1].computed,
    )

    return properties
      .slice(2)
      .reduce(
        (exp, current) =>
          memberEx(exp, convertExpression(current.property), current.computed),
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

function convertCallExpression(
  node: TSESTree.CallExpression,
): FunctionInvocationExpression {
  if (node.optional) {
    throw new WorkflowSyntaxError(
      'Optional call expressions are not supported',
      node.loc,
    )
  }

  const calleeExpression = convertExpression(node.callee)
  if (isQualifiedName(calleeExpression)) {
    const calleeName = expressionToString(calleeExpression)
    if (isIntrinsic(calleeName)) {
      let msg: string
      if (calleeName === 'call_step') {
        msg =
          'Calling call_step as part of an expression is not yet implemented'
      } else {
        msg = `"${calleeName}" can't be called as part of an expression`
      }

      throw new WorkflowSyntaxError(msg, node.callee.loc)
    }

    const argumentExpressions = throwIfSpread(node.arguments).map(
      convertExpressionOrUndefined,
    )

    return functionInvocationEx(calleeName, argumentExpressions)
  } else {
    throw new WorkflowSyntaxError('Callee should be a qualified name', node.loc)
  }
}

function convertExpressionOrUndefined(
  instance: TSESTree.Expression,
): Expression | undefined {
  if (
    instance.type === TSESTree.AST_NODE_TYPES.Identifier &&
    instance.name === 'undefined'
  ) {
    return undefined
  } else {
    return convertExpression(instance)
  }
}

export function isIntrinsic(calleeName: string): boolean {
  const intrinsics = ['parallel', 'retry_policy', 'call_step']
  return intrinsics.includes(calleeName)
}

export function isIntrinsicStatement(calleeName: string): boolean {
  const statementNames = ['parallel', 'retry_policy']
  return statementNames.includes(calleeName)
}

function convertConditionalExpression(
  node: TSESTree.ConditionalExpression,
): FunctionInvocationExpression {
  const test = convertExpression(node.test)
  const consequent = convertExpression(node.consequent)
  const alternate = convertExpression(node.alternate)

  return functionInvocationEx('if', [test, consequent, alternate])
}

function convertTemplateLiteralToExpression(
  node: TSESTree.TemplateLiteral,
): Expression {
  const stringTerms = node.quasis
    .map((x) => x.value.cooked)
    .map((x) => stringEx(x))
  const templateTerms = node.expressions
    .map(convertExpression)
    .map((ex) => functionInvocationEx('default', [ex, stringEx('null')]))

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
    return stringEx('')
  } else {
    return interleavedTerms.reduce((previous, current) =>
      binaryEx(previous, '+', current),
    )
  }
}

export function throwIfSpread<
  T extends
    | TSESTree.Expression
    | TSESTree.Property
    | TSESTree.SpreadElement
    | null,
>(nodes: T[]): Exclude<T, TSESTree.SpreadElement>[] {
  const unsupported = nodes.find(
    (x) => x?.type === AST_NODE_TYPES.SpreadElement,
  )
  if (unsupported) {
    throw new WorkflowSyntaxError(
      'The spread syntax is not supported',
      unsupported.loc,
    )
  }

  const argumentExpressions = nodes.filter(
    (x) => x?.type !== AST_NODE_TYPES.SpreadElement,
  ) as Exclude<T, TSESTree.SpreadElement>[]

  return argumentExpressions
}

export function throwIfPrivateIdentifier(
  prop: TSESTree.Expression | TSESTree.PrivateIdentifier,
): TSESTree.Expression {
  if (prop.type === AST_NODE_TYPES.PrivateIdentifier) {
    throw new WorkflowSyntaxError('Private identifier not supported', prop.loc)
  }

  return prop
}

export function convertAssignmentTarget(
  node: TSESTree.Expression,
): VariableReferenceExpression | MemberExpression {
  const ex = convertExpression(node)

  if (ex.tag !== 'variableReference' && ex.tag !== 'member') {
    throw new WorkflowSyntaxError(
      'An assignment taget must be an identifer or a member expression',
      node.loc,
    )
  }

  return ex
}
