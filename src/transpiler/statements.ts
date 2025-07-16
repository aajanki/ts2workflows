import * as R from 'ramda'
import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/typescript-estree'
import {
  AssignStepAST,
  CallStepAST,
  CustomRetryPolicy,
  ForRangeStepAST,
  ForStepAST,
  JumpTargetAST,
  NextStepAST,
  ParallelBranch,
  ParallelIterationStepAST,
  ParallelStepAST,
  RaiseStepAST,
  ReturnStepAST,
  StepName,
  SwitchConditionAST,
  SwitchStepAST,
  TryStepAST,
  VariableAssignment,
  WorkflowParameters,
  WorkflowStepAST,
} from '../ast/steps.js'
import {
  BinaryExpression,
  BinaryOperator,
  Expression,
  FunctionInvocationExpression,
  ListExpression,
  MemberExpression,
  NumberExpression,
  StringExpression,
  VariableName,
  VariableReferenceExpression,
  isFullyQualifiedName,
  isLiteral,
  isPure,
  nullEx,
  trueEx,
} from '../ast/expressions.js'
import { InternalTranspilingError, WorkflowSyntaxError } from '../errors.js'
import {
  convertExpression,
  convertMemberExpression,
  convertObjectExpression,
  isIntrinsic,
  throwIfSpread,
  isIntrinsicStatement,
  convertVariableNameExpression,
} from './expressions.js'
import { blockingFunctions } from './generated/functionMetadata.js'

export interface ParsingContext {
  // breakTarget is a jump target for an unlabeled break statement
  readonly breakTarget?: StepName
  // continueTarget is a jump target for an unlabeled continue statement
  readonly continueTarget?: StepName
  // parallelNestingLevel is the current nesting level of parallel steps. Used
  // for naming temporary variables inside parallel branches.
  readonly parallelNestingLevel?: number
  // finalizerTargets is an array of jump targets for return statements. Used
  // for delaying a return until a finally block. Array of nested try-finally
  // blocks, the inner most block is last. This also used as a flag to indicate
  // that we are in a try or catch block that has a related finally block.
  finalizerTargets?: StepName[]
}

export function parseStatement(
  node: TSESTree.Statement,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  switch (node.type) {
    case AST_NODE_TYPES.BlockStatement:
      return node.body.flatMap((node) => parseStatement(node, ctx))

    case AST_NODE_TYPES.VariableDeclaration:
      return convertVariableDeclarations(node, ctx)

    case AST_NODE_TYPES.ExpressionStatement:
      if (node.expression.type === AST_NODE_TYPES.AssignmentExpression) {
        return assignmentExpressionToSteps(node.expression, ctx)
      } else if (node.expression.type === AST_NODE_TYPES.CallExpression) {
        return callExpressionToStep(node.expression, undefined, ctx)
      } else {
        return [generalExpressionToAssignStep(node.expression, ctx)]
      }

    case AST_NODE_TYPES.ReturnStatement:
      return [returnStatementToReturnStep(node, ctx)]

    case AST_NODE_TYPES.ThrowStatement:
      return [throwStatementToRaiseStep(node)]

    case AST_NODE_TYPES.IfStatement:
      return [ifStatementToSwitchStep(node, ctx)]

    case AST_NODE_TYPES.SwitchStatement:
      return switchStatementToSteps(node, ctx)

    case AST_NODE_TYPES.ForInStatement:
      throw new WorkflowSyntaxError(
        'for...in is not a supported construct. Use for...of.',
        node.loc,
      )

    case AST_NODE_TYPES.ForOfStatement:
      return [forOfStatementToForStep(node, ctx)]

    case AST_NODE_TYPES.DoWhileStatement:
      return doWhileStatementSteps(node, ctx)

    case AST_NODE_TYPES.WhileStatement:
      return whileStatementSteps(node, ctx)

    case AST_NODE_TYPES.BreakStatement:
      return [breakStatementToNextStep(node, ctx)]

    case AST_NODE_TYPES.ContinueStatement:
      return [continueStatementToNextStep(node, ctx)]

    case AST_NODE_TYPES.TryStatement:
      return tryStatementToTrySteps(node, ctx)

    case AST_NODE_TYPES.LabeledStatement:
      return labeledStep(node, ctx)

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
): WorkflowStepAST[] {
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
): WorkflowStepAST[] {
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

    return callExpressionToStep(initializer, targetVariableName, ctx)
  } else {
    const name = new VariableReferenceExpression(targetVariableName)
    const value = initializer === null ? nullEx : convertExpression(initializer)

    return [new AssignStepAST([{ name, value }])]
  }
}

