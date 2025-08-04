import * as R from 'ramda'
import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/typescript-estree'
import {
  BinaryOperator,
  Expression,
  MemberExpression,
  VariableName,
  VariableReferenceExpression,
  binaryEx,
  expressionToString,
  functionInvocationEx,
  isFullyQualifiedName,
  isLiteral,
  isPure,
  listEx,
  memberEx,
  nullEx,
  numberEx,
  stringEx,
  trueEx,
  variableReferenceEx,
} from '../ast/expressions.js'
import {
  AssignStatement,
  CustomRetryPolicy,
  FunctionInvocationStatement,
  IfBranch,
  IfStatement,
  ForStatement,
  LabelledStatement,
  ParallelBranch,
  ParallelForStatement,
  ParallelStatement,
  RaiseStatement,
  ForRangeStatement,
  ReturnStatement,
  TryStatement,
  VariableAssignment,
  WorkflowParameters,
  WorkflowStatement,
  WhileStatement,
  DoWhileStatement,
  BreakStatement,
  ContinueStatement,
  SwitchStatement,
} from '../ast/statements.js'
import { InternalTranspilingError, WorkflowSyntaxError } from '../errors.js'
import {
  convertExpression,
  convertMemberExpression,
  convertObjectExpression,
  isIntrinsic,
  throwIfSpread,
  isIntrinsicStatement,
  convertVariableNameExpression,
} from './parseexpressions.js'
import { blockingFunctions } from './generated/functionMetadata.js'

export interface ParsingContext {
  // parallelNestingLevel is the current nesting level of parallel statements.
  // Used for naming temporary variables inside parallel branches.
  readonly parallelNestingLevel?: number
}

export function parseStatement(
  node: TSESTree.Statement,
  ctx: ParsingContext,
): WorkflowStatement[] {
  switch (node.type) {
    case AST_NODE_TYPES.BlockStatement:
      return node.body.flatMap((node) => parseStatement(node, ctx))

    case AST_NODE_TYPES.VariableDeclaration:
      return convertVariableDeclarations(node, ctx)

    case AST_NODE_TYPES.ExpressionStatement:
      if (node.expression.type === AST_NODE_TYPES.AssignmentExpression) {
        return assignmentExpressionToStatement(node.expression, ctx)
      } else if (node.expression.type === AST_NODE_TYPES.CallExpression) {
        return callExpressionToStatement(node.expression, undefined, ctx)
      } else {
        return [generalExpressionToAssignment(node.expression, ctx)]
      }

    case AST_NODE_TYPES.ReturnStatement:
      return [createReturnStatement(node)]

    case AST_NODE_TYPES.ThrowStatement:
      return [createRaiseStatement(node)]

    case AST_NODE_TYPES.IfStatement:
      return [createIfStatement(node, ctx)]

    case AST_NODE_TYPES.SwitchStatement:
      return createSwitchStatement(node, ctx)

    case AST_NODE_TYPES.ForInStatement:
      throw new WorkflowSyntaxError(
        'for...in is not a supported construct. Use for...of.',
        node.loc,
      )

    case AST_NODE_TYPES.ForOfStatement:
      return [createForOfStatement(node, ctx)]

    case AST_NODE_TYPES.DoWhileStatement:
      return createDoWhileStatement(node, ctx)

    case AST_NODE_TYPES.WhileStatement:
      return createWhileStatement(node, ctx)

    case AST_NODE_TYPES.BreakStatement:
      return [createBreakStatement(node)]

    case AST_NODE_TYPES.ContinueStatement:
      return [createContinueStatement(node)]

    case AST_NODE_TYPES.TryStatement:
      return createTryStatement(node, ctx)

    case AST_NODE_TYPES.LabeledStatement:
      return [createLabeledStatement(node, ctx)]

    case AST_NODE_TYPES.EmptyStatement:
      return []

    case AST_NODE_TYPES.FunctionDeclaration:
      throw new WorkflowSyntaxError(
        'Functions must be defined at the top level of a source file',
        node.loc,
      )

    case AST_NODE_TYPES.TSInterfaceDeclaration:
    case AST_NODE_TYPES.TSTypeAliasDeclaration:
    case AST_NODE_TYPES.TSDeclareFunction:
      // Ignore "type", "interface" and "declare function"
      return []

    default:
      throw new InternalTranspilingError(
        `TODO: encountered unsupported type: ${node.type} on line ${node.loc.start.line}, column ${node.loc.start.column}`,
      )
  }
}

function convertVariableDeclarations(
  node: TSESTree.LetOrConstOrVarDeclaration | TSESTree.UsingDeclaration,
  ctx: ParsingContext,
): WorkflowStatement[] {
  if (node.kind !== 'const' && node.kind !== 'let') {
    throw new WorkflowSyntaxError(
      'Only const and let variable declarations are supported',
      node.loc,
    )
  }

  return node.declarations.flatMap((decl) => {
    if (decl.id.type === AST_NODE_TYPES.Identifier) {
      return convertInitializer(decl.id.name, decl.init, ctx)
    } else if (decl.id.type === AST_NODE_TYPES.ArrayPattern) {
      return convertArrayDestructuring(decl.id, decl.init, ctx)
    } else if (decl.id.type === AST_NODE_TYPES.ObjectPattern) {
      return convertObjectDestructuring(decl.id, decl.init, ctx)
    } else {
      throw new WorkflowSyntaxError('Unsupported pattern', decl.loc)
    }
  })
}

