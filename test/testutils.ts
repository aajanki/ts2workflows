import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import { parse, TSESTree } from '@typescript-eslint/typescript-estree'
import { Expression } from '../src/ast/expressions.js'
import {
  NamedWorkflowStep,
  WorkflowStepASTWithNamedNested,
} from '../src/ast/steps.js'
import { convertExpression } from '../src/transpiler/expressions.js'

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
