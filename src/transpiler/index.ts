/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import * as parser from '@typescript-eslint/typescript-estree'
import { AST_NODE_TYPES } from '@typescript-eslint/utils'
import * as YAML from 'yaml'
import { SubworkflowAST } from '../ast/steps.js'
import { WorkflowSyntaxError } from '../errors.js'
import { WorkflowParameter } from '../ast/workflows.js'
import { generateStepNames } from '../ast/stepnames.js'
import { assertType } from './asserts.js'
import { parseBlockStatement } from './statements.js'

const {
  AssignmentPattern,
  ExportNamedDeclaration,
  FunctionDeclaration,
  Identifier,
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  Literal,
  Program,
} = AST_NODE_TYPES

export function transpile(code: string): string {
  const parserOptions = {
    comment: true,
    loggerFn: false as const,
    loc: true,
    range: true,
  }

  const ast = parser.parse(code, parserOptions)
  assertType(ast, Program)

  const workflowAst = { subworkflows: ast.body.flatMap(parseTopLevelStatement) }
  const workflow = generateStepNames(workflowAst)
  return YAML.stringify(workflow.render())
}

function parseTopLevelStatement(node: any): SubworkflowAST[] {
  switch (node?.type) {
    case FunctionDeclaration:
      return [parseSubworkflows(node)]

    case ImportDeclaration:
      if (
        (node.specifiers as any[]).some(
          (spec: any) =>
            spec.type === ImportNamespaceSpecifier ||
            spec.type === ImportDefaultSpecifier,
        )
      ) {
        throw new WorkflowSyntaxError(
          'Only named imports are allowed',
          node.loc,
        )
      }

      return []

    case ExportNamedDeclaration:
      // "export" keyword is ignored, but a possible function declaration is transpiled.
      if (node?.declaration) {
        return parseTopLevelStatement(node.declaration)
      } else {
        return []
      }

    default:
      throw new WorkflowSyntaxError(
        `Only function declarations and imports allowed on the top level, encountered ${node?.type}`,
        node?.loc,
      )
  }
}

function parseSubworkflows(node: any): SubworkflowAST {
  assertType(node, FunctionDeclaration)

  if (node.id.type !== Identifier) {
    throw new WorkflowSyntaxError(
      'Expected Identifier as a function name',
      node.id.loc,
    )
  }

  const nodeParams = node.params as any[]
  const workflowParams: WorkflowParameter[] = nodeParams.map((param: any) => {
    switch (param.type) {
      case Identifier:
        return { name: param.name as string }

      case AssignmentPattern:
        assertType(param.left, Identifier)
        if (param.right.type !== Literal) {
          throw new WorkflowSyntaxError(
            'The default value must be a literal',
            param.right.loc,
          )
        }

        return {
          name: param.left.name as string,
          default: param.right.value as string,
        }

      default:
        throw new WorkflowSyntaxError(
          'Function parameter must be an identifier or an assignment',
          param.loc,
        )
    }
  })

  const steps = parseBlockStatement(node.body, {})

  return new SubworkflowAST(node.id.name, steps, workflowParams)
}
