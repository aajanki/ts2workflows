/* eslint-disable @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion */

import { expect } from 'chai'
import ts from 'typescript'
import {
  findCalledFunctionDeclarations,
  getFunctionDeclarationByName,
} from '../src/transpiler/linker'

describe('Function finder', () => {
  it('finds nested function calls', () => {
    const sources = {
      'main.ts': `
        function main() {
          return compute()
        }

        function compute() {
          return getFirstValue() + getSecondValue()
        }

        function getFirstValue() {
          return 1
        }

        function getSecondValue() {
          return 2
        }`,
    }

    const functions = listFunctions(sources, 'main.ts', 'main')

    expect(functions).to.have.members([
      'main',
      'compute',
      'getFirstValue',
      'getSecondValue',
    ])
  })
})

function listFunctions(
  sources: Record<string, string>,
  mainFile: string,
  mainFunctionName: string,
): string[] {
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2015,
    skipLibCheck: true,
  }

  const virtualFiles: Record<string, ts.SourceFile> = Object.fromEntries(
    Object.entries(sources).map(([name, source]) => {
      return [name, ts.createSourceFile(name, source, ts.ScriptTarget.ES2022)]
    }),
  )

  const defaultHost = ts.createCompilerHost(compilerOptions)
  const compilerHost: ts.CompilerHost = {
    ...defaultHost,
    getSourceFile: (fname, languageVersion) => {
      if (fname in virtualFiles) {
        return virtualFiles[fname]
      } else {
        return defaultHost.getSourceFile(fname, languageVersion)
      }
    },
    fileExists: (fname) =>
      fname in virtualFiles || defaultHost.fileExists(fname),
    readFile: (fname) => {
      if (fname in sources) {
        return sources[fname]
      } else {
        return defaultHost.readFile(fname)
      }
    },
    //writeFile: (_fname, _content) => {},
    getCurrentDirectory: () => '',
  }
  const program = ts.createProgram([mainFile], compilerOptions, compilerHost)
  const typeChecker = program.getTypeChecker()
  const diagnostics = ts.getPreEmitDiagnostics(program)

  expect(diagnostics).to.be.empty

  const mainFunctionDecl = getFunctionDeclarationByName(
    virtualFiles[mainFile],
    mainFunctionName,
  )

  expect(mainFunctionDecl).to.not.be.undefined

  const functions = findCalledFunctionDeclarations(
    typeChecker,
    mainFunctionDecl!,
  )
  const functionNames = functions
    .map((f) => f.name?.text)
    .filter((n) => n !== undefined)

  return functionNames
}
