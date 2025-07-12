import ts, { isModuleBlock, isModuleDeclaration } from 'typescript'

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

      if (!sig) {
        throw new Error('Function signature not found')
      }

      const decl = sig.getDeclaration()
      const sourceFile = decl.getSourceFile()
      const name = decl.name?.getText()

      // declaration of an anonymous function does not have a name
      if (name) {
        const declNode = getFunctionDeclarationByName(sourceFile, name)

        if (!declNode) {
          throw new Error(
            `Function declaration not found for ${name} in ${sourceFile.fileName}`,
          )
        }

        if (!isAmbientFunctionOrNamespace(declNode)) {
          functionDeclarations.push(declNode)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(node)

  return functionDeclarations
}

/**
 * Returns true if node is ambient function declaration.
 *
 * The two cases that return true:
 *   - "declare function"
 *   - "declare namespace { function ... }"
 */
function isAmbientFunctionOrNamespace(node: ts.FunctionDeclaration): boolean {
  return (
    isAmbient(node) ||
    (isModuleBlock(node.parent) &&
      isModuleDeclaration(node.parent.parent) &&
      isAmbient(node.parent.parent))
  )
}

function isAmbient(
  node: ts.FunctionDeclaration | ts.ModuleDeclaration,
): boolean {
  if (!node.modifiers) {
    return false
  }

  return node.modifiers.some((x) => x.kind === ts.SyntaxKind.DeclareKeyword)
}
