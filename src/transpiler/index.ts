import fs from 'node:fs'
import * as path from 'node:path'
import {
  AST_NODE_TYPES,
  parseAndGenerateServices,
  ParseAndGenerateServicesResult,
  ParserServices,
  TSESTree,
  TSESTreeOptions,
} from '@typescript-eslint/typescript-estree'
import ts from 'typescript'
import * as YAML from 'yaml'
import { SubworkflowAST } from '../ast/steps.js'
import { InternalTranspilingError, WorkflowSyntaxError } from '../errors.js'
import { WorkflowApp, WorkflowParameter } from '../ast/workflows.js'
import { generateStepNames } from '../ast/stepnames.js'
import { parseStatement } from './statements.js'
import { transformAST } from './transformations.js'
import {
  findCalledFunctionDeclarations,
  getFunctionDeclarationByName,
  isAmbientFunctionDeclaration,
} from './linker.js'

export function transpile(
  inputFile: string,
  tsconfigPath: string | undefined,
  linkSubworkflows: boolean,
): string {
  const { ast, services } = parseMainFile(inputFile, tsconfigPath)

  if (linkSubworkflows && tsconfigPath && services.program) {
    return generateLinkedOutput(inputFile, tsconfigPath, services)
  } else {
    const workflowAst = {
      subworkflows: ast.body.flatMap(parseTopLevelStatement),
    }
    const workflow = generateStepNames(workflowAst)
    return toYAMLString(workflow)
  }
}

export function transpileText(sourceCode: string) {
  const parserOptions = eslintParserOptions()
  const { ast } = parseAndGenerateServices(sourceCode, parserOptions)
  const workflowAst = {
    subworkflows: ast.body.flatMap(parseTopLevelStatement),
  }
  const workflow = generateStepNames(workflowAst)
  return toYAMLString(workflow)
}

function parseMainFile(
  inputFile: string,
  tsconfigPath: string | undefined,
): ParseAndGenerateServicesResult<TSESTreeOptions> {
  const parserOptions = eslintParserOptions(inputFile, tsconfigPath)

  if (tsconfigPath && inputFile && inputFile != '-') {
    const cwd = process.cwd()
    const configJSON: unknown = JSON.parse(
      fs.readFileSync(path.join(cwd, tsconfigPath), 'utf-8'),
    )
    const { options } = ts.parseJsonConfigFileContent(configJSON, ts.sys, cwd)
    const program = ts.createProgram([inputFile], options)
    const mainSourceFile = program.getSourceFile(inputFile)

    if (mainSourceFile === undefined) {
      throw new InternalTranspilingError('getSourceFile returned undefined!')
    }

    return parseAndGenerateServices(mainSourceFile, parserOptions)
  } else {
    const inputIsStdIn = inputFile === '-'
    const inp = inputIsStdIn ? process.stdin.fd : inputFile
    const code = fs.readFileSync(inp, 'utf8')

    return parseAndGenerateServices(code, parserOptions)
  }
}

function eslintParserOptions(
  inputFile?: string,
  tsconfigPath?: string,
): TSESTreeOptions {
  const opts: TSESTreeOptions = {
    jsDocParsingMode: 'none' as const,
    loc: true,
    range: false,
    filePath: inputFile,
  }

  if (tsconfigPath) {
    opts.projectService = {
      defaultProject: tsconfigPath,
    }
  }

  return opts
}

function generateLinkedOutput(
  inputFile: string,
  tsconfigPath: string,
  services: ParserServices,
) {
  const program = services.program
  if (program === null) {
    throw new InternalTranspilingError('program is null')
  }

  const canonicalInputName = path.join(process.cwd(), inputFile)
  const mainSourceFile = program
    .getSourceFiles()
    .find((x) => x.fileName === canonicalInputName)

  if (mainSourceFile === undefined) {
    throw new InternalTranspilingError(
      `Typescript SourceFile object not found for ${canonicalInputName}`,
    )
  }

  const typeChecker = program.getTypeChecker()
  const mainFunction = getFunctionDeclarationByName(mainSourceFile, 'main')

  if (!mainFunction) {
    throw new Error('"main" function not found')
  }

  const functions = findCalledFunctionDeclarations(typeChecker, mainFunction)
  const transpiled = functions
    .filter((f) => !isAmbientFunctionDeclaration(f))
    .map((decl) => {
      const parserOptions: TSESTreeOptions = eslintParserOptions(
        decl.getSourceFile().fileName,
        tsconfigPath,
      )
      const { ast } = parseAndGenerateServices(
        decl.getSourceFile(),
        parserOptions,
      )
      const workflowAst = {
        subworkflows: ast.body.flatMap(parseTopLevelStatement),
      }
      const workflow = generateStepNames(workflowAst)
      return toYAMLString(workflow)
    })

  return transpiled.join('\n')
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
    case AST_NODE_TYPES.EmptyStatement:
      // Ignore "type", "interface", "declare function" and empty statements at the top-level
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
  const workflowParams = parseWorkflowParams(node.params)
  const steps = transformAST(parseStatement(node.body, {}))

  if (steps.length === 0) {
    throw new WorkflowSyntaxError(
      'Empty subworkflow body is not allowed on GCP Workflows',
      node.body.loc,
    )
  }

  return new SubworkflowAST(node.id.name, steps, workflowParams)
}

function parseWorkflowParams(
  nodeParams: TSESTree.Parameter[],
): WorkflowParameter[] {
  return nodeParams.map((param) => {
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

/**
 * Print the workflow as a YAML string.
 */
export function toYAMLString(workflow: WorkflowApp): string {
  return YAML.stringify(workflow.render(), {
    lineWidth: 100,
  })
}