function convertInitializer(
  targetVariableName: string,
  initializer: TSESTree.Expression | null,
  ctx: ParsingContext,
): WorkflowStatement[] {
  if (initializer?.type === AST_NODE_TYPES.CallExpression) {
    const calleeName =
      initializer.callee.type === AST_NODE_TYPES.Identifier
        ? initializer.callee.name
        : undefined
    if (calleeName && isIntrinsicStatement(calleeName)) {
      throw new WorkflowSyntaxError(
        `"${calleeName}" can't be called as part of an expression`,
        initializer.callee.loc,
      )
    }

    return callExpressionToStatement(initializer, targetVariableName, ctx)
  } else {
    const name = variableReferenceEx(targetVariableName)
    const value = initializer === null ? nullEx : convertExpression(initializer)

    return [new AssignStatement([{ name, value }])]
  }
}

function convertArrayDestructuring(
  arrayPattern: TSESTree.ArrayPattern,
  initializer: TSESTree.Expression | null,
  ctx: ParsingContext,
): WorkflowStatement[] {
  let initExpression
  const statements: WorkflowStatement[] = []
  if (
    initializer?.type === AST_NODE_TYPES.Identifier ||
    initializer?.type === AST_NODE_TYPES.MemberExpression
  ) {
    // If the initializer is an Identifier or MemberExpression (array variable?),
    // use it directly. This ensures that the recursive variables gets initialized
    // in the correct order. For example:
    // const arr = [1, 2]
    // [arr[1], arr[0]] = arr
    initExpression = convertExpression(initializer)
  } else {
    // Otherwise, assign the expression to a temporary variable first.
    const initName = tempName(ctx)
    statements.push(...convertInitializer(initName, initializer, ctx))
    initExpression = variableReferenceEx(initName)
  }

  statements.push(
    ...arrayDestructuringStatements(arrayPattern.elements, initExpression, ctx),
  )

  return statements
}

function arrayDestructuringStatements(
  patterns: (TSESTree.DestructuringPattern | null)[],
  initializerExpression: Expression,
  ctx: ParsingContext,
): WorkflowStatement[] {
  if (patterns.filter((p) => p !== null).length === 0) {
    return []
  }

  const __temp_len = variableReferenceEx(`${tempName(ctx)}_len`)
  const initializeVariables: VariableAssignment[] = [
    {
      name: __temp_len,
      value: functionInvocationEx('len', [initializerExpression]),
    },
  ]

  const branches: IfBranch[] = R.reverse(patterns).flatMap((pat, i) => {
    if (pat === null) {
      return []
    } else {
      return [
        {
          condition: binaryEx(__temp_len, '>=', numberEx(patterns.length - i)),
          body: arrayElementsDestructuringStatements(
            patterns,
            initializerExpression,
            patterns.length - i,
            ctx,
          ),
        },
      ]
    }
  })

  branches.push({
    condition: trueEx,
    body: arrayElementsDestructuringStatements(
      patterns,
      initializerExpression,
      0,
      ctx,
    ),
  })

  return [new AssignStatement(initializeVariables), new IfStatement(branches)]
}

function arrayElementsDestructuringStatements(
  patterns: (TSESTree.DestructuringPattern | null)[],
  initializerExpression: Expression,
  take: number,
  ctx: ParsingContext,
): WorkflowStatement[] {
  return patterns.flatMap((pat, i) => {
    if (i >= take) {
      return [
        new AssignStatement(
          extractDefaultAssignmentsFromDestructuringPattern(pat),
        ),
      ]
    }

    const iElement = memberEx(initializerExpression, numberEx(i), true)

    switch (pat?.type) {
      case AST_NODE_TYPES.MemberExpression:
      case AST_NODE_TYPES.Identifier: {
        const name = convertVariableNameExpression(pat)

        return [new AssignStatement([{ name, value: iElement }])]
      }

      case AST_NODE_TYPES.AssignmentPattern: {
        if (pat.left.type !== AST_NODE_TYPES.Identifier) {
          throw new WorkflowSyntaxError(
            'Default value can be used only with an identifier',
            pat.left.loc,
          )
        }

        const name = variableReferenceEx(pat.left.name)
        return [new AssignStatement([{ name, value: iElement }])]
      }

      case AST_NODE_TYPES.ObjectPattern:
        return objectDestructuringStatements(pat.properties, iElement, ctx)

      case AST_NODE_TYPES.ArrayPattern:
        return arrayDestructuringStatements(pat.elements, iElement, ctx)

      case AST_NODE_TYPES.RestElement:
        return arrayRestDestructuringStatements(
          patterns,
          pat,
          initializerExpression,
          patterns.length - 1,
          ctx,
        )

      default: // pat === null
        return []
    }
  })
}

