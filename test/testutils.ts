/* istanbul ignore file @preserve */

import { expect } from 'chai'
import {
  parse,
  TSESTree,
  AST_NODE_TYPES,
} from '@typescript-eslint/typescript-estree'
import * as YAML from 'yaml'
import { Expression } from '../src/ast/expressions.js'
import { transpileText } from '../src/transpiler/index.js'
import { convertExpression } from '../src/transpiler/parseexpressions.js'

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

  const ast = parse(input)

  if (
    ast.body.length === 0 ||
    ast.body[0].type !== AST_NODE_TYPES.ExpressionStatement
  ) {
    throw new Error()
  }

  let ex: TSESTree.Expression
  if (inputIsJsonObject) {
    if (ast.body[0].expression.type !== AST_NODE_TYPES.AssignmentExpression) {
      throw new Error()
    }

    ex = ast.body[0].expression.right
  } else {
    ex = ast.body[0].expression
  }

  return convertExpression(ex)
}

function isJSONObject(val: string): boolean {
  try {
    JSON.parse(val)
    return true
  } catch {
    return false
  }
}

/**
 * Asserts that transpilation generates an expected output.
 *
 * Transpiles Typescript source in `code` and compares it to the YAML string `expected`.
 */
export function assertTranspiled(code: string, expected: string): void {
  expect(YAML.parse(transpileText(code))).to.deep.equal(YAML.parse(expected))
}

export function assertNotCalled<T>(): T {
  throw new Error('This is not supposed to be called in the unit test')
}
