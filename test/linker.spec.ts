/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion */

import { expect } from 'chai'
import ts from 'typescript'
import { findCalledFunctionDeclarations } from '../src/transpiler/linker'

describe('function listing', () => {
  it('finds nested function calls', () => {
    const functions = listFunctions('test/fixtures/simple.ts', [])

    expect(functions).to.have.lengthOf(4)
    expect(functions).to.have.members([
      'main',
      'compute',
      'getFirstValue',
      'getSecondValue',
    ])
  })

  it('finds imported functions', () => {
    const functions = listFunctions('test/fixtures/import.ts', [
      'test/fixtures/computation.ts',
    ])

    expect(functions).to.have.lengthOf(5)
    expect(functions).to.have.members([
      'main',
      'compute',
      'average',
      'getFirstNumber',
      'getSecondNumber',
    ])
  })

  it('finds imported function with alias', () => {
    const functions = listFunctions('test/fixtures/importalias.ts', [
      'test/fixtures/computation.ts',
    ])

    expect(functions).to.have.lengthOf(5)
    expect(functions).to.have.members([
      'main',
      'compute',
      'average',
      'getFirstNumber',
      'getSecondNumber',
    ])
  })

  it('lists recursive function calls', () => {
    const functions = listFunctions('test/fixtures/recursion.ts', [])

    expect(functions).to.have.lengthOf(4)
    expect(functions).to.have.members([
      'main',
      'count',
      'mutualRecursion',
      'mutualRecursion2',
    ])
  })

  it('lists functions with qualified names', () => {
    const functions = listFunctions('test/fixtures/qualifiedname.ts', [])

    expect(functions).to.have.lengthOf(2)
    expect(functions).to.have.members(['main', 'MyMath.sin'])
  })

  it('lists namespace declarations imported from a .d.ts file', () => {
    const functions = listFunctions('test/fixtures/importdeclaration.ts', [])

    expect(functions).to.have.lengthOf(2)
    expect(functions).to.have.members(['main', 'math.abs'])
  })

  it('lists function declarations imported from a .d.ts file', () => {
    const functions = listFunctions('test/fixtures/importdeclaration2.ts', [])

    expect(functions).to.have.lengthOf(2)
    expect(functions).to.have.members(['main', 'sum'])
  })

  it('lists function declaration from deeply nested namespaces', () => {
    const functions = listFunctions('test/fixtures/importdeclaration3.ts', [])

    expect(functions).to.have.lengthOf(2)
    expect(functions).to.have.members(['main', 'communication.net.http.get'])
  })

  it('does not include anonymous functions', () => {
    const functions = listFunctions('test/fixtures/anonymous.ts', [])

    expect(functions).to.deep.equal(['main'])
  })
})

function listFunctions(
  mainFileName: string,
  otherSourceFiles: string[],
): string[] {
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES5,
    module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
    types: [],
    rootDir: 'test/fixtures',
  }

  const compilerHost = ts.createCompilerHost(compilerOptions)
  const allSources = [mainFileName].concat(otherSourceFiles)
  const program = ts.createProgram(allSources, compilerOptions, compilerHost)
  const mainSourceFile = program.getSourceFile(mainFileName)!
  const typeChecker = program.getTypeChecker()
  const diagnostics = ts.getPreEmitDiagnostics(program)

  expect(diagnostics).to.deep.equal([])

  const functions = findCalledFunctionDeclarations(typeChecker, mainSourceFile)
  return functions.map(qualifiedName)
}

function qualifiedName(decl: ts.FunctionDeclaration): string {
  let name = decl.name?.getText()

  if (!name) {
    return ''
  }

  let node: ts.FunctionDeclaration | ts.ModuleDeclaration = decl
  while (
    ts.isModuleBlock(node.parent) &&
    ts.isModuleDeclaration(node.parent.parent)
  ) {
    node = node.parent.parent as ts.ModuleDeclaration

    name = node.name.getText() + '.' + name
  }

  return name
}
