import * as R from 'ramda'

export type VariableName = string
export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '//'
  | '%'
  | '=='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | 'in'
  | 'and'
  | 'or'
export type UnaryOperator = '-' | '+' | 'not'

// Operator precendence for unary and binary operators in the Workflows language.
// Note that these differ somewhat from Javascript.
// https://cloud.google.com/workflows/docs/reference/syntax/datatypes
const operatorPrecedenceValue: Map<string, number> = new Map<string, number>([
  ['not', 7],
  // ['-', 6], // unary minus, commented out to avoid confusion with binary minus
  ['*', 5],
  ['/', 5],
  ['//', 5],
  ['%', 5],
  ['+', 4],
  ['-', 4],
  ['<=', 3],
  ['>=', 3],
  ['<', 3],
  ['>', 3],
  ['==', 3],
  ['===', 3],
  ['!=', 3],
  ['!==', 3],
  ['in', 3],
  ['and', 2],
  ['or', 1],
])

export type LiteralValueOrLiteralExpression =
  | null
  | string
  | number
  | boolean
  | LiteralValueOrLiteralExpression[]
  | { [key: string]: LiteralValueOrLiteralExpression }

export type Expression =
  | NullExpression
  | StringExpression
  | NumberExpression
  | BooleanExpression
  | ListExpression
  | MapExpression
  | BinaryExpression
  | VariableReferenceExpression
  | FunctionInvocationExpression
  | MemberExpression
  | UnaryExpression

// A primitive (string, number, list, etc) value
interface ExpressionLiteral<V, Tag> {
  readonly expressionType: Tag
  readonly value: V
}

export type NullExpression = ExpressionLiteral<null, 'null'>
export type StringExpression = ExpressionLiteral<string, 'string'>
export type NumberExpression = ExpressionLiteral<number, 'number'>
export type BooleanExpression = ExpressionLiteral<boolean, 'boolean'>
export type ListExpression = ExpressionLiteral<Expression[], 'list'>
export type MapExpression = ExpressionLiteral<Record<string, Expression>, 'map'>

export const nullEx: NullExpression = { expressionType: 'null', value: null }

export function stringEx(value: string): StringExpression {
  return { expressionType: 'string', value }
}

export function numberEx(value: number): NumberExpression {
  return { expressionType: 'number', value }
}

export function booleanEx(value: boolean): BooleanExpression {
  return { expressionType: 'boolean', value }
}

export const trueEx = booleanEx(true)
export const falseEx = booleanEx(false)

export function listEx(value: Expression[]): ListExpression {
  return { expressionType: 'list', value }
}

export function mapEx(value: Record<string, Expression>): MapExpression {
  return { expressionType: 'map', value }
}

// expr OPERATOR expr
export interface BinaryExpression {
  readonly expressionType: 'binary'
  readonly binaryOperator: BinaryOperator
  readonly left: Expression
  readonly right: Expression
}

export function binaryEx(
  left: Expression,
  binaryOperator: BinaryOperator,
  right: Expression,
): BinaryExpression {
  return {
    expressionType: 'binary',
    binaryOperator,
    left,
    right,
  }
}

// Variable name: a plain identifier (y, year) or a list
// element accessor (names[3])
export interface VariableReferenceExpression {
  readonly expressionType: 'variableReference'
  readonly variableName: VariableName
}

export function variableReferenceEx(
  variableName: VariableName,
): VariableReferenceExpression {
  return { expressionType: 'variableReference', variableName }
}

// Function invocation with anonymous parameters: sys.get_env("GOOGLE_CLOUD_PROJECT_ID")
export interface FunctionInvocationExpression {
  readonly expressionType: 'functionInvocation'
  readonly functionName: string
  readonly arguments: Expression[]
}

export function functionInvocationEx(
  functionName: string,
  argumentExpressions: Expression[],
): FunctionInvocationExpression {
  return {
    expressionType: 'functionInvocation',
    functionName,
    arguments: argumentExpressions,
  }
}

// object.property or object[property]
export interface MemberExpression {
  readonly expressionType: 'member'
  readonly object: Expression
  readonly property: Expression
  readonly computed: boolean
}

export function memberEx(
  object: Expression,
  property: Expression,
  computed: boolean,
): MemberExpression {
  return { expressionType: 'member', object, property, computed }
}

// unary, e.g. -1, +42, not ok
export interface UnaryExpression {
  readonly expressionType: 'unary'
  readonly operator: UnaryOperator
  readonly value: Expression
}

export function unaryEx(
  operator: UnaryOperator,
  value: Expression,
): UnaryExpression {
  return { expressionType: 'unary', operator, value }
}

