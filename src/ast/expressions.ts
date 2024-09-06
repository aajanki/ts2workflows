import { isRecord } from '../utils.js'

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

export type Primitive =
  | null
  | string
  | number
  | boolean
  | (Primitive | Expression)[]
  | { [key: string]: Primitive | Expression }

export type LiteralValueOrLiteralExpression =
  | null
  | string
  | number
  | boolean
  | LiteralValueOrLiteralExpression[]
  | { [key: string]: LiteralValueOrLiteralExpression }

export type Expression =
  | PrimitiveExpression
  | BinaryExpression
  | VariableReferenceExpression
  | FunctionInvocationExpression
  | MemberExpression
  | UnaryExpression

// A primitive (string, number, list, etc) value
// TODO: Is this needed? Use unboxed Primitive instead?
export class PrimitiveExpression {
  readonly expressionType = 'primitive'
  readonly value: Primitive

  constructor(value: Primitive) {
    this.value = value
  }

  // Return the string representation of this expression.
  // Not enclosed in ${}.
  toString(): string {
    const val = this.value
    if (Array.isArray(val)) {
      const elements = val.map((v) => {
        return isExpression(v) ? v.toString() : primitiveToString(v)
      })
      return `[${elements.join(', ')}]`
    } else if (isRecord(val)) {
      const elements = Object.entries(val).map(([k, v]) => {
        return `"${k}": ${isExpression(v) ? v.toString() : primitiveToString(v)}`
      })
      return `{${elements.join(', ')}}`
    } else {
      return `${JSON.stringify(val)}`
    }
  }
}

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

// Convert a Primitive to a string representation.
// Does not add ${}.
function primitiveToString(val: Primitive): string {
  if (Array.isArray(val)) {
    const elements = val.map((x) => {
      return isExpression(x) ? x.toString() : primitiveToString(x)
    })

    return `[${elements.join(', ')}]`
  } else if (val !== null && typeof val === 'object') {
    const items = Object.entries(val).map(([k, v]) => {
      return [k, isExpression(v) ? v.toString() : primitiveToString(v)]
    })
    const elements = items.map(([k, v]) => `"${k}":${v}`)

    return `{${elements.join(',')}}`
  } else {
    return JSON.stringify(val)
  }
}

export function isExpression(val: Primitive | Expression): val is Expression {
  return !(
    val === null ||
    val === undefined ||
    typeof val === 'string' ||
    typeof val === 'number' ||
    typeof val === 'boolean' ||
    Array.isArray(val) ||
    isRecord(val)
  )
}

// Returns a literal for simple terms and a literal expression enclosed in ${} for complex terms.
export function expressionToLiteralValueOrLiteralExpression(
  ex: Expression,
): LiteralValueOrLiteralExpression {
  switch (ex.expressionType) {
    case 'primitive':
      return primitiveExpressionToLiteralValueOrLiteralExpression(ex)

    case 'binary':
    case 'variableReference':
    case 'functionInvocation':
    case 'member':
      return `\${${ex.toString()}}`

    case 'unary':
      if (
        ex.value.expressionType === 'primitive' &&
        typeof ex.value.value === 'number'
      ) {
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

function primitiveExpressionToLiteralValueOrLiteralExpression(
  ex: PrimitiveExpression,
): LiteralValueOrLiteralExpression {
  if (
    typeof ex.value === 'number' ||
    typeof ex.value === 'string' ||
    typeof ex.value === 'boolean' ||
    ex.value === null
  ) {
    return ex.value
  } else if (Array.isArray(ex.value)) {
    return ex.value.map((x) => {
      if (isExpression(x)) {
        return expressionToLiteralValueOrLiteralExpression(x)
      } else if (Array.isArray(x) || isRecord(x)) {
        return primitiveExpressionToLiteralValueOrLiteralExpression(
          new PrimitiveExpression(x),
        )
      } else if (
        x === null ||
        typeof x === 'string' ||
        typeof x === 'number' ||
        typeof x === 'boolean'
      ) {
        return x
      } else {
        return `\${${primitiveToString(x)}}`
      }
    })
  } else if (isRecord(ex.value)) {
    return Object.fromEntries(
      Object.entries(ex.value).map(([k, v]) => {
        if (isExpression(v)) {
          return [k, expressionToLiteralValueOrLiteralExpression(v)]
        } else if (Array.isArray(v) || isRecord(v)) {
          return [
            k,
            primitiveExpressionToLiteralValueOrLiteralExpression(
              new PrimitiveExpression(v),
            ),
          ]
        } else if (
          v === null ||
          typeof v === 'string' ||
          typeof v === 'number' ||
          typeof v === 'boolean'
        ) {
          return [k, v]
        } else {
          return [k, `\${${primitiveToString(v)}}`]
        }
      }),
    )
  } else {
    return `\${${ex.toString()}}`
  }
}

// Returns true if expression is a literal value.
// Examples of literals: number, string, array of numbers or strings, etc.
// Examples of non-literals: array that contains complex expressions.
export function isLiteral(ex: Expression): boolean {
  switch (ex.expressionType) {
    case 'primitive':
      return primitiveIsLiteral(ex)

    case 'unary':
      return isLiteral(ex.value)

    case 'binary':
    case 'variableReference':
    case 'functionInvocation':
    case 'member':
      return false
  }
}

function primitiveIsLiteral(ex: PrimitiveExpression): boolean {
  if (Array.isArray(ex.value)) {
    return ex.value.every((x) => {
      if (isExpression(x)) {
        return isLiteral(x)
      } else {
        return (
          typeof x === 'string' ||
          typeof x === 'number' ||
          typeof x === 'boolean' ||
          x === null
        )
      }
    })
  } else if (isRecord(ex.value)) {
    return Object.values(ex.value).every((x) => {
      if (isExpression(x)) {
        return isLiteral(x)
      } else {
        return (
          typeof x === 'string' ||
          typeof x === 'number' ||
          typeof x === 'boolean' ||
          x === null
        )
      }
    })
  } else {
    return (
      typeof ex.value === 'string' ||
      typeof ex.value === 'number' ||
      typeof ex.value === 'boolean' ||
      ex.value === null
    )
  }
}

export function isFullyQualifiedName(ex: Expression): boolean {
  switch (ex.expressionType) {
    case 'primitive':
    case 'binary':
    case 'functionInvocation':
      return false

    case 'variableReference':
      return true

    case 'member':
      return (
        isFullyQualifiedName(ex.object) &&
        (ex.computed || isFullyQualifiedName(ex.property))
      )

    case 'unary':
      return isFullyQualifiedName(ex.value)
  }
}
