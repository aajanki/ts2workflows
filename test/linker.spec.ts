/* eslint-disable @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion */

import { expect } from 'chai'
import ts from 'typescript'
import {
  findCalledFunctionDeclarations,
  getFunctionDeclarationByName,
} from '../src/transpiler/linker'

describe('function listing', () => {
  it('finds nested function calls', () => {
    const functions = listFunctions(
      'test/linkertestsources/case1.ts',
      [],
      'main',
    )

    expect(functions).to.have.members([
      'main',
      'compute',
      'getFirstValue',
      'getSecondValue',
    ])
  })

  it('finds imported functions', () => {
    const functions = listFunctions(
      'test/linkertestsources/case2.ts',
      ['test/linkertestsources/computation.ts'],
      'main',
    )

    expect(functions).to.have.members([
      'main',
      'compute',
      'average',
      'getFirstNumber',
      'getSecondNumber',
    ])
  })
})

function listFunctions(
  mainSourceFile: string,
  otherSourceFiles: string[],
  mainFunctionName: string,
): string[] {
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES5,
    module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    types: [],
    rootDir: 'test/linkertestsources',
  }

  const compilerHost = ts.createCompilerHost(compilerOptions)
  const allSources = [mainSourceFile].concat(otherSourceFiles)
  const program = ts.createProgram(allSources, compilerOptions, compilerHost)
  const typeChecker = program.getTypeChecker()
  const diagnostics = ts.getPreEmitDiagnostics(program)

  expect(diagnostics).to.be.empty

  const mainFunctionDecl = getFunctionDeclarationByName(
    program.getSourceFile(mainSourceFile)!,
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
