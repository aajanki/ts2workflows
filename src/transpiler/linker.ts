import ts from 'typescript'

// Find functions that are (recursively) called by rootNode
export function findCalledFunctionDeclarations(
  typeChecker: ts.TypeChecker,
  rootNode: ts.Node,
): ts.FunctionDeclaration[] {
  const declarations: ts.FunctionDeclaration[] = []

  if (ts.isFunctionDeclaration(rootNode)) {
    declarations.push(rootNode)
  }

  findFunctionsRecursively(declarations, typeChecker, rootNode)

  return declarations
}

// Get a named function declaration from SourceFile.
// Returns undefined if a function is not found.
export function getFunctionDeclarationByName(
  sourceFile: ts.SourceFile,
  functionName: string,
): ts.FunctionDeclaration | undefined {
  let foundDecl: ts.FunctionDeclaration | undefined

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
      foundDecl = node
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return foundDecl
}

// Find functions declarations below node and declarations called by those functions
function findFunctionsRecursively(
  seen: ts.FunctionDeclaration[],
  typeChecker: ts.TypeChecker,
  node: ts.Node,
): void {
  const nestedFunctionCalls = findNestedFunctions(typeChecker, node)

  // remove previously seen functions and break cycles
  const deduplicated: ts.FunctionDeclaration[] = []
  nestedFunctionCalls.forEach((x) => {
    const exists = !!seen.find(
      (x2) =>
        x2.name?.text === x.name?.text &&
        x2.getSourceFile().fileName === x.getSourceFile().fileName,
    )

    if (!exists) {
      seen.push(x)
      deduplicated.push(x)
    }
  })

  deduplicated.flatMap((decl) =>
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
      const sourceFile = decl?.getSourceFile()

      if (sourceFile) {
        const name = decl?.name?.getText()

        // declaration of an anonymous function does not have a name
        if (name) {
          const declNode = getFunctionDeclarationByName(sourceFile, name)

          if (declNode) {
            functionDeclarations.push(declNode)
          } else {
            throw new Error(
              `Function declaration not found for ${name} in ${sourceFile.fileName}`,
            )
          }
        }
      } else {
        throw new Error('Function signature not found')
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(node)

  return functionDeclarations
}
