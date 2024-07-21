import { isRecord } from '../utils.js'

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

export type VariableName = string

// The operator and right-hand side expression of a binary operation
interface BinaryOperation {
  // Operator such as: +, -, <, ==
  binaryOperator: string
  right: Term
}

// Convert a Primitive to a string representation.
// Does not add ${}.
export function primitiveToString(val: Primitive): string {
  if (Array.isArray(val)) {
    const elements = val.map((x) => {
      if (x instanceof Expression) {
        return x.toString()
      } else {
        return primitiveToString(x)
      }
    })

    return `[${elements.join(', ')}]`
  } else if (val !== null && typeof val === 'object') {
    const items = Object.entries(val).map(([k, v]) => {
      if (v instanceof Expression) {
        return [k, v.toString()]
      } else {
        return [k, primitiveToString(v)]
      }
    })
    const elements = items.map(([k, v]) => `"${k}":${v}`)

    return `{${elements.join(',')}}`
  } else {
    return JSON.stringify(val)
  }
}

export function primitiveToExpression(val: Primitive): Expression {
  return new Expression(new PrimitiveTerm(val), [])
}

export function binaryExpression(
  left: Expression,
  operator: string,
  right: Expression,
): Expression {
  const leftTerm = left.isSingleValue()
    ? left.left
    : new ParenthesizedTerm(left)
  const rightTerm = right.isSingleValue()
    ? right.left
    : new ParenthesizedTerm(right)
  return new Expression(leftTerm, [
    { binaryOperator: operator, right: rightTerm },
  ])
}

// Term is an abstract base class for
// (unaryOperator)? ( LITERAL | VARIABLE | LPAREN expr RPAREN | FUNCTION() )
export class Term {
  // Potentially a unary operator: -, +, not
  readonly unaryOperator?: string

  constructor(unaryOperator?: '-' | '+' | 'not') {
    this.unaryOperator = unaryOperator
  }

  isLiteral(): boolean {
    return false
  }

  // Does not add ${}.
  toString(): string {
    throw new Error('Term.toString() should be overridden')
  }

  // Returns a literal for simple terms and a literal expression enclosed in ${} for complex terms.
  toLiteralValueOrLiteralExpression(): LiteralValueOrLiteralExpression {
    throw new Error(
      'Term.toLiteralValueOrLiteralExpression() should be overridden',
    )
  }

  unaryPrefix(): string {
    let opString = this.unaryOperator ?? ''
    if (opString && !['-', '+'].includes(opString)) {
      opString += ' '
    }

    return opString
  }
}

export class PrimitiveTerm extends Term {
  readonly value: Primitive

  constructor(value: Primitive, unaryOperator?: '-' | '+' | 'not') {
    super(unaryOperator)
    this.value = value
  }

