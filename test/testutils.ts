/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import * as parser from '@typescript-eslint/typescript-estree'
import { Expression, Term } from '../src/ast/expressions.js'
import {
  NamedWorkflowStep,
  WorkflowStepASTWithNamedNested,
} from '../src/ast/steps.js'
import { convertExpression } from '../src/transpiler.js'

export function primitiveEx(
  primitive:
    | string
    | number
    | boolean
    | null
    | (string | number | boolean | null)[]
    | { [key: string]: string | number | boolean | null },
): Expression {
  return new Expression(new Term(primitive), [])
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

  let ex: any
  if (inputIsJsonObject) {
    ex = (ast.body[0].expression as any).right
  } else {
    ex = ast.body[0].expression
  }

  const transpiled = convertExpression(ex)

  if (transpiled instanceof Expression) {
    return transpiled
  } else {
    return new Expression(new Term(transpiled), [])
  }
}

function isJSONObject(val: string): boolean {
  try {
    JSON.parse(val)
    return true
  } catch (err) {
    return false
  }
}
