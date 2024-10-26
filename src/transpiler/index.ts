import * as parser from '@typescript-eslint/typescript-estree'
import { TSESTree } from '@typescript-eslint/typescript-estree'
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
  TSDeclareFunction,
  TSTypeAliasDeclaration,
  TSInterfaceDeclaration,
} = AST_NODE_TYPES

export function transpile(code: string): string {
  const parserOptions = {
    jsDocParsingMode: 'none' as const,
    loc: true,
    range: false,
  }

  const ast = parser.parse(code, parserOptions)
  assertType(ast, Program)

  const workflowAst = { subworkflows: ast.body.flatMap(parseTopLevelStatement) }
  const workflow = generateStepNames(workflowAst)
  return YAML.stringify(workflow.render(), { lineWidth: 100 })
}

function parseTopLevelStatement(
  node: TSESTree.ProgramStatement,
): SubworkflowAST[] {
  switch (node.type) {
    case FunctionDeclaration:
      return [parseSubworkflows(node)]

    case ImportDeclaration:
      if (
        node.specifiers.some(
          (spec) =>
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
      if (
        node.declaration?.type === FunctionDeclaration &&
        node.declaration.id?.type === Identifier
      ) {
        // Why is "as" needed here?
        return parseTopLevelStatement(
          node.declaration as TSESTree.FunctionDeclarationWithName,
        )
      } else {
        return []
      }

    case TSInterfaceDeclaration:
    case TSTypeAliasDeclaration:
    case TSDeclareFunction:
      // Ignore "type", "interface" and "declare function" at the top-level
      return []

    default:
      throw new WorkflowSyntaxError(
        `Only function definitions, imports and type aliases allowed at the top level, encountered ${node.type}`,
        node.loc,
      )
  }
}

function parseSubworkflows(
  node: TSESTree.FunctionDeclarationWithName,
): SubworkflowAST {
  assertType(node, FunctionDeclaration)

  const nodeParams = node.params
  const workflowParams: WorkflowParameter[] = nodeParams.map((param) => {
    switch (param.type) {
      case Identifier:
        return { name: param.name }

      case AssignmentPattern:
        assertType(param.left, Identifier)

        if (param.left.type !== Identifier) {
          throw new WorkflowSyntaxError(
            'The default value must be an identifier',
            param.left.loc,
          )
        }
        if (param.right.type !== Literal) {
          throw new WorkflowSyntaxError(
            'The default value must be a literal',
            param.right.loc,
          )
        }
        if (
          !(
            typeof param.right.value === 'string' ||
            typeof param.right.value === 'number' ||
            typeof param.right.value === 'boolean' ||
            param.right.value === null
          )
        ) {
          throw new WorkflowSyntaxError(
            'The default value must be a string, number, boolean or null',
            param.left.loc,
          )
        }

        return {
          name: param.left.name,
          default: param.right.value,
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
