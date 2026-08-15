#!/usr/bin/env node

/**
 * Generates .ts source for blocking functions metadata.
 *
 * Reads Workflows expression helper and connector type annotations from
 * types/workflowslib.d.ts and outputs a .ts file.
 */

import * as fs from 'node:fs'
import path from 'node:path'
import { parse, AST_NODE_TYPES } from '@typescript-eslint/typescript-estree'
import { mergeRight } from 'ramda'

const inputFile = 'types/workflowslib.d.ts'
const outputFile = 'src/transpiler/generated/functionMetadata.ts'

function main() {
  const parserOptions = {
    loggerFn: false,
  }

  const sourceCode = fs.readFileSync(inputFile, 'utf8')
  const ast = parse(sourceCode, parserOptions)
  const functions = ast.body
    .flatMap((node) => extractFunctionDefinitions(node, {}))
    .filter((metadata) => isBlockingFunction(metadata.functionName))
  const generated = generateCode(functions)

  const outputDir = path.dirname(outputFile)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }

  fs.writeFileSync(outputFile, generated)
}

function generateCode(functions) {
  const rawFunctions = functions.map((metadata) => {
    return [metadata.functionName, metadata.argumentNames]
  })

  return `// This is a generated file, do not modify!

// Blocking function names and argument names
export const blockingFunctions = new Map(${JSON.stringify(rawFunctions, null, 2)})
`
}

function isBlockingFunction(functionName) {
  return (
    [
      'sys.log',
      'sys.sleep',
      'sys.sleep_until',
      'events.await_callback',
    ].includes(functionName) ||
    (functionName.startsWith('http.') &&
      !functionName.startsWith('http.default_')) ||
    functionName.startsWith('googleapis.')
  )
}

function extractFunctionDefinitions(node, ctx) {
  switch (node.type) {
    case AST_NODE_TYPES.ExportNamedDeclaration:
      if (node.declaration === null) {
        return []
      } else if (
        node.declaration.type == AST_NODE_TYPES.TSDeclareFunction ||
        node.declaration.type === AST_NODE_TYPES.TSModuleDeclaration ||
        node.declaration.type === AST_NODE_TYPES.TSInterfaceDeclaration
      ) {
        return extractFunctionDefinitions(node.declaration, ctx)
      } else if (
        node.declaration.type === AST_NODE_TYPES.TSTypeAliasDeclaration ||
        node.declaration.type === AST_NODE_TYPES.VariableDeclaration
      ) {
        return []
      } else {
        throw new Error(
          `Declaration of ${node.declaration.type} not implemented`,
        )
      }

    case AST_NODE_TYPES.TSModuleDeclaration:
      if (node.kind === 'namespace') {
        const namespace = extractNamespace(node.id)
        const fullNamespace = ctx.namespace
          ? `${ctx.namespace}.${namespace}`
          : namespace
        const nestedCtx = mergeRight(ctx, { namespace: fullNamespace })
        return node.body.body.flatMap((node2) => {
          return extractFunctionDefinitions(node2, nestedCtx)
        })
      } else {
        throw new Error(`Unexpected module that is not a namespace`)
      }

    case AST_NODE_TYPES.TSDeclareFunction:
      return [
        {
          functionName: parseFunctionName(node.id?.name ?? '', ctx.namespace),
          argumentNames: parseFunctionParamNames(node.params),
        },
      ]

    case AST_NODE_TYPES.TSInterfaceDeclaration:
    case AST_NODE_TYPES.TSTypeAliasDeclaration:
    case AST_NODE_TYPES.VariableDeclaration:
      // Ignore type and variable definitions
      return []

    default:
      console.log(`Skipping a node of type ${node.type}`)
      console.log(JSON.stringify(node))
      return []
  }
}

function extractNamespace(id) {
  switch (id.type) {
    case AST_NODE_TYPES.Identifier:
      return id.name
    case AST_NODE_TYPES.ThisExpression:
      return 'this'
    case AST_NODE_TYPES.TSQualifiedName:
      return `${extractNamespace(id.left)}.${id.right.name}`
  }
}

function parseFunctionName(name, namespace) {
  const namespacePrefix = namespace ? `${namespace}.` : ''

  // Revert the convention of using underscore prefix for functions names
  // conflicting with Javascript keywords
  const fixedName = name === '_delete' ? 'delete' : name

  return `${namespacePrefix}${fixedName}`
}

function parseFunctionParamNames(params) {
  return params.map((param) => {
    if (param.type !== AST_NODE_TYPES.Identifier) {
      throw new Error(`Identifier expected, got ${param.type}`)
    }

    return param.name
  })
}

main()
