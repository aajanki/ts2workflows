import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import * as parser from '@typescript-eslint/typescript-estree'
import { Expression, PrimitiveTerm } from '../src/ast/expressions.js'
import {
  NamedWorkflowStep,
  WorkflowStepASTWithNamedNested,
} from '../src/ast/steps.js'
import { convertExpression } from '../src/transpiler/expressions.js'

export function primitiveEx(
  primitive:
    | string
    | number
    | boolean
    | null
    | (string | number | boolean | null)[]
    | Record<string, string | number | boolean | null>,
): Expression {
  return new Expression(new PrimitiveTerm(primitive))
}

export function namedStep(
  name: string,
  step: WorkflowStepASTWithNamedNested,
): NamedWorkflowStep {
  return {
    name,
    step,
  }
}

export function parseExpression(expressionString: string): Expression {
  // The parser chokes on JSON objects. Check if the input is JSON and special case
  let input: string
  let inputIsJsonObject: boolean
  if (isJSONObject(expressionString)) {
    inputIsJsonObject = true
    input = '_ = ' + expressionString
  } else {
    inputIsJsonObject = false
    input = expressionString
  }

  const ast = parser.parse(input)

  if (
    ast.body.length === 0 ||
    ast.body[0].type !== AST_NODE_TYPES.ExpressionStatement
  ) {
    throw new Error()
  }

  let ex: unknown
  if (inputIsJsonObject) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    ex = (ast.body[0].expression as any).right
  } else {
    ex = ast.body[0].expression
  }

  return convertExpression(ex)
}

function isJSONObject(val: string): boolean {
  try {
    JSON.parse(val)
    return true
  } catch (err) {
    return false
  }
}