function extractDefaultAssignmentsFromDestructuringPattern(
  pat: TSESTree.DestructuringPattern | null,
): VariableAssignment[] {
  if (pat === null) {
    return []
  }

  switch (pat.type) {
    case AST_NODE_TYPES.ArrayPattern:
      return pat.elements.flatMap(
        extractDefaultAssignmentsFromDestructuringPattern,
      )

    case AST_NODE_TYPES.AssignmentPattern:
      if (pat.left.type !== AST_NODE_TYPES.Identifier) {
        throw new WorkflowSyntaxError(
          'Default value can be used only with an identifier',
          pat.left.loc,
        )
      }

      return [
        {
          name: variableReferenceEx(pat.left.name),
          value: convertExpression(pat.right),
        },
      ]

    case AST_NODE_TYPES.Identifier:
      return [{ name: variableReferenceEx(pat.name), value: nullEx }]

    case AST_NODE_TYPES.MemberExpression:
      return [{ name: convertVariableNameExpression(pat), value: nullEx }]

    case AST_NODE_TYPES.ObjectPattern:
      return pat.properties.flatMap((p) => {
        if (p.type === AST_NODE_TYPES.RestElement) {
          return extractDefaultAssignmentsFromDestructuringPattern(p)
        } else if (
          p.value.type === AST_NODE_TYPES.ArrayPattern ||
          p.value.type === AST_NODE_TYPES.AssignmentPattern ||
          p.value.type === AST_NODE_TYPES.Identifier ||
          p.value.type === AST_NODE_TYPES.MemberExpression ||
          p.value.type === AST_NODE_TYPES.ObjectPattern
        ) {
          return extractDefaultAssignmentsFromDestructuringPattern(p.value)
        } else {
          throw new WorkflowSyntaxError(
            'Destructuring pattern expected',
            p.value.loc,
          )
        }
      })

    case AST_NODE_TYPES.RestElement:
      if (pat.argument.type !== AST_NODE_TYPES.Identifier) {
        throw new WorkflowSyntaxError('Identifier expected', pat.argument.loc)
      }

      return [
        {
          name: variableReferenceEx(pat.argument.name),
          value: listEx([]),
        },
      ]

    default:
      return []
  }
}

function throwIfInvalidRestElement(
  patterns: (TSESTree.DestructuringPattern | TSESTree.Property | null)[],
): void {
  const i = patterns.findIndex((p) => p?.type === AST_NODE_TYPES.RestElement)

  if (i >= 0 && i !== patterns.length - 1) {
    throw new WorkflowSyntaxError(
      'A rest element must be last in a destructuring pattern',
      patterns[i]!.loc,
    )
  }
}

function arrayRestDestructuringStatements(
  patterns: (TSESTree.DestructuringPattern | null)[],
  rest: TSESTree.RestElement,
  initializerExpression: Expression,
  startIndex: number,
  ctx: ParsingContext,
): WorkflowStatement[] {
  throwIfInvalidRestElement(patterns)

  if (rest.argument.type !== AST_NODE_TYPES.Identifier) {
    throw new WorkflowSyntaxError('Identifier expected', rest.argument.loc)
  }

  const restName = variableReferenceEx(rest.argument.name)
  const __temp_len = variableReferenceEx(`${tempName(ctx)}_len`)
  const __temp_index = `${tempName(ctx)}_index`
  const one = numberEx(1)
  const emptyArray = listEx([])
  const copyLoop = new ForRangeStatement(
    [
      new AssignStatement([
        {
          name: restName,
          value: functionInvocationEx('list.concat', [
            restName,
            memberEx(
              initializerExpression,
              variableReferenceEx(__temp_index),
              true,
            ),
          ]),
        },
      ]),
    ],
    __temp_index,
    startIndex,
    binaryEx(__temp_len, '-', one),
  )

  return [
    new AssignStatement([{ name: restName, value: emptyArray }]),
    copyLoop,
  ]
}

function convertObjectDestructuring(
  objectPattern: TSESTree.ObjectPattern,
  initializer: TSESTree.Expression | null,
  ctx: ParsingContext,
): WorkflowStatement[] {
  let initExpression: Expression
  const statements: WorkflowStatement[] = []
  if (
    initializer?.type === AST_NODE_TYPES.Identifier ||
    (initializer?.type === AST_NODE_TYPES.MemberExpression &&
      isPure(convertExpression(initializer)))
  ) {
    // If the initializer is an Identifier or MemberExpression (object variable?), use it directly.
    initExpression = convertExpression(initializer)
  } else {
    // Otherwise, assign the expression to a temporary variable first.
    const initName = tempName(ctx)
    statements.push(...convertInitializer(initName, initializer, ctx))
    initExpression = variableReferenceEx(initName)
  }

  statements.push(
    ...objectDestructuringStatements(
      objectPattern.properties,
      initExpression,
      ctx,
    ),
  )

  return statements
}

function objectDestructuringStatements(
  properties: (TSESTree.RestElement | TSESTree.Property)[],
  initializerExpression: Expression,
  ctx: ParsingContext,
): WorkflowStatement[] {
  return properties.flatMap((prop) => {
    if (prop.type === AST_NODE_TYPES.RestElement) {
      return objectDestructuringRestStatements(
        properties,
        prop,
        initializerExpression,
      )
    }

    if (prop.key.type !== AST_NODE_TYPES.Identifier) {
      throw new WorkflowSyntaxError('Identifier expected', prop.key.loc)
    }

    const keyExpression = memberEx(
      initializerExpression,
      variableReferenceEx(prop.key.name),
      false,
    )

    if (prop.value.type === AST_NODE_TYPES.ObjectPattern) {
      return objectDestructuringStatements(
        prop.value.properties,
        keyExpression,
        ctx,
      )
    } else if (prop.value.type === AST_NODE_TYPES.ArrayPattern) {
      return arrayDestructuringStatements(
        prop.value.elements,
        keyExpression,
        ctx,
      )
    } else if (prop.value.type === AST_NODE_TYPES.Identifier) {
      const safeKeyExpression = functionInvocationEx('map.get', [
        initializerExpression,
        stringEx(prop.key.name),
      ])

      return [
        new AssignStatement([
          {
            name: variableReferenceEx(prop.value.name),
            value: safeKeyExpression,
          },
        ]),
      ]
    } else if (prop.value.type === AST_NODE_TYPES.AssignmentPattern) {
      return objectAssignmentPatternStatements(
        prop.value,
        initializerExpression,
        keyExpression,
      )
    } else {
      throw new WorkflowSyntaxError(
        `${prop.value.type} is not allowed in object destructuring`,
        prop.value.loc,
      )
    }
  })
}

