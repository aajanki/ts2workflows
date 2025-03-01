import {
  AST_NODE_TYPES,
  parseAndGenerateServices,
  TSESTree,
  TSESTreeOptions,
} from '@typescript-eslint/typescript-estree'
import * as YAML from 'yaml'
import { SubworkflowAST } from '../ast/steps.js'
import { WorkflowSyntaxError } from '../errors.js'
import { WorkflowParameter } from '../ast/workflows.js'
import { generateStepNames } from '../ast/stepnames.js'
import { parseStatement } from './statements.js'

export function transpile(
  code: string,
  inputFile?: string,
  tsconfigPath?: string,
): string {
  const parserOptions: TSESTreeOptions = {
    jsDocParsingMode: 'none' as const,
    loc: true,
    range: false,
  }

  if (tsconfigPath && inputFile && inputFile != '-') {
    parserOptions.filePath = inputFile
    parserOptions.projectService = {
      defaultProject: tsconfigPath,
    }
  }

  const { ast } = parseAndGenerateServices(code, parserOptions)
  const workflowAst = { subworkflows: ast.body.flatMap(parseTopLevelStatement) }
  const workflow = generateStepNames(workflowAst)
  return YAML.stringify(workflow.render(), { lineWidth: 100 })
}

function parseTopLevelStatement(
  node: TSESTree.ProgramStatement,
): SubworkflowAST[] {
  switch (node.type) {
    case AST_NODE_TYPES.FunctionDeclaration:
      return [parseSubworkflows(node)]

    case AST_NODE_TYPES.ImportDeclaration:
      if (
        node.specifiers.some(
          (spec) =>
            spec.type === AST_NODE_TYPES.ImportNamespaceSpecifier ||
            spec.type === AST_NODE_TYPES.ImportDefaultSpecifier,
        )
      ) {
        throw new WorkflowSyntaxError(
          'Only named imports are allowed',
          node.loc,
        )
      }

      return []

    case AST_NODE_TYPES.ExportNamedDeclaration:
      // "export" keyword is ignored, but a possible function declaration is transpiled.
      if (
        node.declaration?.type === AST_NODE_TYPES.FunctionDeclaration &&
        node.declaration.id?.type === AST_NODE_TYPES.Identifier
      ) {
        // Why is "as" needed here?
        return parseTopLevelStatement(
          node.declaration as TSESTree.FunctionDeclarationWithName,
        )
      } else {
        return []
      }

    case AST_NODE_TYPES.TSInterfaceDeclaration:
    case AST_NODE_TYPES.TSTypeAliasDeclaration:
    case AST_NODE_TYPES.TSDeclareFunction:
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
  const nodeParams = node.params
  const workflowParams: WorkflowParameter[] = nodeParams.map((param) => {
    switch (param.type) {
      case AST_NODE_TYPES.Identifier:
        if (param.optional) {
          return { name: param.name, default: null }
        } else {
          return { name: param.name }
        }

      case AST_NODE_TYPES.AssignmentPattern:
        return parseSubworkflowDefaultArgument(param)

      default:
        throw new WorkflowSyntaxError(
          'Function parameter must be an identifier or an assignment',
          param.loc,
        )
    }
  })

  const steps = parseStatement(node.body, {})

  return new SubworkflowAST(node.id.name, steps, workflowParams)
}

function parseSubworkflowDefaultArgument(param: TSESTree.AssignmentPattern) {
  if (param.left.type !== AST_NODE_TYPES.Identifier) {
    throw new WorkflowSyntaxError(
      'The default value must be an identifier',
      param.left.loc,
    )
  }
  if (param.left.optional) {
    throw new WorkflowSyntaxError(
      "Parameter can't have default value and initializer",
      param.left.loc,
    )
  }
  const name = param.left.name

  let defaultValue: string | number | boolean | null
  if (
    param.right.type === AST_NODE_TYPES.Identifier &&
    param.right.name === 'undefined'
  ) {
    defaultValue = null
  } else if (
    param.right.type === AST_NODE_TYPES.Literal &&
    (typeof param.right.value === 'string' ||
      typeof param.right.value === 'number' ||
      typeof param.right.value === 'boolean' ||
      param.right.value === null)
  ) {
    defaultValue = param.right.value
  } else {
    throw new WorkflowSyntaxError(
      'The default value must be a literal number, string, boolean, null, or undefined',
      param.right.loc,
    )
  }

  return {
    name,
    default: defaultValue,
  }
}
