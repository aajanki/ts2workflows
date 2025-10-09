import ts from 'typescript'

// Find functions that are (recursively) called by rootNode
export function findCalledFunctionDeclarations(
  typeChecker: ts.TypeChecker,
  rootNode: ts.SourceFile,
): ts.FunctionDeclaration[] {
  // First add top level function declarations
  const declarations = rootNode.statements.filter(ts.isFunctionDeclaration)

  // Next, find nested function calls recursively
  findFunctionsRecursively(declarations, typeChecker, rootNode)

  return declarations
}

// Find functions declarations below node and declarations called by those functions
function findFunctionsRecursively(
  seen: ts.FunctionDeclaration[],
  typeChecker: ts.TypeChecker,
  node: ts.Node,
): void {
  const deduplicated: ts.FunctionDeclaration[] = []

  // Collect call expressions in the current function
  findNestedFunctions(typeChecker, node).forEach((x) => {
    const exists = seen.some(
      (x2) =>
        x2.name?.text === x.name?.text &&
        x2.getSourceFile().fileName === x.getSourceFile().fileName,
    )

    // ignore previously seen functions and break cycles
    if (!exists) {
      seen.push(x)
      deduplicated.push(x)
    }
  })

  // Recurse into the called functions found above
  deduplicated.forEach((decl) =>
    findFunctionsRecursively(seen, typeChecker, decl),
  )
}

// Find FunctionDeclarations nested below node in AST
function findNestedFunctions(
  typeChecker: ts.TypeChecker,
  node: ts.Node,
): ts.FunctionDeclaration[] {
  const functionDeclarations: ts.FunctionDeclaration[] = []

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const sig = typeChecker.getResolvedSignature(node)
      const decl = sig?.getDeclaration()

      if (decl && ts.isFunctionDeclaration(decl)) {
        functionDeclarations.push(decl)
      }
    } else if (
      ts.isIdentifier(node) &&
      !ts.isImportOrExportSpecifier(node.parent)
    ) {
      const symbol = typeChecker.getSymbolAtLocation(node)

      if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
        const symbol2 = typeChecker.getAliasedSymbol(symbol)
        for (const decl of symbol2.getDeclarations() ?? []) {
          if (ts.isFunctionDeclaration(decl)) {
            functionDeclarations.push(decl)
          }
        }
      } else {
        for (const decl of symbol?.getDeclarations() ?? []) {
          if (ts.isFunctionDeclaration(decl)) {
            functionDeclarations.push(decl)
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(node)

  return functionDeclarations
}