function objectAssignmentPatternStatements(
  pat: TSESTree.AssignmentPattern,
  initializerExpression: Expression,
  keyExpression: MemberExpression,
): WorkflowStatement[] {
  if (pat.left.type !== AST_NODE_TYPES.Identifier) {
    throw new WorkflowSyntaxError(
      'Default value can be used only with an identifier',
      pat.left.loc,
    )
  }

  // Using an if statement instead of default() because pat.right must be
  // evaluated only in the default value branch (in case it has side effects)
  const name = variableReferenceEx(pat.left.name)
  return [
    new IfStatement([
      {
        condition: binaryEx(
          stringEx(pat.left.name),
          'in',
          initializerExpression,
        ),
        body: [new AssignStatement([{ name, value: keyExpression }])],
      },
      {
        condition: trueEx,
        body: [
          new AssignStatement([{ name, value: convertExpression(pat.right) }]),
        ],
      },
    ]),
  ]
}

function objectDestructuringRestStatements(
  properties: (TSESTree.RestElement | TSESTree.Property)[],
  rest: TSESTree.RestElement,
  initializerExpression: Expression,
): WorkflowStatement[] {
  throwIfInvalidRestElement(properties)

  if (rest.argument.type !== AST_NODE_TYPES.Identifier) {
    throw new WorkflowSyntaxError('Identifier expected', rest.argument.loc)
  }

  const nonRestProperties = properties.filter(
    (x) => x.type !== AST_NODE_TYPES.RestElement,
  )
  const nonRestKeys = nonRestProperties
    .map((p) => p.key)
    .map((p) => {
      if (p.type !== AST_NODE_TYPES.Identifier) {
        throw new WorkflowSyntaxError('Identifier expected', p.loc)
      }

      return p
    })
    .map((p) => p.name)

  const name = variableReferenceEx(rest.argument.name)
  const value = nonRestKeys.reduce(
    (acc, propertyName) =>
      // map.delete returns a copy of the object and removes the specified property
      functionInvocationEx('map.delete', [acc, stringEx(propertyName)]),
    initializerExpression,
  )

  return [new AssignStatement([{ name, value }])]
}

function assignmentExpressionToStatement(
  node: TSESTree.AssignmentExpression,
  ctx: ParsingContext,
): WorkflowStatement[] {
  let compoundOperator: BinaryOperator | undefined = undefined
  switch (node.operator) {
    case '=':
      compoundOperator = undefined
      break

    case '+=':
      compoundOperator = '+'
      break

    case '-=':
      compoundOperator = '-'
      break

    case '*=':
      compoundOperator = '*'
      break

    case '/=':
      compoundOperator = '/'
      break

    case '%=':
      compoundOperator = '%'
      break

    case '&&=':
      compoundOperator = 'and'
      break

    case '||=':
      compoundOperator = 'or'
      break

    default:
      throw new WorkflowSyntaxError(
        `Operator ${node.operator} is not supported in assignment expressions`,
        node.loc,
      )
  }

  if (compoundOperator === undefined) {
    return assignmentStatements(node.left, node.right, ctx)
  } else {
    return compoundAssignmentStatements(
      node.left,
      node.right,
      compoundOperator,
      ctx,
    )
  }
}

function assignmentStatements(
  left: TSESTree.Expression,
  right: TSESTree.Expression,
  ctx: ParsingContext,
): WorkflowStatement[] {
  let valueExpression: Expression
  const statements: WorkflowStatement[] = []

  if (left.type === AST_NODE_TYPES.ArrayPattern) {
    return convertArrayDestructuring(left, right, ctx)
  } else if (left.type === AST_NODE_TYPES.ObjectPattern) {
    return convertObjectDestructuring(left, right, ctx)
  }

  if (
    right.type === AST_NODE_TYPES.CallExpression &&
    right.callee.type === AST_NODE_TYPES.Identifier &&
    isIntrinsic(right.callee.name)
  ) {
    const tr = convertAssignmentExpressionIntrinsicRHS(right, ctx)
    statements.push(...tr.statements)
    valueExpression = tr.tempVariable
  } else {
    valueExpression = convertExpression(right)
  }

  const targetExpression = convertVariableNameExpression(left)
  statements.push(
    new AssignStatement([{ name: targetExpression, value: valueExpression }]),
  )

  return statements
}

function compoundAssignmentStatements(
  left: TSESTree.Expression,
  right: TSESTree.Expression,
  operator: BinaryOperator,
  ctx: ParsingContext,
): WorkflowStatement[] {
  let valueExpression: Expression
  const { expression: targetExpression, statements } =
    convertCompoundAssignmentLeftHandSide(left, ctx)

  if (
    right.type === AST_NODE_TYPES.CallExpression &&
    right.callee.type === AST_NODE_TYPES.Identifier &&
    isIntrinsic(right.callee.name)
  ) {
    const tr = convertAssignmentExpressionIntrinsicRHS(right, ctx)
    statements.push(...tr.statements)
    valueExpression = tr.tempVariable
  } else {
    valueExpression = convertExpression(right)
  }

  valueExpression = binaryEx(targetExpression, operator, valueExpression)

  statements.push(
    new AssignStatement([{ name: targetExpression, value: valueExpression }]),
  )

  return statements
}

