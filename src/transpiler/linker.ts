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

// Find functions declarations below node and declarations called by those functions
function findFunctionsRecursively(
  seen: ts.FunctionDeclaration[],
  typeChecker: ts.TypeChecker,
  node: ts.Node,
): void {
  // remove previously seen functions and break cycles
  const deduplicated: ts.FunctionDeclaration[] = []
  findNestedFunctions(typeChecker, node).forEach((x) => {
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

  // First add top level function declarations
  if (ts.isFunctionDeclaration(node)) {
    functionDeclarations.push(node)
  } else if (ts.isSourceFile(node)) {
    functionDeclarations.push(
      ...node.statements.filter(ts.isFunctionDeclaration),
    )
  }

  // Next, find nested function calls recursively
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const sig = typeChecker.getResolvedSignature(node)

      if (!sig) {
        throw new Error('Call expression node is not valid')
      }

      const decl = sig.getDeclaration()

      if (ts.isFunctionDeclaration(decl)) {
        functionDeclarations.push(decl)
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
export function isAmbientFunctionDeclaration(
  node: ts.FunctionDeclaration,
): boolean {
  if (isAmbient(node)) {
    return true
  }

  let mod: ts.FunctionDeclaration | ts.ModuleDeclaration = node
  while (
    ts.isModuleBlock(mod.parent) &&
    ts.isModuleDeclaration(mod.parent.parent)
  ) {
    mod = mod.parent.parent

    if (isAmbient(mod)) {
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