// Returns a string representation of ex, not enclosed in ${}
export function expressionToString(ex: Expression): string {
  switch (ex.expressionType) {
    case 'string':
      return JSON.stringify(ex.value)

    case 'number':
      return ex.value.toString()

    case 'boolean':
      return ex.value ? 'true' : 'false'

    case 'null':
      return 'null'

    case 'list':
      return '[' + ex.value.map(expressionToString).join(', ') + ']'

    case 'map':
      return (
        '{' +
        Object.entries(ex.value)
          .map(
            ([key, val]) =>
              JSON.stringify(key) + ': ' + expressionToString(val),
          )
          .join(', ') +
        '}'
      )

    case 'binary':
      return binaryExpressionToString(ex)

    case 'variableReference':
      return ex.variableName

    case 'functionInvocation':
      return `${ex.functionName}(${ex.arguments.map(expressionToString).join(', ')})`

    case 'member':
      if (ex.computed) {
        return `${expressionToString(ex.object)}[${expressionToString(ex.property)}]`
      } else {
        return `${expressionToString(ex.object)}.${expressionToString(ex.property)}`
      }

    case 'unary':
      return unaryExpressionToString(ex)
  }
}

function binaryExpressionToString(ex: BinaryExpression): string {
  let leftString = expressionToString(ex.left)
  let rightString = expressionToString(ex.right)

  if (ex.left.expressionType === 'binary') {
    const leftOpValue = operatorPrecedenceValue.get(ex.left.binaryOperator) ?? 0
    const thisOpValue = operatorPrecedenceValue.get(ex.binaryOperator) ?? 0
    if (leftOpValue < thisOpValue) {
      leftString = `(${leftString})`
    }
  }

  if (ex.right.expressionType === 'binary') {
    const rightOpValue =
      operatorPrecedenceValue.get(ex.right.binaryOperator) ?? 0
    const thisOpValue = operatorPrecedenceValue.get(ex.binaryOperator) ?? 0
    if (rightOpValue < thisOpValue) {
      rightString = `(${rightString})`
    }
  }

  return `${leftString} ${ex.binaryOperator} ${rightString}`
}

function unaryExpressionToString(ex: UnaryExpression): string {
  const separator = ex.operator === 'not' ? ' ' : ''
  let valueString = expressionToString(ex.value)
  if (ex.value.expressionType === 'binary') {
    valueString = `(${valueString})`
  }
  return `${ex.operator}${separator}${valueString}`
}

// Returns true if expression is a literal value.
// Examples of literals: number, string, array of numbers or strings, etc.
// Examples of non-literals: array that contains complex expressions.
export function isLiteral(ex: Expression): boolean {
  switch (ex.expressionType) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
      return true

    case 'list':
      return ex.value.every(isLiteral)

    case 'map':
      return Object.values(ex.value).every(isLiteral)

    case 'unary':
      return isLiteral(ex.value)

    case 'binary':
    case 'variableReference':
    case 'functionInvocation':
    case 'member':
      return false
  }
}

// Returns a literal for simple terms and a literal expression enclosed in ${} for complex terms.
export function expressionToLiteralValueOrLiteralExpression(
  ex: Expression,
): LiteralValueOrLiteralExpression {
  switch (ex.expressionType) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
      return ex.value

    case 'list':
      return R.map(expressionToLiteralValueOrLiteralExpression, ex.value)

    case 'map':
      return R.map(expressionToLiteralValueOrLiteralExpression, ex.value)

    case 'binary':
    case 'variableReference':
    case 'functionInvocation':
    case 'member':
      return `\${${expressionToString(ex)}}`

    case 'unary':
      if (ex.value.expressionType === 'number') {
        if (ex.operator === '+') {
          return ex.value.value
        } else if (ex.operator === '-') {
          return -ex.value.value
        } else {
          return `\${${expressionToString(ex)}}`
        }
      } else {
        return `\${${expressionToString(ex)}}`
      }
  }
}

export function isFullyQualifiedName(ex: Expression): boolean {
  switch (ex.expressionType) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
    case 'list':
    case 'map':
    case 'binary':
    case 'functionInvocation':
    case 'unary':
      return false

    case 'variableReference':
      return true

    case 'member':
      return (
        isFullyQualifiedName(ex.object) &&
        (isFullyQualifiedName(ex.property) ||
          (ex.computed &&
            ['null', 'string', 'number', 'boolean'].includes(
              ex.property.expressionType,
            )))
      )
  }
}

/**
 * Returns true if ex is pure expression (can't have side-effects)
 */
export function isPure(ex: Expression): boolean {
  switch (ex.expressionType) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
      return true

    case 'list':
      return ex.value.every(isPure)

    case 'map':
      return Object.values(ex.value).every(isPure)

    case 'binary':
      return isPure(ex.left) && isPure(ex.right)

    case 'functionInvocation':
      return false

    case 'variableReference':
      return true

    case 'member':
      return isPure(ex.object) && isPure(ex.property)

    case 'unary':
      return isPure(ex.value)
  }
}