function convertCompoundAssignmentLeftHandSide(
  left: TSESTree.Expression,
  ctx: ParsingContext,
): {
  expression: MemberExpression | VariableReferenceExpression
  statements: WorkflowStatement[]
} {
  if (
    left.type === AST_NODE_TYPES.ArrayPattern ||
    left.type === AST_NODE_TYPES.ObjectPattern
  ) {
    throw new WorkflowSyntaxError(
      `Invalid left-hand side in assignment`,
      left.loc,
    )
  }

  const leftEx = convertVariableNameExpression(left)
  const { transformed, assignments } = extractSideEffectsFromMemberExpression(
    leftEx,
    tempName(ctx),
    0,
  )

  return {
    expression: transformed,
    statements:
      assignments.length > 0 ? [new AssignStatement(assignments)] : [],
  }
}

/**
 * Extract side-effecting computed properties into temporary variable assignments.
 *
 * This is used on the left-hand side of a compound assignment expression, which
 * should only be evaluted once.
 */
function extractSideEffectsFromMemberExpression(
  ex: MemberExpression | VariableReferenceExpression,
  tempPrefix: string,
  tempIndex: number,
): {
  transformed: MemberExpression | VariableReferenceExpression
  assignments: VariableAssignment[]
} {
  if (ex.tag === 'member' && ex.computed && !isLiteral(ex.property)) {
    // property potentially has side effects. Move to a temp variable for safety.
    let transformedObject: Expression
    let objectAssignments: VariableAssignment[]

    if (ex.object.tag === 'member') {
      const object2 = extractSideEffectsFromMemberExpression(
        ex.object,
        tempPrefix,
        tempIndex + 1,
      )
      transformedObject = object2.transformed
      objectAssignments = object2.assignments
    } else {
      transformedObject = ex.object
      objectAssignments = []
    }

    const tmp = variableReferenceEx(`${tempPrefix}${tempIndex}`)
    const transformed = memberEx(transformedObject, tmp, true)
    const assignments = objectAssignments
    assignments.push({
      name: tmp,
      value: ex.property,
    })

    return { transformed, assignments }
  } else if (ex.tag === 'member' && ex.object.tag === 'member') {
    const { transformed: object2, assignments } =
      extractSideEffectsFromMemberExpression(ex.object, tempPrefix, tempIndex)
    const transformed = memberEx(object2, ex.property, ex.computed)

    return { transformed, assignments }
  } else {
    return {
      transformed: ex,
      assignments: [],
    }
  }
}

/**
 * Special case for handling call_step() RHS in assignment expressions.
 *
 * This can be removed once the generic convertExpression() is able to handle call_step.
 */
function convertAssignmentExpressionIntrinsicRHS(
  callEx: TSESTree.CallExpression,
  ctx: ParsingContext,
): {
  statements: WorkflowStatement[]
  tempVariable: VariableReferenceExpression
} {
  if (callEx.callee.type !== AST_NODE_TYPES.Identifier) {
    throw new InternalTranspilingError('The callee should be an identifier')
  }

  const calleeName = callEx.callee.name
  if (isIntrinsicStatement(calleeName)) {
    throw new WorkflowSyntaxError(
      `"${calleeName}" can't be called as part of an expression`,
      callEx.callee.loc,
    )
  }

  const resultVariable = tempName(ctx)

  return {
    statements: callExpressionToStatement(callEx, resultVariable, ctx),
    tempVariable: variableReferenceEx(resultVariable),
  }
}

function callExpressionToStatement(
  node: TSESTree.CallExpression,
  resultVariable: string | undefined,
  ctx: ParsingContext,
): WorkflowStatement[] {
  const calleeExpression = convertExpression(node.callee)
  if (isFullyQualifiedName(calleeExpression)) {
    const calleeName = expressionToString(calleeExpression)

    if (calleeName === 'parallel') {
      // A handle the "parallel" intrinsic
      return [callExpressionToParallelStatement(node, ctx)]
    } else if (calleeName === 'retry_policy') {
      // retry_policy() is handled by AST_NODE_TYPES.TryStatement and therefore ignored here
      return []
    } else if (calleeName === 'call_step') {
      return [createCallStatement(node, node.arguments, resultVariable)]
    } else if (blockingFunctions.has(calleeName)) {
      const argumentNames = blockingFunctions.get(calleeName) ?? []
      return [
        blockingFunctionStatement(
          calleeName,
          argumentNames,
          node.arguments,
          resultVariable,
        ),
      ]
    } else {
      const resultVariable2 = resultVariable ?? tempName(ctx)

      return [
        callExpressionAssignment(calleeName, node.arguments, resultVariable2),
      ]
    }
  } else {
    throw new WorkflowSyntaxError(
      'Expeced a subworkflow or a standard library function name',
      node.callee.loc,
    )
  }
}

function callExpressionAssignment(
  functionName: string,
  argumentsNode: TSESTree.CallExpressionArgument[],
  resultVariable: VariableName,
): AssignStatement {
  const argumentExpressions =
    throwIfSpread(argumentsNode).map(convertExpression)

  return new AssignStatement([
    {
      name: variableReferenceEx(resultVariable),
      value: functionInvocationEx(functionName, argumentExpressions),
    },
  ])
}