function convertArrayDestructuring(
  arrayPattern: TSESTree.ArrayPattern,
  initializer: TSESTree.Expression | null,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  let initExpression
  const steps: WorkflowStepAST[] = []
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
    steps.push(...convertInitializer(initName, initializer, ctx))
    initExpression = new VariableReferenceExpression(initName)
  }

  steps.push(
    ...arrayDestructuringSteps(arrayPattern.elements, initExpression, ctx),
  )

  return steps
}

function arrayDestructuringSteps(
  patterns: (TSESTree.DestructuringPattern | null)[],
  initializerExpression: Expression,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  if (patterns.filter((p) => p !== null).length === 0) {
    return []
  }

  const __temp_len = new VariableReferenceExpression(`${tempName(ctx)}_len`)
  const initializeVariables: VariableAssignment[] = [
    {
      name: __temp_len,
      value: new FunctionInvocationExpression('len', [initializerExpression]),
    },
  ]

  const branches: SwitchConditionAST<WorkflowStepAST>[] = R.reverse(
    patterns,
  ).flatMap((pat, i) => {
    if (pat === null) {
      return []
    } else {
      return [
        {
          condition: new BinaryExpression(
            __temp_len,
            '>=',
            new NumberExpression(patterns.length - i),
          ),
          steps: arrayElementsDestructuringSteps(
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
    steps: arrayElementsDestructuringSteps(
      patterns,
      initializerExpression,
      0,
      ctx,
    ),
  })

  return [new AssignStepAST(initializeVariables), new SwitchStepAST(branches)]
}

function arrayElementsDestructuringSteps(
  patterns: (TSESTree.DestructuringPattern | null)[],
  initializerExpression: Expression,
  take: number,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  return patterns.flatMap((pat, i) => {
    if (i >= take) {
      return [
        new AssignStepAST(
          extractDefaultAssignmentsFromDestructuringPattern(pat),
        ),
      ]
    }

    const iElement = new MemberExpression(
      initializerExpression,
      new NumberExpression(i),
      true,
    )

    switch (pat?.type) {
      case AST_NODE_TYPES.MemberExpression:
      case AST_NODE_TYPES.Identifier: {
        const name = convertVariableNameExpression(pat)

        return [new AssignStepAST([{ name, value: iElement }])]
      }

      case AST_NODE_TYPES.AssignmentPattern: {
        if (pat.left.type !== AST_NODE_TYPES.Identifier) {
          throw new WorkflowSyntaxError(
            'Default value can be used only with an identifier',
            pat.left.loc,
          )
        }

        const name = new VariableReferenceExpression(pat.left.name)
        return [new AssignStepAST([{ name, value: iElement }])]
      }

      case AST_NODE_TYPES.ObjectPattern:
        return objectDestructuringSteps(pat.properties, iElement, ctx)

      case AST_NODE_TYPES.ArrayPattern:
        return arrayDestructuringSteps(pat.elements, iElement, ctx)

      case AST_NODE_TYPES.RestElement:
        return arrayRestDestructuringSteps(
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
          name: new VariableReferenceExpression(pat.left.name),
          value: convertExpression(pat.right),
        },
      ]

    case AST_NODE_TYPES.Identifier:
      return [
        { name: new VariableReferenceExpression(pat.name), value: nullEx },
      ]

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
          name: new VariableReferenceExpression(pat.argument.name),
          value: new ListExpression([]),
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

function arrayRestDestructuringSteps(
  patterns: (TSESTree.DestructuringPattern | null)[],
  rest: TSESTree.RestElement,
  initializerExpression: Expression,
  startIndex: number,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  throwIfInvalidRestElement(patterns)

  if (rest.argument.type !== AST_NODE_TYPES.Identifier) {
    throw new WorkflowSyntaxError('Identifier expected', rest.argument.loc)
  }

  const restName = new VariableReferenceExpression(rest.argument.name)
  const __temp_len = new VariableReferenceExpression(`${tempName(ctx)}_len`)
  const __temp_index = `${tempName(ctx)}_index`
  const one = new NumberExpression(1)
  const emptyArray = new ListExpression([])
  const copyLoop = new ForRangeStepAST(
    [
      new AssignStepAST([
        {
          name: restName,
          value: new FunctionInvocationExpression('list.concat', [
            restName,
            new MemberExpression(
              initializerExpression,
              new VariableReferenceExpression(__temp_index),
              true,
            ),
          ]),
        },
      ]),
    ],
    __temp_index,
    startIndex,
    new BinaryExpression(__temp_len, '-', one),
  )

  return [new AssignStepAST([{ name: restName, value: emptyArray }]), copyLoop]
}

function convertObjectDestructuring(
  objectPattern: TSESTree.ObjectPattern,
  initializer: TSESTree.Expression | null,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  let initExpression: Expression
  const steps: WorkflowStepAST[] = []
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
    steps.push(...convertInitializer(initName, initializer, ctx))
    initExpression = new VariableReferenceExpression(initName)
  }

  steps.push(
    ...objectDestructuringSteps(objectPattern.properties, initExpression, ctx),
  )

  return steps
}

function objectDestructuringSteps(
  properties: (TSESTree.RestElement | TSESTree.Property)[],
  initializerExpression: Expression,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  return properties.flatMap((prop) => {
    if (prop.type === AST_NODE_TYPES.RestElement) {
      return objectDestructuringRestSteps(
        properties,
        prop,
        initializerExpression,
      )
    }

    if (prop.key.type !== AST_NODE_TYPES.Identifier) {
      throw new WorkflowSyntaxError('Identifier expected', prop.key.loc)
    }

    const keyExpression = new MemberExpression(
      initializerExpression,
      new VariableReferenceExpression(prop.key.name),
      false,
    )

    if (prop.value.type === AST_NODE_TYPES.ObjectPattern) {
      return objectDestructuringSteps(prop.value.properties, keyExpression, ctx)
    } else if (prop.value.type === AST_NODE_TYPES.ArrayPattern) {
      return arrayDestructuringSteps(prop.value.elements, keyExpression, ctx)
    } else if (prop.value.type === AST_NODE_TYPES.Identifier) {
      const safeKeyExpression = new FunctionInvocationExpression('map.get', [
        initializerExpression,
        new StringExpression(prop.key.name),
      ])

      return [
        new AssignStepAST([
          {
            name: new VariableReferenceExpression(prop.value.name),
            value: safeKeyExpression,
          },
        ]),
      ]
    } else if (prop.value.type === AST_NODE_TYPES.AssignmentPattern) {
      return objectAssignmentPatternSteps(
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

function objectAssignmentPatternSteps(
  pat: TSESTree.AssignmentPattern,
  initializerExpression: Expression,
  keyExpression: MemberExpression,
): WorkflowStepAST[] {
  if (pat.left.type !== AST_NODE_TYPES.Identifier) {
    throw new WorkflowSyntaxError(
      'Default value can be used only with an identifier',
      pat.left.loc,
    )
  }

  // Using Switch step instead of default() because pat.right must be evaluated only
  // in the default value branch (in case it has side effects)
  const name = new VariableReferenceExpression(pat.left.name)
  return [
    new SwitchStepAST([
      {
        condition: new BinaryExpression(
          new StringExpression(pat.left.name),
          'in',
          initializerExpression,
        ),
        steps: [new AssignStepAST([{ name, value: keyExpression }])],
      },
      {
        condition: trueEx,
        steps: [
          new AssignStepAST([{ name, value: convertExpression(pat.right) }]),
        ],
      },
    ]),
  ]
}

function objectDestructuringRestSteps(
  properties: (TSESTree.RestElement | TSESTree.Property)[],
  rest: TSESTree.RestElement,
  initializerExpression: Expression,
): WorkflowStepAST[] {
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

  const name = new VariableReferenceExpression(rest.argument.name)
  const value = nonRestKeys.reduce(
    (acc, propertyName) =>
      // map.delete returns a copy of the object and removes the specified property
      new FunctionInvocationExpression('map.delete', [
        acc,
        new StringExpression(propertyName),
      ]),
    initializerExpression,
  )

  return [new AssignStepAST([{ name, value }])]
}

function assignmentExpressionToSteps(
  node: TSESTree.AssignmentExpression,
  ctx: ParsingContext,
): WorkflowStepAST[] {
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
    return assignmentSteps(node.left, node.right, ctx)
  } else {
    return compoundAssignmentSteps(node.left, node.right, compoundOperator, ctx)
  }
}

function assignmentSteps(
  left: TSESTree.Expression,
  right: TSESTree.Expression,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  let valueExpression: Expression
  const steps: WorkflowStepAST[] = []

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
    steps.push(...tr.steps)
    valueExpression = tr.tempVariable
  } else {
    valueExpression = convertExpression(right)
  }

  const targetExpression = convertVariableNameExpression(left)
  steps.push(
    new AssignStepAST([{ name: targetExpression, value: valueExpression }]),
  )

  return steps
}

function compoundAssignmentSteps(
  left: TSESTree.Expression,
  right: TSESTree.Expression,
  operator: BinaryOperator,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  let valueExpression: Expression
  const { expression: targetExpression, steps } =
    convertCompoundAssignmentLeftHandSide(left, ctx)

  if (
    right.type === AST_NODE_TYPES.CallExpression &&
    right.callee.type === AST_NODE_TYPES.Identifier &&
    isIntrinsic(right.callee.name)
  ) {
    const tr = convertAssignmentExpressionIntrinsicRHS(right, ctx)
    steps.push(...tr.steps)
    valueExpression = tr.tempVariable
  } else {
    valueExpression = convertExpression(right)
  }

  valueExpression = new BinaryExpression(
    targetExpression,
    operator,
    valueExpression,
  )

  steps.push(
    new AssignStepAST([{ name: targetExpression, value: valueExpression }]),
  )

  return steps
}

function convertCompoundAssignmentLeftHandSide(
  left: TSESTree.Expression,
  ctx: ParsingContext,
): {
  expression: MemberExpression | VariableReferenceExpression
  steps: WorkflowStepAST[]
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

  if (leftEx.expressionType === 'member') {
    const { transformed, assignments } = extractSideEffectsFromMemberExpression(
      leftEx,
      tempName(ctx),
      0,
    )
    const steps = [new AssignStepAST(assignments)]

    return { expression: transformed, steps }
  } else {
    return {
      expression: leftEx,
      steps: [],
    }
  }
}

/**
 * Extract side-effecting computed properties into temporary variable assignments.
 *
 * This is used on the left-hand side of a compound assignment expression, which
 * should only be evaluted once.
 */
function extractSideEffectsFromMemberExpression(
  ex: MemberExpression,
  tempPrefix: string,
  tempIndex: number,
): { transformed: MemberExpression; assignments: VariableAssignment[] } {
  if (ex.computed && !isPure(ex.property)) {
    let transformedObject: Expression
    let objectAssignments: VariableAssignment[]

    if (ex.object.expressionType === 'member') {
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

    const tmp = new VariableReferenceExpression(`${tempPrefix}${tempIndex}`)
    const transformed = new MemberExpression(transformedObject, tmp, true)
    const assignments = objectAssignments
    assignments.push({
      name: tmp,
      value: ex.property,
    })

    return { transformed, assignments }
  } else if (ex.object.expressionType === 'member') {
    const { transformed: object2, assignments: assignments } =
      extractSideEffectsFromMemberExpression(ex.object, tempPrefix, tempIndex)
    const transformed = new MemberExpression(object2, ex.property, ex.computed)

    return {
      transformed,
      assignments,
    }
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
): { steps: WorkflowStepAST[]; tempVariable: VariableReferenceExpression } {
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
  const steps = callExpressionToStep(callEx, resultVariable, ctx)
  const tempVariable = new VariableReferenceExpression(resultVariable)

  return { steps, tempVariable }
}

function callExpressionToStep(
  node: TSESTree.CallExpression,
  resultVariable: string | undefined,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  const calleeExpression = convertExpression(node.callee)
  if (isFullyQualifiedName(calleeExpression)) {
    const calleeName = calleeExpression.toString()

    if (calleeName === 'parallel') {
      // A handle the "parallel" intrinsic
      return [callExpressionToParallelStep(node, ctx)]
    } else if (calleeName === 'retry_policy') {
      // retry_policy() is handled by AST_NODE_TYPES.TryStatement and therefore ignored here
      return []
    } else if (calleeName === 'call_step') {
      return [createCallStep(node, node.arguments, resultVariable)]
    } else if (blockingFunctions.has(calleeName)) {
      const argumentNames = blockingFunctions.get(calleeName) ?? []
      return [
        blockingFunctionCallStep(
          calleeName,
          argumentNames,
          node.arguments,
          resultVariable,
        ),
      ]
    } else {
      const resultVariable2 = resultVariable ?? tempName(ctx)

      return [
        callExpressionAssignStep(calleeName, node.arguments, resultVariable2),
      ]
    }
  } else {
    throw new WorkflowSyntaxError(
      'Expeced a subworkflow or a standard library function name',
      node.callee.loc,
    )
  }
}

function callExpressionAssignStep(
  functionName: string,
  argumentsNode: TSESTree.CallExpressionArgument[],
  resultVariable: VariableName,
): AssignStepAST {
  const argumentExpressions =
    throwIfSpread(argumentsNode).map(convertExpression)

  return new AssignStepAST([
    {
      name: new VariableReferenceExpression(resultVariable),
      value: new FunctionInvocationExpression(
        functionName,
        argumentExpressions,
      ),
    },
  ])
}

function createCallStep(
  node: TSESTree.CallExpression,
  argumentsNode: TSESTree.CallExpressionArgument[],
  resultVariable?: VariableName,
): CallStepAST {
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

    functionName = memberExp.toString()
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

  return new CallStepAST(functionName, args, resultVariable)
}

function blockingFunctionCallStep(
  functionName: string,
  argumentNames: string[],
  argumentsNode: TSESTree.CallExpressionArgument[],
  resultName?: string,
): CallStepAST {
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

  return new CallStepAST(functionName, args, resultName)
}

function callExpressionToParallelStep(
  node: TSESTree.CallExpression,
  ctx: ParsingContext,
): ParallelStepAST | ParallelIterationStepAST {
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
      return new ParallelStepAST(
        parseParallelBranches(node.arguments[0], ctx2),
        shared,
        concurrencyLimit,
        exceptionPolicy,
      )

    case AST_NODE_TYPES.ArrowFunctionExpression:
      return new ParallelIterationStepAST(
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
): ParallelBranch<WorkflowStepAST>[] {
  const branches = node.elements.map((arg) => {
    switch (arg?.type) {
      case AST_NODE_TYPES.Identifier:
        return [new CallStepAST(arg.name)]

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

  return branches.map((steps, i) => ({ name: `branch${i + 1}`, steps }))
}

function parseParallelIteration(
  node: TSESTree.ArrowFunctionExpression,
  ctx: ParsingContext,
): ForStepAST {
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

  return forOfStatementToForStep(node.body.body[0], ctx)
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
  if (sharedExpression && sharedExpression.expressionType !== 'list') {
    throw new WorkflowSyntaxError(
      '"shared" must be an array of strings',
      node.loc,
    )
  }

  const shared = sharedExpression?.value.map((x) => {
    if (x.expressionType !== 'string') {
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
    concurrencyLimitExpression.expressionType !== 'number'
  ) {
    throw new WorkflowSyntaxError(
      '"concurrency_limit" must be a number',
      node.loc,
    )
  }

  const exceptionPolicyExpression = opts.exception_policy
  if (
    exceptionPolicyExpression &&
    exceptionPolicyExpression.expressionType !== 'string'
  ) {
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

function generalExpressionToAssignStep(
  node: TSESTree.Expression,
  ctx: ParsingContext,
): AssignStepAST {
  return new AssignStepAST([
    {
      name: new VariableReferenceExpression(tempName(ctx)),
      value: convertExpression(node),
    },
  ])
}

function returnStatementToReturnStep(
  node: TSESTree.ReturnStatement,
  ctx: ParsingContext,
): ReturnStepAST | AssignStepAST {
  const value = node.argument ? convertExpression(node.argument) : undefined

  if (ctx.finalizerTargets && ctx.finalizerTargets.length > 0) {
    // If we are in try statement with a finally block, return statements are
    // replaced by a jump to finally back with a captured return value.
    return delayedReturnAndJumpToFinalizer(value, ctx)
  }

  return new ReturnStepAST(value)
}

function throwStatementToRaiseStep(
  node: TSESTree.ThrowStatement,
): RaiseStepAST {
  return new RaiseStepAST(convertExpression(node.argument))
}

function ifStatementToSwitchStep(
  node: TSESTree.IfStatement,
  ctx: ParsingContext,
): SwitchStepAST {
  return new SwitchStepAST(flattenIfBranches(node, ctx))
}

function flattenIfBranches(
  ifStatement: TSESTree.IfStatement,
  ctx: ParsingContext,
): SwitchConditionAST<WorkflowStepAST>[] {
  const branches = [
    {
      condition: convertExpression(ifStatement.test),
      steps: parseStatement(ifStatement.consequent, ctx),
    },
  ]

  if (ifStatement.alternate) {
    if (ifStatement.alternate.type === AST_NODE_TYPES.IfStatement) {
      branches.push(...flattenIfBranches(ifStatement.alternate, ctx))
    } else {
      branches.push({
        condition: trueEx,
        steps: parseStatement(ifStatement.alternate, ctx),
      })
    }
  }

  return branches
}

function switchStatementToSteps(
  node: TSESTree.SwitchStatement,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  const endOfSwitch = new JumpTargetAST()
  const switchCtx = Object.assign({}, ctx, { breakTarget: endOfSwitch.label })

  const steps: WorkflowStepAST[] = []
  const branches: SwitchConditionAST<WorkflowStepAST>[] = []
  const discriminant = convertExpression(node.discriminant)

  node.cases.forEach((caseNode) => {
    let condition: Expression
    if (caseNode.test) {
      const test = convertExpression(caseNode.test)
      condition = new BinaryExpression(discriminant, '==', test)
    } else {
      condition = trueEx
    }

    const jumpTarget = new JumpTargetAST()
    const body = caseNode.consequent.flatMap((x) =>
      parseStatement(x, switchCtx),
    )

    steps.push(jumpTarget)
    steps.push(...body)

    branches.push({
      condition,
      steps: [],
      next: jumpTarget.label,
    })
  })

  steps.unshift(new SwitchStepAST(branches))
  steps.push(endOfSwitch)

  return steps
}

function forOfStatementToForStep(
  node: TSESTree.ForOfStatement,
  ctx: ParsingContext,
): ForStepAST {
  const bodyCtx = Object.assign({}, ctx, {
    continueTarget: undefined,
    breakTarget: undefined,
  })
  const steps = parseStatement(node.body, bodyCtx)

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

  if (isLiteral(listExpression) && listExpression.expressionType !== 'list') {
    throw new WorkflowSyntaxError('Must be a list expression', node.right.loc)
  }

  return new ForStepAST(steps, loopVariableName, listExpression)
}

function whileStatementSteps(
  node: TSESTree.WhileStatement,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  const startOfLoop = new JumpTargetAST()
  const endOfLoop = new JumpTargetAST()
  const ctx2 = Object.assign({}, ctx, {
    continueTarget: startOfLoop.label,
    breakTarget: endOfLoop.label,
  })
  const postSteps = [new NextStepAST(startOfLoop.label)]
  const steps = parseStatement(node.body, ctx2).concat(postSteps)

  return [
    startOfLoop,
    new SwitchStepAST([
      {
        condition: convertExpression(node.test),
        steps,
      },
    ]),
    endOfLoop,
  ]
}

function doWhileStatementSteps(
  node: TSESTree.DoWhileStatement,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  const startOfLoop = new JumpTargetAST()
  const endOfLoop = new JumpTargetAST()
  const ctx2 = Object.assign({}, ctx, {
    continueTarget: startOfLoop.label,
    breakTarget: endOfLoop.label,
  })

  const steps: WorkflowStepAST[] = [startOfLoop]
  steps.push(...parseStatement(node.body, ctx2))
  steps.push(
    new SwitchStepAST([
      {
        condition: convertExpression(node.test),
        steps: [],
        next: startOfLoop.label,
      },
    ]),
  )
  steps.push(endOfLoop)

  return steps
}

function breakStatementToNextStep(
  node: TSESTree.BreakStatement,
  ctx: ParsingContext,
): NextStepAST {
  if (ctx.finalizerTargets) {
    // TODO: would need to detect if this breaks out of the try or catch block,
    // execute the finally block first and then do the break.
    throw new WorkflowSyntaxError(
      'break is not supported inside a try-finally block',
      node.loc,
    )
  }

  let target: StepName
  if (node.label) {
    target = node.label.name
  } else if (ctx.breakTarget) {
    target = ctx.breakTarget
  } else {
    target = 'break'
  }

  return new NextStepAST(target)
}

function continueStatementToNextStep(
  node: TSESTree.ContinueStatement,
  ctx: ParsingContext,
): NextStepAST {
  if (ctx.finalizerTargets) {
    // TODO: would need to detect if continue breaks out of the try or catch block,
    // execute the finally block first and then do the continue.
    throw new WorkflowSyntaxError(
      'continue is not supported inside a try-finally block',
      node.loc,
    )
  }

  let target: StepName
  if (node.label) {
    target = node.label.name
  } else if (ctx.continueTarget) {
    target = ctx.continueTarget
  } else {
    target = 'continue'
  }

  return new NextStepAST(target)
}

function tryStatementToTrySteps(
  node: TSESTree.TryStatement,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  const retryPolicy = extractRetryPolicy(node.block)

  if (!node.finalizer) {
    // Basic try-catch without a finally block
    const baseTryStep = parseTryCatchRetry(node, ctx, retryPolicy)
    return [baseTryStep]
  } else {
    // Try-finally is translated to two nested try blocks. The innermost try is
    // the actual try body with control flow statements (return, in the future
    // also break/continue) replaced by jumps to the finally block.
    //
    // The outer try's catch block saved the exception and continues to the
    // finally block.
    //
    // The nested try blocks are followed by the finally block and a swith for
    // checking if we need to perform a delayed return/raise.
    const startOfFinalizer = new JumpTargetAST()

    const targets = ctx.finalizerTargets ?? []
    targets.push(startOfFinalizer.label)
    ctx = Object.assign({}, ctx, { finalizerTargets: targets })

    const [conditionVariable, valueVariable] = finalizerVariables(ctx)

    const innerTry = parseTryCatchRetry(node, ctx, retryPolicy)

    const outerTry = new TryStepAST(
      [innerTry],
      finalizerDelayedException('__fin_exc', conditionVariable, valueVariable),
      undefined,
      '__fin_exc',
    )

    // Reset ctx before parsing the finally block because we don't want to
    // transform returns in finally block in to delayed returns
    if (ctx.finalizerTargets && ctx.finalizerTargets.length <= 1) {
      delete ctx.finalizerTargets
    } else {
      ctx.finalizerTargets?.pop()
    }

    const finallyBlock = parseStatement(node.finalizer, ctx)

    return [
      finalizerInitializer(conditionVariable, valueVariable),
      outerTry,
      startOfFinalizer,
      ...finallyBlock,
      finalizerFooter(conditionVariable, valueVariable),
    ]
  }
}

function finalizerVariables(ctx: ParsingContext): [string, string] {
  const targets = ctx.finalizerTargets ?? []
  const nestingLevel = targets.length > 0 ? `${targets.length}` : ''
  const conditionVariable = `__t2w_finally_condition${nestingLevel}`
  const valueVariable = `__t2w_finally_value${nestingLevel}`

  return [conditionVariable, valueVariable]
}

function parseTryCatchRetry(
  node: TSESTree.TryStatement,
  ctx: ParsingContext,
  retryPolicy: string | CustomRetryPolicy | undefined,
) {
  const trySteps = parseStatement(node.block, ctx)

  let exceptSteps: WorkflowStepAST[] | undefined = undefined
  let errorVariable: string | undefined = undefined
  if (node.handler) {
    exceptSteps = parseStatement(node.handler.body, ctx)
    errorVariable = extractErrorVariableName(node.handler.param)
  }

  const baseTryStep = new TryStepAST(
    trySteps,
    exceptSteps,
    retryPolicy,
    errorVariable,
  )
  return baseTryStep
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

/**
 * The shared header for try-finally for initializing the temp variables
 */
function finalizerInitializer(
  conditionVariable: string,
  valueVariable: string,
): AssignStepAST {
  return new AssignStepAST([
    {
      name: new VariableReferenceExpression(conditionVariable),
      value: nullEx,
    },
    {
      name: new VariableReferenceExpression(valueVariable),
      value: nullEx,
    },
  ])
}

/**
 * The shared footer of a finally block that re-throws the exception or
 * returns the value returned by the try body.
 *
 * The footer code in TypeScript:
 *
 * if (__t2w_finally_condition == "return") {
 *   return __t2w_finally_value
 * } elseif (__t2w_finally_condition == "raise") {
 *   throw __t2w_finally_value
 * }
 */
function finalizerFooter(conditionVariable: string, valueVariable: string) {
  const variable = new VariableReferenceExpression(conditionVariable)
  const val = new VariableReferenceExpression(valueVariable)
  const returnString = new StringExpression('return')
  const raiseString = new StringExpression('raise')

  return new SwitchStepAST([
    {
      condition: new BinaryExpression(variable, '==', returnString),
      steps: [new ReturnStepAST(val)],
    },
    {
      condition: new BinaryExpression(variable, '==', raiseString),
      steps: [new RaiseStepAST(val)],
    },
  ])
}

function finalizerDelayedException(
  exceptionVariableName: string,
  conditionVariableName: string,
  valueVariableName: string,
): WorkflowStepAST[] {
  return [
    new AssignStepAST([
      {
        name: new VariableReferenceExpression(conditionVariableName),
        value: new StringExpression('raise'),
      },
      {
        name: new VariableReferenceExpression(valueVariableName),
        value: new VariableReferenceExpression(exceptionVariableName),
      },
    ]),
  ]
}

function delayedReturnAndJumpToFinalizer(
  value: Expression | undefined,
  ctx: ParsingContext,
): AssignStepAST {
  const finalizerTarget =
    ctx.finalizerTargets && ctx.finalizerTargets.length > 0
      ? ctx.finalizerTargets[ctx.finalizerTargets.length - 1]
      : undefined
  const [conditionVariable, valueVariable] = finalizerVariables(ctx)

  return new AssignStepAST(
    [
      {
        name: new VariableReferenceExpression(conditionVariable),
        value: new StringExpression('return'),
      },
      {
        name: new VariableReferenceExpression(valueVariable),
        value: value ?? nullEx,
      },
    ],
    finalizerTarget,
  )
}

function labeledStep(
  node: TSESTree.LabeledStatement,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  const steps = parseStatement(node.body, ctx)
  if (steps.length > 0 && steps[0].tag !== 'jumptarget') {
    steps[0] = steps[0].withLabel(node.label.name)
  }

  return steps
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
        return arg0.toString()
      } else if (arg0.expressionType === 'map') {
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
  } else if (params.backoff.expressionType !== 'map') {
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
    return params.predicate.toString()
  } else {
    throw new WorkflowSyntaxError(
      '"predicate" must be a function name',
      argsLoc,
    )
  }
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
