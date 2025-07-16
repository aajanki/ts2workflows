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
export class NullExpression {
  readonly expressionType = 'null'
  readonly value = null

  toString(): string {
    return 'null'
  }
}

export class StringExpression {
  readonly expressionType = 'string'

  constructor(readonly value: string) {}

  toString(): string {
    return JSON.stringify(this.value)
  }
}

export class NumberExpression {
  readonly expressionType = 'number'

  constructor(readonly value: number) {}

  toString(): string {
    return this.value.toString()
  }
}

export class BooleanExpression {
  readonly expressionType = 'boolean'

  constructor(readonly value: boolean) {}

  toString(): string {
    return this.value ? 'true' : 'false'
  }
}

export class ListExpression {
  readonly expressionType = 'list'

  constructor(readonly value: Expression[]) {}

  toString(): string {
    return '[' + this.value.map((x) => x.toString()).join(', ') + ']'
  }
}

export class MapExpression {
  readonly expressionType = 'map'

  constructor(readonly value: Record<string, Expression>) {}

  toString(): string {
    return (
      '{' +
      Object.entries(this.value)
        .map(([key, val]) => JSON.stringify(key) + ': ' + val.toString())
        .join(', ') +
      '}'
    )
  }
}

export const nullEx = new NullExpression()
export const trueEx = new BooleanExpression(true)
export const falseEx = new BooleanExpression(false)

// expr OPERATOR expr
export class BinaryExpression {
  readonly expressionType = 'binary'
  readonly binaryOperator: BinaryOperator
  readonly left: Expression
  readonly right: Expression

  constructor(
    left: Expression,
    binaryOperator: BinaryOperator,
    right: Expression,
  ) {
    this.binaryOperator = binaryOperator
    this.left = left
    this.right = right
  }

  toString(): string {
    let leftString: string = this.left.toString()
    let rightString: string = this.right.toString()

    if (this.left.expressionType === 'binary') {
      const leftOpValue =
        operatorPrecedenceValue.get(this.left.binaryOperator) ?? 0
      const thisOpValue = operatorPrecedenceValue.get(this.binaryOperator) ?? 0
      if (leftOpValue < thisOpValue) {
        leftString = `(${leftString})`
      }
    }

    if (this.right.expressionType === 'binary') {
      const rightOpValue =
        operatorPrecedenceValue.get(this.right.binaryOperator) ?? 0
      const thisOpValue = operatorPrecedenceValue.get(this.binaryOperator) ?? 0
      if (rightOpValue < thisOpValue) {
        rightString = `(${rightString})`
      }
    }

    return `${leftString} ${this.binaryOperator} ${rightString}`
  }
}

// Variable name: a plain identifier (y, year) or a list
// element accessor (names[3])
export class VariableReferenceExpression {
  readonly expressionType = 'variableReference'
  readonly variableName: VariableName

  constructor(variableName: VariableName) {
    this.variableName = variableName
  }

  toString(): string {
    return this.variableName
  }
}

// Function invocation with anonymous parameters: sys.get_env("GOOGLE_CLOUD_PROJECT_ID")
export class FunctionInvocationExpression {
  readonly expressionType = 'functionInvocation'
  readonly functionName: string
  readonly arguments: Expression[]

  constructor(functionName: string, argumentExpressions: Expression[]) {
    this.functionName = functionName
    this.arguments = argumentExpressions
  }

  toString(): string {
    const argumentStrings = this.arguments.map((x) => x.toString())
    return `${this.functionName}(${argumentStrings.join(', ')})`
  }
}

// object.property or object[property]
export class MemberExpression {
  readonly expressionType = 'member'
  readonly object: Expression
  readonly property: Expression
  readonly computed: boolean

  constructor(object: Expression, property: Expression, computed: boolean) {
    this.object = object
    this.property = property
    this.computed = computed
  }

  toString(): string {
    if (this.computed) {
      return `${this.object.toString()}[${this.property.toString()}]`
    } else {
      return `${this.object.toString()}.${this.property.toString()}`
    }
  }
}

export class UnaryExpression {
  readonly expressionType = 'unary'
  readonly operator: UnaryOperator
  readonly value: Expression

  constructor(operator: UnaryOperator, value: Expression) {
    this.operator = operator
    this.value = value
  }

  toString(): string {
    const separator = this.operator === 'not' ? ' ' : ''
    let valueString = this.value.toString()
    if (this.value.expressionType === 'binary') {
      valueString = `(${valueString})`
    }
    return `${this.operator}${separator}${valueString}`
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
      return `\${${ex.toString()}}`

    case 'unary':
      if (ex.value.expressionType === 'number') {
        if (ex.operator === '+') {
          return ex.value.value
        } else if (ex.operator === '-') {
          return -ex.value.value
        } else {
          return `\${${ex.toString()}}`
        }
      } else {
        return `\${${ex.toString()}}`
      }
  }
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