function createCallStatement(
  node: TSESTree.CallExpression,
  argumentsNode: TSESTree.CallExpressionArgument[],
  resultVariable?: VariableName,
): FunctionInvocationStatement {
  if (argumentsNode.length < 1) {
    throw new WorkflowSyntaxError(
      'The first argument must be a Function',
      node.loc,
    )
  }

  let functionName: string
  const argNode =
    argumentsNode[0].type === AST_NODE_TYPES.TSInstantiationExpression
      ? argumentsNode[0].expression
      : argumentsNode[0]
  if (argNode.type === AST_NODE_TYPES.Identifier) {
    functionName = argNode.name
  } else if (argNode.type === AST_NODE_TYPES.MemberExpression) {
    const memberExp = convertMemberExpression(argNode)

    if (!isFullyQualifiedName(memberExp)) {
      throw new WorkflowSyntaxError(
        'Function name must be a fully-qualified name',
        argNode.loc,
      )
    }

    functionName = expressionToString(memberExp)
  } else {
    throw new WorkflowSyntaxError(
      'Expected an identifier or a member expression',
      argNode.loc,
    )
  }

  let args: WorkflowParameters = {}
  if (argumentsNode.length >= 2) {
    if (argumentsNode[1].type !== AST_NODE_TYPES.ObjectExpression) {
      throw new WorkflowSyntaxError(
        'The second argument must be an object',
        argumentsNode[1].loc,
      )
    }

    args = convertObjectExpression(argumentsNode[1]).value
  }

  return new FunctionInvocationStatement(functionName, args, resultVariable)
}

function blockingFunctionStatement(
  functionName: string,
  argumentNames: string[],
  argumentsNode: TSESTree.CallExpressionArgument[],
  resultName?: string,
): FunctionInvocationStatement {
  const argumentExpressions =
    throwIfSpread(argumentsNode).map(convertExpression)
  const args: Record<string, Expression> = Object.fromEntries(
    argumentNames.flatMap((argName, i) => {
      if (i >= argumentExpressions.length) {
        return []
      } else if (
        argumentsNode[i].type === AST_NODE_TYPES.Identifier &&
        argumentsNode[i].name === 'undefined'
      ) {
        return []
      } else {
        return [[argName, argumentExpressions[i]]] as const
      }
    }),
  )

  return new FunctionInvocationStatement(functionName, args, resultName)
}

function callExpressionToParallelStatement(
  node: TSESTree.CallExpression,
  ctx: ParsingContext,
): ParallelStatement | ParallelForStatement {
  if (
    node.callee.type !== AST_NODE_TYPES.Identifier ||
    node.callee.name !== 'parallel'
  ) {
    throw new InternalTranspilingError(
      `The parameter must be a call to "parallel"`,
    )
  }

  let shared: string[] | undefined = undefined
  let concurrencyLimit: number | undefined = undefined
  let exceptionPolicy: string | undefined = undefined
  if (node.arguments.length > 1) {
    const options = parseParallelOptions(node.arguments[1])
    shared = options.shared
    concurrencyLimit = options.concurrencyLimit
    exceptionPolicy = options.exceptionPolicy
  }

  const ctx2: ParsingContext = Object.assign({}, ctx, {
    parallelNestingLevel: ctx.parallelNestingLevel
      ? ctx.parallelNestingLevel + 1
      : 1,
  })

  switch (node.arguments[0]?.type) {
    case AST_NODE_TYPES.ArrayExpression:
      return new ParallelStatement(
        parseParallelBranches(node.arguments[0], ctx2),
        shared,
        concurrencyLimit,
        exceptionPolicy,
      )

    case AST_NODE_TYPES.ArrowFunctionExpression:
      return new ParallelForStatement(
        parseParallelIteration(node.arguments[0], ctx2),
        shared,
        concurrencyLimit,
        exceptionPolicy,
      )

    case undefined:
      throw new WorkflowSyntaxError('At least one argument required', node.loc)

    default:
      throw new WorkflowSyntaxError(
        'The first parameter must be an array of functions or an arrow function',
        node.arguments[0].loc,
      )
  }
}

function parseParallelBranches(
  node: TSESTree.ArrayExpression,
  ctx: ParsingContext,
): ParallelBranch[] {
  const branches = node.elements.map((arg) => {
    switch (arg?.type) {
      case AST_NODE_TYPES.Identifier:
        return [new FunctionInvocationStatement(arg.name)]

      case AST_NODE_TYPES.ArrowFunctionExpression:
        if (arg.body.type !== AST_NODE_TYPES.BlockStatement) {
          throw new WorkflowSyntaxError(
            'The body must be a block statement',
            arg.body.loc,
          )
        }

        if (arg.params.length > 0) {
          throw new WorkflowSyntaxError(
            'Parallel functions must not take arguments',
            arg.params[0].loc,
          )
        }

        return parseStatement(arg.body, ctx)

      default:
        throw new WorkflowSyntaxError(
          'Argument should be a function of type () => void',
          arg ? arg.loc : node.loc,
        )
    }
  })

  return branches.map((statements, i) => ({
    name: `branch${i + 1}`,
    body: statements,
  }))
}