  isLiteral(): boolean {
    if (Array.isArray(this.value)) {
      return this.value.every((x) => {
        if (x instanceof Expression) {
          return x.isLiteral()
        } else {
          return (
            typeof x === 'string' ||
            typeof x === 'number' ||
            typeof x === 'boolean' ||
            x === null
          )
        }
      })
    } else if (isRecord(this.value)) {
      return Object.values(this.value).every((x) => {
        if (x instanceof Expression) {
          return x.isLiteral()
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
        typeof this.value === 'string' ||
        typeof this.value === 'number' ||
        typeof this.value === 'boolean' ||
        this.value === null
      )
    }
  }

  toString(): string {
    const opString = super.unaryPrefix()
    const val = this.value
    if (Array.isArray(val)) {
      const elements = val.map((t) => {
        if (t instanceof Expression) {
          return t.toString()
        } else {
          return primitiveToString(t)
        }
      })
      return `${opString}[${elements.join(', ')}]`
    } else if (isRecord(val)) {
      const elements = Object.entries(val).map(([k, v]) => {
        if (v instanceof Expression) {
          return `"${k}": ${v.toString()}`
        } else {
          return `"${k}": ${primitiveToString(v)}`
        }
      })
      return `${opString}{${elements.join(', ')}}`
    } else {
      return `${opString}${JSON.stringify(val)}`
    }
  }

  toLiteralValueOrLiteralExpression(): LiteralValueOrLiteralExpression {
    if (typeof this.value === 'number') {
      if (this.unaryOperator === '-') {
        return -this.value
      } else {
        return this.value
      }
    } else if (typeof this.value === 'string' && !this.unaryOperator) {
      return this.value
    } else if (typeof this.value === 'boolean' && !this.unaryOperator) {
      return this.value
    } else if (this.value === null) {
      return this.value
    } else if (Array.isArray(this.value)) {
      return this.value.map((x) => {
        if (x instanceof Expression) {
          return x.toLiteralValueOrLiteralExpression()
        } else if (Array.isArray(x) || isRecord(x)) {
          return new PrimitiveTerm(x).toLiteralValueOrLiteralExpression()
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
    } else if (isRecord(this.value)) {
      return Object.fromEntries(
        Object.entries(this.value).map(([k, v]) => {
          if (v instanceof Expression) {
            return [k, v.toLiteralValueOrLiteralExpression()]
          } else if (Array.isArray(v) || isRecord(v)) {
            return [k, new PrimitiveTerm(v).toLiteralValueOrLiteralExpression()]
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
      return `\${${this.toString()}}`
    }
  }
}

// Variable name: a plain identifier (y, year), property access (person.name) or list
// element accessor (names[3]) or a combination of the above
export class VariableReferenceTerm extends Term {
  readonly variableName: VariableName

  constructor(variableName: VariableName, unaryOperator?: '+' | '-' | 'not') {
    super(unaryOperator)
    this.variableName = variableName
  }

  toString(): string {
    return `${super.unaryPrefix()}${this.variableName.toString()}`
  }

  toLiteralValueOrLiteralExpression(): LiteralValueOrLiteralExpression {
    return `\${${this.toString()}}`
  }
}

// LPAREN expr RPAREN
export class ParenthesizedTerm extends Term {
  readonly value: Expression

  constructor(value: Expression, unaryOperator?: '+' | '-' | 'not') {
    super(unaryOperator)
    this.value = value
  }

  toString(): string {
    return `${super.unaryPrefix()}(${this.value.toString()})`
  }

  toLiteralValueOrLiteralExpression(): LiteralValueOrLiteralExpression {
    return `\${${this.toString()}}`
  }
}

// Function invocation with anonymous parameters: http.get("http://example.com")
export class FunctionInvocationTerm extends Term {
  readonly functionName: string
  readonly arguments: Expression[]

  constructor(
    functionName: string,
    argumentExpressions: Expression[],
    unaryOperator?: '+' | '-' | 'not',
  ) {
    super(unaryOperator)
    this.functionName = functionName
    this.arguments = argumentExpressions
  }

  toString(): string {
    const argumentStrings = this.arguments.map((x) => x.toString())
    return `${super.unaryPrefix()}${this.functionName}(${argumentStrings.join(', ')})`
  }

  toLiteralValueOrLiteralExpression(): LiteralValueOrLiteralExpression {
    return `\${${this.toString()}}`
  }
}

// expr: term (op term)*
export class Expression {
  readonly left: Term
  readonly rest: BinaryOperation[]

  constructor(left: Term, rest: BinaryOperation[]) {
    this.left = left
    this.rest = rest
  }

  isLiteral(): boolean {
    return this.rest.length === 0 && this.left.isLiteral()
  }

  isSingleValue(): boolean {
    return (
      this.rest.length === 0 &&
      (this.left.isLiteral() ||
        this.left instanceof VariableReferenceTerm ||
        this.left instanceof FunctionInvocationTerm)
    )
  }

  isFullyQualifiedName(): boolean {
    return this.rest.length === 0 && this.left instanceof VariableReferenceTerm
  }

  // Does not add ${}.
  toString(): string {
    const left = this.left.toString()
    const parts = this.rest.map(
      (x) => `${x.binaryOperator} ${x.right.toString()}`,
    )
    parts.unshift(left)

    return parts.join(' ')
  }

  // Returns a literal for simple expressions and a literal expression enclosed in ${} for complex expressions.
  toLiteralValueOrLiteralExpression(): LiteralValueOrLiteralExpression {
    if (this.rest.length === 0) {
      return this.left.toLiteralValueOrLiteralExpression()
    } else {
      return `\${${this.toString()}}`
    }
  }
}
