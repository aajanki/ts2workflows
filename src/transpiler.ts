/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import * as parser from '@typescript-eslint/typescript-estree'
import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import * as YAML from 'yaml'
import { AssignStepAST, CallStepAST, VariableAssignment } from './ast/steps.js'
import {
  Expression,
  ParenthesizedExpression,
  Primitive,
  Term,
  VariableReference,
  primitiveToString,
} from './ast/expressions.js'
import { isRecord } from './utils.js'
import { WorkflowSyntaxError } from './errors.js'

const {
  Program,
  ArrayExpression,
  UnaryExpression,
  BinaryExpression,
  ObjectExpression,
  VariableDeclaration,
  VariableDeclarator,
  ExpressionStatement,
  Literal,
  Identifier,
  LogicalExpression,
  MemberExpression,
  CallExpression,
} = AST_NODE_TYPES

export function transpile(code: string): string {
  const parserOptions = {
    comment: true,
    loggerFn: false as const,
    loc: true,
    range: true,
  }
  const ast = parser.parse(code, parserOptions)

  if (ast.type !== Program) {
    throw new Error('Expected type "Program"')
  }

  const transpiled = ast.body.map(convertType).map((x) => {
    if (typeof x === 'undefined') {
      return undefined
    } else if (x instanceof Expression) {
      return x.toString()
    } else if (
      typeof x === 'string' ||
      typeof x === 'number' ||
      typeof x === 'boolean' ||
      Array.isArray(x) ||
      isRecord(x) ||
      x === null
    ) {
      return primitiveToString(x)
    } else {
      return x.render()
    }
  })

  return YAML.stringify(transpiled)
}

function convertType(node: any) {
  switch (node?.type) {
    case VariableDeclaration:
      return convertVariableDeclarations(node.declarations)

    case ExpressionStatement:
      if (node.expression.type === CallExpression) {
        return convertCallStep(node.expression)
      } else {
        return convertExpression(node.expression)
      }

    default:
      throw new Error(`Not implemented node type: ${node?.type}`)
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

    const val = convertExpression(decl.init)
    let valExpression: Expression
    if (val instanceof Expression) {
      valExpression = val
    } else {
      valExpression = new Expression(new Term(val), [])
    }

    return [decl.id.name as string, valExpression]
  })

  return new AssignStepAST(assignments)
}

function convertCallStep(node: any): CallStepAST {
  const calleeExpression = convertExpression(node.callee)

  if (calleeExpression instanceof Expression && calleeExpression.isFullyQualifiedName()) {
    const calleeName = calleeExpression.left.toString()
   
    // FIXME
    const argumentValues = node.arguments.map((arg: any) => {
      if (arg.type === Literal) {
        return arg.value
      } else {
        throw new WorkflowSyntaxError(`Not implemented argument type: ${arg.type}`, arg.loc)
      }
    })

    return new CallStepAST(calleeName)
  } else {
    throw new WorkflowSyntaxError('Callee should be a qualified name', node.loc)
  }
}

export function convertExpression(instance: any): Primitive | Expression {
  switch (instance.type) {
    case ArrayExpression:
      return (instance.elements as any[]).map(convertExpression)

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

    default:
      throw new WorkflowSyntaxError(
        `Not implemented expression type: ${instance.type}`,
        instance.loc,
      )
  }
}

function convertBinaryExpression(instance: any): Expression {
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

  const leftEx = convertExpression(instance.left)
  const rightEx = convertExpression(instance.right)

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

  const ex = convertExpression(instance.argument)

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

function convertObjectExpression(node: any) {
  const properties = node.properties as {
    key: { type: AST_NODE_TYPES; value: string | number }
    value: any
  }[]

  return Object.fromEntries(
    properties.map(({ key, value }) => {
      // TODO: Identifier
      if (key.type !== Literal) {
        throw new WorkflowSyntaxError(
          `Not implemented object key type: ${key.type}`,
          node.loc,
        )
      }

      const keyPrimitive = key.value
      const val = convertExpression(value)
      return [keyPrimitive, val]
    }),
  )
}

function convertMemberExpression(memberExpression: any): VariableReference {
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
    let member: string
    const ex = convertExpression(memberExpression.property)
    if (ex instanceof Expression) {
      member = ex.toString()
    } else {
      member = primitiveToString(ex)
    }

    return new VariableReference(`${objectName}[${member}]`)
  } else {
    return new VariableReference(
      `${objectName}.${memberExpression.property.name}`,
    )
  }
}
