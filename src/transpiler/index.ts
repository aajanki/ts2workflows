import fs from 'node:fs'
import * as path from 'node:path'
import {
  AST_NODE_TYPES,
  parseAndGenerateServices,
  ParseAndGenerateServicesResult,
  TSESTree,
  TSESTreeOptions,
} from '@typescript-eslint/typescript-estree'
import ts from 'typescript'
import * as YAML from 'yaml'
import { SubworkflowAST } from '../ast/steps.js'
import {
  InternalTranspilingError,
  IOError,
  WorkflowSyntaxError,
} from '../errors.js'
import {
  Subworkflow,
  WorkflowApp,
  WorkflowParameter,
} from '../ast/workflows.js'
import { generateStepNames } from '../ast/stepnames.js'
import { parseStatement } from './statements.js'
import { transformAST } from './transformations.js'
import { findCalledFunctionDeclarations } from './linker.js'

const workflowCache = new Map<string, WorkflowApp>()

export function transpile(
  input: { filename?: string; read: () => string },
  tsconfigPath: string | undefined,
  linkSubworkflows: boolean,
): string {
  const { ast, services } = parseMainFile(input, tsconfigPath)
  const inputWorkflow = generateStepNames({
    subworkflows: ast.body.flatMap(parseTopLevelStatement),
  })

  if (linkSubworkflows && tsconfigPath && services.program && input.filename) {
    const canonicalInput = path.join(process.cwd(), input.filename)
    workflowCache.set(canonicalInput, inputWorkflow)

    const subworkflows = generateLinkedOutput(
      canonicalInput,
      tsconfigPath,
      services.program,
    )
    const combinedWorkflow = new WorkflowApp(subworkflows)
    return toYAMLString(combinedWorkflow)
  } else {
    return toYAMLString(inputWorkflow)
  }
}

export function transpileText(sourceCode: string) {
  const parserOptions = eslintParserOptions()
  const { ast } = parseAndGenerateServices(sourceCode, parserOptions)
  const workflow = generateStepNames({
    subworkflows: ast.body.flatMap(parseTopLevelStatement),
  })
  return toYAMLString(workflow)
}

function parseMainFile(
  input: { filename?: string; read: () => string },
  tsconfigPath: string | undefined,
): ParseAndGenerateServicesResult<TSESTreeOptions> {
  const parserOptions = eslintParserOptions(input.filename, tsconfigPath)

  if (tsconfigPath && input.filename) {
    const cwd = process.cwd()
    const configJSON: unknown = JSON.parse(
      fs.readFileSync(path.join(cwd, tsconfigPath), 'utf-8'),
    )
    const { options } = ts.parseJsonConfigFileContent(configJSON, ts.sys, cwd)
    const program = ts.createProgram([input.filename], options)
    const mainSourceFile = program.getSourceFile(input.filename)

    if (mainSourceFile === undefined) {
      throw new IOError(`Source file ${input.filename} not found`, 'ENOENT')
    }

    return parseAndGenerateServices(mainSourceFile, parserOptions)
  } else {
    return parseAndGenerateServices(input.read(), parserOptions)
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
  canonicalInputName: string,
  tsconfigPath: string,
  program: ts.Program,
): Subworkflow[] {
  const mainSourceFile = program
    .getSourceFiles()
    .find((x) => x.fileName === canonicalInputName)

  if (mainSourceFile === undefined) {
    throw new InternalTranspilingError(
      `Typescript SourceFile object not found for ${canonicalInputName}`,
    )
  }

  const typeChecker = program.getTypeChecker()
  const functions = findCalledFunctionDeclarations(typeChecker, mainSourceFile)
  const subworkflows = functions
    .filter((f) => !isAmbientFunctionDeclaration(f))
    .map((decl) => tsFunctionToSubworkflow(tsconfigPath, decl))

  return subworkflows
}

function getCachedWorkflow(
  filename: string,
  tsconfigPath: string,
): WorkflowApp {
  const cached = workflowCache.get(filename)

  if (cached) {
    return cached
  } else {
    const parserOptions = eslintParserOptions(filename, tsconfigPath)
    const code = fs.readFileSync(filename, 'utf8')
    const { ast } = parseAndGenerateServices(code, parserOptions)
    const workflow = generateStepNames({
      subworkflows: ast.body.flatMap(parseTopLevelStatement),
    })

    workflowCache.set(filename, workflow)

    return workflow
  }
}

function tsFunctionToSubworkflow(
  tsconfigPath: string,
  decl: ts.FunctionDeclaration,
): Subworkflow {
  if (!decl.name) {
    throw new InternalTranspilingError("Anonymous function can't be transpiled")
  }

  const filename = decl.getSourceFile().fileName
  const wfname = decl.name.getText()
  const workflow = getCachedWorkflow(filename, tsconfigPath)
  const subworkflow = workflow.getSubworkflowByName(wfname)

  if (!subworkflow) {
    throw new InternalTranspilingError(
      `Failed to find subworkflow ${wfname} in file ${filename}`,
    )
  }

  return subworkflow
}

/**
 * Returns true if node is an ambient function declaration.
 *
 * The two cases that return true:
 *   - "declare function"
 *   - "declare namespace { function ... }"
 */
export function isAmbientFunctionDeclaration(
  node: ts.FunctionDeclaration,
): boolean {
  if (isAmbient(node)) {
    return true
  }

  let decl: ts.FunctionDeclaration | ts.ModuleDeclaration = node
  while (
    ts.isModuleBlock(decl.parent) &&
    ts.isModuleDeclaration(decl.parent.parent)
  ) {
    decl = decl.parent.parent

    if (isAmbient(decl)) {
      return true
    }
  }

  return false
}

function isAmbient(
  node: ts.FunctionDeclaration | ts.ModuleDeclaration,
): boolean {
  return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Ambient) !== 0
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