function parseParallelIteration(
  node: TSESTree.ArrowFunctionExpression,
  ctx: ParsingContext,
): ForStatement {
  if (
    node.body.type !== AST_NODE_TYPES.BlockStatement ||
    node.body.body.length !== 1 ||
    node.body.body[0].type !== AST_NODE_TYPES.ForOfStatement
  ) {
    throw new WorkflowSyntaxError(
      'The parallel function body must be a single for...of statement',
      node.body.loc,
    )
  }

  return createForOfStatement(node.body.body[0], ctx)
}

function parseParallelOptions(node: TSESTree.CallExpressionArgument) {
  if (node.type !== AST_NODE_TYPES.ObjectExpression) {
    throw new WorkflowSyntaxError(
      'The second parameter must be an object',
      node.loc,
    )
  }

  const parallelOptions = convertObjectExpression(node)
  const opts = parallelOptions.value as Record<string, Expression | undefined>
  const sharedExpression = opts.shared
  if (sharedExpression && sharedExpression.tag !== 'list') {
    throw new WorkflowSyntaxError(
      '"shared" must be an array of strings',
      node.loc,
    )
  }

  const shared = sharedExpression?.value.map((x) => {
    if (x.tag !== 'string') {
      throw new WorkflowSyntaxError(
        '"shared" must be an array of strings',
        node.loc,
      )
    }

    return x
  })

  const concurrencyLimitExpression = opts.concurrency_limit
  if (
    concurrencyLimitExpression &&
    concurrencyLimitExpression.tag !== 'number'
  ) {
    throw new WorkflowSyntaxError(
      '"concurrency_limit" must be a number',
      node.loc,
    )
  }

  const exceptionPolicyExpression = opts.exception_policy
  if (exceptionPolicyExpression && exceptionPolicyExpression.tag !== 'string') {
    throw new WorkflowSyntaxError(
      '"exception_policy" must be a string',
      node.loc,
    )
  }

  return {
    shared: shared?.map((x) => x.value),
    concurrencyLimit: concurrencyLimitExpression?.value,
    exceptionPolicy: exceptionPolicyExpression?.value,
  }
}

function generalExpressionToAssignment(
  node: TSESTree.Expression,
  ctx: ParsingContext,
): AssignStatement {
  return new AssignStatement([
    {
      name: variableReferenceEx(tempName(ctx)),
      value: convertExpression(node),
    },
  ])
}

function createReturnStatement(
  node: TSESTree.ReturnStatement,
): ReturnStatement | AssignStatement {
  const value = node.argument ? convertExpression(node.argument) : undefined

  return new ReturnStatement(value)
}

function createRaiseStatement(node: TSESTree.ThrowStatement): RaiseStatement {
  return new RaiseStatement(convertExpression(node.argument))
}

function createIfStatement(
  node: TSESTree.IfStatement,
  ctx: ParsingContext,
): IfStatement {
  return new IfStatement(flattenIfBranches(node, ctx))
}

function flattenIfBranches(
  ifStatement: TSESTree.IfStatement,
  ctx: ParsingContext,
): IfBranch[] {
  const branches = [
    {
      condition: convertExpression(ifStatement.test),
      body: parseStatement(ifStatement.consequent, ctx),
    },
  ]

  if (ifStatement.alternate) {
    if (ifStatement.alternate.type === AST_NODE_TYPES.IfStatement) {
      branches.push(...flattenIfBranches(ifStatement.alternate, ctx))
    } else {
      branches.push({
        condition: trueEx,
        body: parseStatement(ifStatement.alternate, ctx),
      })
    }
  }

  return branches
}

function createSwitchStatement(
  node: TSESTree.SwitchStatement,
  ctx: ParsingContext,
): WorkflowStatement[] {
  const discriminant = convertExpression(node.discriminant)
  const branches: IfBranch[] = node.cases.map((switchCase) => {
    let condition: Expression
    if (switchCase.test) {
      const test = convertExpression(switchCase.test)
      condition = binaryEx(discriminant, '==', test)
    } else {
      condition = trueEx
    }

    const body = switchCase.consequent.flatMap((x) => parseStatement(x, ctx))

    return { condition, body }
  })

  return [new SwitchStatement(branches)]
}

function createForOfStatement(
  node: TSESTree.ForOfStatement,
  ctx: ParsingContext,
): ForStatement {
  const bodyCtx = Object.assign({}, ctx, {
    continueTarget: undefined,
    breakTarget: undefined,
  })
  const statements = parseStatement(node.body, bodyCtx)

  let loopVariableName: string
  if (node.left.type === AST_NODE_TYPES.Identifier) {
    loopVariableName = node.left.name
  } else if (node.left.type === AST_NODE_TYPES.VariableDeclaration) {
    if (node.left.declarations.length !== 1) {
      throw new WorkflowSyntaxError(
        'Only one variable can be declared here',
        node.left.loc,
      )
    }

    const declaration = node.left.declarations[0]
    if (declaration.init !== null) {
      throw new WorkflowSyntaxError(
        'Initial value not allowed',
        declaration.init.loc,
      )
    }

    if (declaration.id.type !== AST_NODE_TYPES.Identifier) {
      throw new WorkflowSyntaxError(
        `Identifier expected, got ${declaration.id.type}`,
        declaration.id.loc,
      )
    }

    loopVariableName = declaration.id.name
  } else {
    throw new InternalTranspilingError(
      `Identifier or VariableDeclaration expected, got ${node.left.type}`,
    )
  }

  const listExpression = convertExpression(node.right)

  if (
    listExpression.tag === 'string' ||
    listExpression.tag === 'number' ||
    listExpression.tag === 'boolean' ||
    listExpression.tag === 'map' ||
    listExpression.tag === 'null'
  ) {
    throw new WorkflowSyntaxError('Must be a list expression', node.right.loc)
  }

  return new ForStatement(statements, loopVariableName, listExpression)
}

