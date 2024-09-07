#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */

/**
 * Generates .ts source for blocking functions metadata.
 *
 * Reads Workflows expression helper and connector type annotations from
 * types/workflowslib.d.ts and outputs a .ts file.
 */

import * as fs from 'node:fs'
import path from 'node:path'
import * as parser from '@typescript-eslint/typescript-estree'
import { AST_NODE_TYPES } from '@typescript-eslint/utils'

const inputFile = 'types/workflowslib.d.ts'
const outputFile = 'src/transpiler/generated/functionMetadata.ts'

const {
  ExportNamedDeclaration,
  Identifier,
  TSDeclareFunction,
  TSInterfaceDeclaration,
  TSModuleDeclaration,
  VariableDeclaration,
} = AST_NODE_TYPES

interface TypedNode {
  type: string
}
interface FunctionMetadata {
  functionName: string
  argumentNames: string[]
}

interface ParsingContext {
  namespace: string | undefined
}

function main() {
  const parserOptions = {
    loggerFn: false as const,
  }

  const sourceCode = fs.readFileSync(inputFile, 'utf8')
  const ast = parser.parse(sourceCode, parserOptions)
  const functions = ast.body
    .flatMap((node) => {
      return extractFunctionDefinitions(node, { namespace: undefined })
    })
    .filter((metadata) => isBlockingFunction(metadata.functionName))
  const generated = generateCode(functions)

  const outputDir = path.dirname(outputFile)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }

  fs.writeFileSync(outputFile, generated)
}

function generateCode(functions: FunctionMetadata[]) {
  const rawFunctions = functions.map((metadata) => {
    return [metadata.functionName, metadata.argumentNames]
  })

  return `// This is a generated file, do not modify!

// Blocking function names and argument names
export const blockingFunctions = new Map(${JSON.stringify(rawFunctions, null, 2)})
`
}

function isBlockingFunction(functionName: string): boolean {
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

function extractFunctionDefinitions(
  node: any,
  ctx: ParsingContext,
): FunctionMetadata[] {
  switch (node.type) {
    case ExportNamedDeclaration:
      if (node.declaration) {
        return extractFunctionDefinitions(node.declaration, ctx)
      } else {
        return []
      }

    case TSModuleDeclaration:
      if (node.kind === 'namespace') {
        const namespace = node.id.name as string
        const fullNamespace = ctx.namespace
          ? `${ctx.namespace}.${namespace}`
          : namespace
        const nestedCtx = Object.assign({}, ctx, { namespace: fullNamespace })
        const body = node.body.body as any[]
        return body.flatMap((node2) => {
          return extractFunctionDefinitions(node2, nestedCtx)
        })
      } else {
        throw new Error(`Unexpected module that is not a namespace`)
      }

    case TSDeclareFunction:
      assertType(node.id as TypedNode, Identifier)

      return [
        {
          functionName: parseFunctionName(
            node.id.name as string,
            ctx.namespace,
          ),
          argumentNames: parseFunctionParamNames(node.params as any[]),
        },
      ]

    case TSInterfaceDeclaration:
    case VariableDeclaration:
      // Ignore type and variable definitions
      return []

    default:
      console.log(`Skipping a node of type ${node.type}`)
      console.log(JSON.stringify(node))
      return []
  }
}

function parseFunctionName(
  name: string,
  namespace: string | undefined,
): string {
  const namespacePrefix = namespace ? `${namespace}.` : ''

  // Revert the convention of using underscore prefix for functions names
  // conflicting with Javascript keywords
  const fixedName = name === '_delete' ? 'delete' : name

  return `${namespacePrefix}${fixedName}`
}

function parseFunctionParamNames(params: any[]): string[] {
  return params.map((param) => {
    assertType(param as TypedNode, Identifier)

    return param.name as string
  })
}

function assertType(node: TypedNode, expectedType: string): void {
  if (node?.type !== expectedType) {
    throw new Error(`Expected ${expectedType}, got ${node?.type}`)
  }
}

main()
