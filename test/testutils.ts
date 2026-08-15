/* istanbul ignore file @preserve */

import {
  parse,
  TSESTree,
  AST_NODE_TYPES,
} from '@typescript-eslint/typescript-estree'
import * as YAML from 'yaml'
import snapshot from 'snap-shot-it'
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
 * A test case that transpiles code and compares it to a saved snapshot.
 */
export function transpileAndSnapshotTest(code: string): () => void {
  return () => {
    snapshot(YAML.parse(transpileText(code)))
  }
}