function createWhileStatement(
  node: TSESTree.WhileStatement,
  ctx: ParsingContext,
): WorkflowStatement[] {
  const condition = convertExpression(node.test)
  const body = parseStatement(node.body, ctx)
  return [new WhileStatement(condition, body)]
}

function createDoWhileStatement(
  node: TSESTree.DoWhileStatement,
  ctx: ParsingContext,
): WorkflowStatement[] {
  const body = parseStatement(node.body, ctx)
  const condition = convertExpression(node.test)
  return [new DoWhileStatement(condition, body)]
}

function createBreakStatement(node: TSESTree.BreakStatement): BreakStatement {
  return new BreakStatement(node.label?.name)
}

function createContinueStatement(
  node: TSESTree.ContinueStatement,
): ContinueStatement {
  return new ContinueStatement(node.label?.name)
}

function createTryStatement(
  node: TSESTree.TryStatement,
  ctx: ParsingContext,
): WorkflowStatement[] {
  const retryPolicy = extractRetryPolicy(node.block)
  const tryBody = parseStatement(node.block, ctx)

  let exceptBody: WorkflowStatement[] | undefined = undefined
  let errorVariable: string | undefined = undefined
  if (node.handler) {
    exceptBody = parseStatement(node.handler.body, ctx)
    errorVariable = extractErrorVariableName(node.handler.param)
  }

  let finalizerBody: WorkflowStatement[] | undefined = undefined
  if (node.finalizer) {
    finalizerBody = parseStatement(node.finalizer, ctx)
  }

  return [
    new TryStatement(
      tryBody,
      exceptBody,
      retryPolicy,
      errorVariable,
      finalizerBody,
    ),
  ]
}

function extractRetryPolicy(
  tryBlock: TSESTree.BlockStatement,
): CustomRetryPolicy | string | undefined {
  // Find and parse the first retry_policy() in tryBlock
  for (const statement of tryBlock.body) {
    if (
      statement.type === AST_NODE_TYPES.ExpressionStatement &&
      statement.expression.type === AST_NODE_TYPES.CallExpression &&
      statement.expression.callee.type === AST_NODE_TYPES.Identifier &&
      statement.expression.callee.name === 'retry_policy'
    ) {
      if (statement.expression.arguments.length < 1) {
        throw new WorkflowSyntaxError(
          'Required argument missing',
          statement.expression.loc,
        )
      }

      const arg0 = throwIfSpread(statement.expression.arguments).map(
        convertExpression,
      )[0]
      const argsLoc = statement.expression.arguments[0].loc

      if (isFullyQualifiedName(arg0)) {
        return expressionToString(arg0)
      } else if (arg0.tag === 'map') {
        return retryPolicyFromParams(arg0.value, argsLoc)
      } else {
        throw new WorkflowSyntaxError('Unexpected type', argsLoc)
      }
    }
  }

  return undefined
}

function retryPolicyFromParams(
  params: Record<string, Expression>,
  argsLoc: TSESTree.SourceLocation,
): CustomRetryPolicy {
  if (!('backoff' in params)) {
    throw new WorkflowSyntaxError(
      'Required parameter "backoff" missing',
      argsLoc,
    )
  } else if (params.backoff.tag !== 'map') {
    throw new WorkflowSyntaxError(
      'Expected "backoff" to be an object literal',
      argsLoc,
    )
  }

  const backoff = params.backoff.value

  return {
    predicate: predicateFromRetryParams(params, argsLoc),
    maxRetries: params.max_retries,
    backoff: {
      initialDelay: backoff.initial_delay,
      maxDelay: backoff.max_delay,
      multiplier: backoff.multiplier,
    },
  }
}

function predicateFromRetryParams(
  params: Record<string, Expression>,
  argsLoc: TSESTree.SourceLocation,
): string | undefined {
  if (!('predicate' in params)) {
    return undefined
  } else if (isFullyQualifiedName(params.predicate)) {
    return expressionToString(params.predicate)
  } else {
    throw new WorkflowSyntaxError(
      '"predicate" must be a function name',
      argsLoc,
    )
  }
}

function extractErrorVariableName(
  param: TSESTree.BindingName | null,
): string | undefined {
  if (!param) {
    return undefined
  }

  if (param.type !== AST_NODE_TYPES.Identifier) {
    throw new WorkflowSyntaxError(
      'The error variable must be an identifier',
      param.loc,
    )
  }

  return param.name
}

function createLabeledStatement(
  node: TSESTree.LabeledStatement,
  ctx: ParsingContext,
): LabelledStatement {
  return new LabelledStatement(node.label.name, parseStatement(node.body, ctx))
}

function tempName(ctx: ParsingContext): VariableName {
  if (ctx.parallelNestingLevel !== undefined) {
    // Temporary variable inside a parallel step can not be the same as temporary
    // variables on the outside. Sharing the variable name would cause deployment
    // error, if the variable is not marked as shared by including it in the
    // "shared" array.
    return `__temp_parallel${ctx.parallelNestingLevel}`
  } else {
    return '__temp'
  }
}
