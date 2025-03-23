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
  ParallelStepAST,
  RaiseStepAST,
  ReturnStepAST,
  StepName,
  StepsStepAST,
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
  MemberExpression,
  Primitive,
  PrimitiveExpression,
  VariableName,
  VariableReferenceExpression,
  isExpression,
  isFullyQualifiedName,
  isLiteral,
} from '../ast/expressions.js'
import { InternalTranspilingError, WorkflowSyntaxError } from '../errors.js'
import { chainPairs, isRecord } from '../utils.js'
import { transformAST } from './transformations.js'
import {
  convertExpression,
  convertMemberExpression,
  convertObjectExpression,
  convertObjectAsExpressionValues,
  isMagicFunction,
  throwIfSpread,
  isMagicFunctionStatmentOnly,
  asExpression,
  safeAsExpression,
} from './expressions.js'
import { blockingFunctions } from './generated/functionMetadata.js'

export interface ParsingContext {
  // a jump target for an unlabeled break statement
  breakTarget?: StepName
  // a jump target for an unlabeled continue statement
  continueTarget?: StepName
  // a jump target of a return statement, for delaying a return until a finally block.
  // Array of nested try-finally blocks, the inner most block is last.
  // This also used as a flag to indicate that we are in a try or catch block
  // that has a related finally block.
  finalizerTargets?: StepName[]
}

export function parseStatement(
  node: TSESTree.Statement,
  ctx: ParsingContext,
  postSteps?: WorkflowStepAST[],
): WorkflowStepAST[] {
  const steps = parseStatementRecursively(node, undefined, ctx)
  return transformAST(steps.concat(postSteps ?? []))
}

function parseStatementRecursively(
  node: TSESTree.Statement,
  nextNode: TSESTree.Statement | undefined,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  switch (node.type) {
    case AST_NODE_TYPES.BlockStatement:
      return chainPairs(
        R.partialRight(parseStatementRecursively, [ctx]),
        node.body,
      )

    case AST_NODE_TYPES.VariableDeclaration:
      return convertVariableDeclarations(node.declarations, ctx)

    case AST_NODE_TYPES.ExpressionStatement:
      if (node.expression.type === AST_NODE_TYPES.AssignmentExpression) {
        return assignmentExpressionToSteps(node.expression, ctx)
      } else if (node.expression.type === AST_NODE_TYPES.CallExpression) {
        return callExpressionToStep(node.expression, undefined, ctx)
      } else {
        return [generalExpressionToAssignStep(node.expression)]
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

    case AST_NODE_TYPES.TryStatement: {
      let retryPolicy: CustomRetryPolicy | string | undefined = undefined
      if (
        nextNode?.type === AST_NODE_TYPES.ExpressionStatement &&
        nextNode.expression.type === AST_NODE_TYPES.CallExpression
      ) {
        retryPolicy = parseRetryPolicy(nextNode.expression)
      }

      return tryStatementToTrySteps(node, retryPolicy, ctx)
    }

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
      throw new WorkflowSyntaxError(
        `TODO: encountered unsupported type: ${node.type}`,
        node.loc,
      )
  }
}

function convertVariableDeclarations(
  declarations: TSESTree.LetOrConstOrVarDeclarator[],
  ctx: ParsingContext,
): WorkflowStepAST[] {
  return declarations.flatMap((decl) => {
    if (decl.id.type === AST_NODE_TYPES.Identifier) {
      return convertInitializer(decl.id.name, decl.init, ctx)
    } else if (decl.id.type === AST_NODE_TYPES.ArrayPattern) {
      return convertArrayDestructionDeclarator(decl.id, decl.init, ctx)
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
    if (calleeName && isMagicFunctionStatmentOnly(calleeName)) {
      throw new WorkflowSyntaxError(
        `"${calleeName}" can't be called as part of an expression`,
        initializer.callee.loc,
      )
    }

    return callExpressionToStep(initializer, targetVariableName, ctx)
  } else {
    const value =
      initializer === null
        ? new PrimitiveExpression(null)
        : convertExpression(initializer)

    return [new AssignStepAST([[targetVariableName, value]])]
  }
}

function convertArrayDestructionDeclarator(
  arrayPattern: TSESTree.ArrayPattern,
  initializer: TSESTree.Expression | null,
  ctx: ParsingContext,
): WorkflowStepAST[] {
  let initName: string
  const steps: WorkflowStepAST[] = []
  if (initializer?.type === AST_NODE_TYPES.Identifier) {
    // If the initializer is an Identifier (array variable?), use it directly.
    // This ensures that the recursive variables gets initialized in the correct order.
    // For example:
    // const arr = [1, 2]
    // [arr[1], arr[0]] = arr
    initName = initializer.name
  } else {
    // Otherwise, assign the expression to a temporary variable first.
    initName = '__temp'
    steps.push(...convertInitializer(initName, initializer, ctx))
  }

  steps.push(...arrayDestructuringSteps(arrayPattern.elements, initName))

  return steps
}

function arrayDestructuringSteps(
  patterns: (TSESTree.DestructuringPattern | null)[],
  initializerName: string,
): WorkflowStepAST[] {
  const initializeVariables: VariableAssignment[] = [
    [
      '__temp_len',
      new FunctionInvocationExpression('len', [
        new VariableReferenceExpression(initializerName),
      ]),
    ],
  ]

  const restPattern = findRestProperty(patterns)
  const nonRestPatterns = patterns.filter(
    (pat) => pat?.type !== AST_NODE_TYPES.RestElement,
  )
  const branches: SwitchConditionAST<WorkflowStepAST>[] =
    nonRestPatterns.flatMap((pat, i) => {
      if (pat === null) {
        return []
      } else {
        return [
          {
            condition: new BinaryExpression(
              new VariableReferenceExpression('__temp_len'),
              '>=',
              new PrimitiveExpression(nonRestPatterns.length - i),
            ),
            steps: [
              assignFromArray(
                patterns,
                initializerName,
                nonRestPatterns.length - i,
              ),
            ],
          },
        ]
      }
    })

  branches.push({
    condition: new PrimitiveExpression(true),
    steps: [assignFromArray(patterns, initializerName, 0)],
  })

  if (restPattern) {
    if (restPattern.argument.type !== AST_NODE_TYPES.Identifier) {
      throw new WorkflowSyntaxError(
        'Identifier expected',
        restPattern.argument.loc,
      )
    }
    const restName = restPattern.argument.name
    initializeVariables.push([restName, new PrimitiveExpression([])])
    branches.unshift(
      arrayRestBranch(nonRestPatterns, initializerName, restName),
    )
  }

  return [new AssignStepAST(initializeVariables), new SwitchStepAST(branches)]
}

function assignFromArray(
  patterns: (TSESTree.DestructuringPattern | null)[],
  initializerName: string,
  take: number,
) {
  return new AssignStepAST(
    patterns.flatMap((pat, i) => {
      if (pat === null || pat.type === AST_NODE_TYPES.RestElement) {
        return [] as VariableAssignment[]
      }

      let name: string
      let defaultValue: Expression = new PrimitiveExpression(null)
      if (
        pat.type === AST_NODE_TYPES.MemberExpression ||
        pat.type === AST_NODE_TYPES.Identifier
      ) {
        name = convertExpression(pat).toString()
      } else if (pat.type === AST_NODE_TYPES.AssignmentPattern) {
        if (pat.left.type === AST_NODE_TYPES.Identifier) {
          name = pat.left.name
        } else {
          throw new WorkflowSyntaxError(
            'Default value can be used only with an identifier',
            pat.left.loc,
          )
        }
        defaultValue = convertExpression(pat.right)
      } else {
        throw new WorkflowSyntaxError('Unsupported pattern', pat.loc)
      }

      if (i < take) {
        return [
          [
            name,
            new MemberExpression(
              new VariableReferenceExpression(initializerName),
              new PrimitiveExpression(i),
              true,
            ),
          ],
        ]
      } else {
        return [[name, defaultValue]]
      }
    }),
  )
}

function findRestProperty(
  patterns: (TSESTree.DestructuringPattern | null)[],
): TSESTree.RestElement | undefined {
  return patterns.reduce(
    (_, pat, i) => {
      if (pat?.type === AST_NODE_TYPES.RestElement) {
        if (i !== patterns.length - 1) {
          throw new WorkflowSyntaxError(
            'Rest element must be the last pattern',
            pat.loc,
          )
        }

        return pat
      }
    },
    undefined as TSESTree.RestElement | undefined,
  )
}

function arrayRestBranch(
  nonRestPatterns: (TSESTree.DestructuringPattern | null)[],
  initializerName: string,
  restName: string,
) {
  const assignments = assignFromArray(
    nonRestPatterns,
    initializerName,
    nonRestPatterns.length,
  )

  const copyLoop = new ForRangeStepAST(
    [
      new AssignStepAST([
        [
          restName,
          new FunctionInvocationExpression('list.concat', [
            new VariableReferenceExpression(restName),
            new MemberExpression(
              new VariableReferenceExpression(initializerName),
              new VariableReferenceExpression('__rest_index'),
              true,
            ),
          ]),
        ],
      ]),
    ],
    '__rest_index',
    nonRestPatterns.length,
    new BinaryExpression(
      new VariableReferenceExpression('__temp_len'),
      '-',
      new PrimitiveExpression(1),
    ),
  )

  return {
    condition: new BinaryExpression(
      new VariableReferenceExpression('__temp_len'),
      '>=',
      new PrimitiveExpression(nonRestPatterns.length + 1),
    ),
    steps: [assignments, copyLoop],
  }
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

  if (node.left.type === AST_NODE_TYPES.ArrayPattern) {
    if (node.operator === '=') {
      return convertArrayDestructionDeclarator(node.left, node.right, ctx)
    } else {
      throw new WorkflowSyntaxError(
        `Operator ${node.operator} can not be applied to an array pattern`,
        node.left.loc,
      )
    }
  }

  const targetExpression = convertExpression(node.left)

  if (!isFullyQualifiedName(targetExpression)) {
    throw new WorkflowSyntaxError(
      'The left-hand side of an assignment must be an identifier or a property access',
      node.loc,
    )
  }

  let valueExpression: Expression
  const steps: WorkflowStepAST[] = []
  const targetName = targetExpression.toString()

  if (
    node.right.type === AST_NODE_TYPES.CallExpression &&
    node.right.callee.type === AST_NODE_TYPES.Identifier &&
    isMagicFunction(node.right.callee.name)
  ) {
    const calleeName = node.right.callee.name
    if (isMagicFunctionStatmentOnly(calleeName)) {
      throw new WorkflowSyntaxError(
        `"${calleeName}" can't be called as part of an expression`,
        node.right.callee.loc,
      )
    }

    const needsTempVariable =
      compoundOperator === undefined ||
      node.left.type !== AST_NODE_TYPES.Identifier
    const resultVariable = needsTempVariable ? '__temp' : targetName
    steps.push(...callExpressionToStep(node.right, resultVariable, ctx))

    if (!needsTempVariable) {
      return steps
    }

    valueExpression = new VariableReferenceExpression('__temp')
  } else {
    valueExpression = convertExpression(node.right)
  }

  if (compoundOperator) {
    valueExpression = new BinaryExpression(
      new VariableReferenceExpression(targetName),
      compoundOperator,
      valueExpression,
    )
  }

  steps.push(new AssignStepAST([[targetName, valueExpression]]))

  return steps
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
      // A custom implementation for "parallel"
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
      return [
        callExpressionAssignStep(calleeName, node.arguments, resultVariable),
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
  resultVariable?: VariableName,
): AssignStepAST {
  const argumentExpressions =
    throwIfSpread(argumentsNode).map(convertExpression)

  return new AssignStepAST([
    [
      resultVariable ?? '__temp',
      new FunctionInvocationExpression(functionName, argumentExpressions),
    ],
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

    args = convertObjectAsExpressionValues(argumentsNode[1])
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
): ParallelStepAST {
  if (
    node.callee.type !== AST_NODE_TYPES.Identifier ||
    node.callee.name !== 'parallel'
  ) {
    throw new InternalTranspilingError(
      `The parameter must be a call to "parallel"`,
    )
  }

  let steps: Record<StepName, StepsStepAST> | ForStepAST = {}
  if (node.arguments.length > 0) {
    switch (node.arguments[0].type) {
      case AST_NODE_TYPES.ArrayExpression:
        steps = parseParallelBranches(node.arguments[0])
        break

      case AST_NODE_TYPES.ArrowFunctionExpression:
        steps = parseParallelIteration(node.arguments[0], ctx)
        break

      default:
        throw new WorkflowSyntaxError(
          'The first parameter must be an array of functions or an arrow function',
          node.arguments[0].loc,
        )
    }
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

  return new ParallelStepAST(steps, shared, concurrencyLimit, exceptionPolicy)
}

function parseParallelBranches(
  node: TSESTree.ArrayExpression,
): Record<StepName, StepsStepAST> {
  const stepsArray: [string, StepsStepAST][] = node.elements.map((arg, idx) => {
    const branchName = `branch${idx + 1}`

    if (arg === null) {
      throw new WorkflowSyntaxError(
        'Argument should be a function call of type () => void',
        node.loc,
      )
    }

    switch (arg.type) {
      case AST_NODE_TYPES.Identifier:
        return [branchName, new StepsStepAST([new CallStepAST(arg.name)])]

      case AST_NODE_TYPES.ArrowFunctionExpression:
        if (arg.body.type !== AST_NODE_TYPES.BlockStatement) {
          throw new WorkflowSyntaxError(
            'The body must be a block statement',
            arg.body.loc,
          )
        }
        return [branchName, new StepsStepAST(parseStatement(arg.body, {}))]

      default:
        throw new WorkflowSyntaxError(
          'Argument should be a function call of type () => void',
          arg.loc,
        )
    }
  })

  return Object.fromEntries(stepsArray)
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
  const sharedExpression = parallelOptions.shared
  if (!Array.isArray(sharedExpression)) {
    throw new WorkflowSyntaxError(
      '"shared" must be an array or strings',
      node.loc,
    )
  }

  const shared = sharedExpression.map((x) => {
    if (isExpression(x) || typeof x !== 'string') {
      throw new WorkflowSyntaxError(
        '"shared" must be an array of strings',
        node.loc,
      )
    }

    return x
  })

  const concurrencyLimitExpression = parallelOptions.concurrency_limit
  if (
    typeof concurrencyLimitExpression !== 'number' &&
    typeof concurrencyLimitExpression !== 'undefined'
  ) {
    throw new WorkflowSyntaxError(
      '"concurrency_limit" must be a number',
      node.loc,
    )
  }

  const concurrencyLimit = concurrencyLimitExpression

  const exceptionPolicyExpression = parallelOptions.exception_policy
  if (
    typeof exceptionPolicyExpression !== 'string' &&
    typeof exceptionPolicyExpression !== 'undefined'
  ) {
    throw new WorkflowSyntaxError(
      '"exception_policy" must be a string',
      node.loc,
    )
  }

  const exceptionPolicy = exceptionPolicyExpression

  return {
    shared,
    concurrencyLimit,
    exceptionPolicy,
  }
}

function generalExpressionToAssignStep(
  node: TSESTree.Expression,
): AssignStepAST {
  return new AssignStepAST([['__temp', convertExpression(node)]])
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
        condition: new PrimitiveExpression(true),
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
      condition = new PrimitiveExpression(true)
    }

    const jumpTarget = new JumpTargetAST()
    const body = transformAST(
      caseNode.consequent.flatMap((x) => parseStatement(x, switchCtx)),
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
        `Expected identifier, got ${declaration.id.type}`,
        declaration.id.loc,
      )
    }

    loopVariableName = declaration.id.name
  } else {
    throw new InternalTranspilingError(
      `Expected Identifier or VariableDeclaration, got ${node.left.type}`,
    )
  }

  const listExpression = convertExpression(node.right)

  if (
    isLiteral(listExpression) &&
    listExpression.expressionType === 'primitive' &&
    (isRecord(listExpression.value) ||
      typeof listExpression.value === 'number' ||
      typeof listExpression.value === 'string' ||
      typeof listExpression.value === 'boolean' ||
      listExpression.value === null)
  ) {
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
  const steps = parseStatement(node.body, ctx2, postSteps)

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
  retryPolicy: string | CustomRetryPolicy | undefined,
  ctx: ParsingContext,
): WorkflowStepAST[] {
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
    [conditionVariable, new PrimitiveExpression(null)],
    [valueVariable, new PrimitiveExpression(null)],
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
  return new SwitchStepAST([
    {
      condition: new BinaryExpression(
        new VariableReferenceExpression(conditionVariable),
        '==',
        new PrimitiveExpression('return'),
      ),
      steps: [
        new ReturnStepAST(new VariableReferenceExpression(valueVariable)),
      ],
    },
    {
      condition: new BinaryExpression(
        new VariableReferenceExpression(conditionVariable),
        '==',
        new PrimitiveExpression('raise'),
      ),
      steps: [new RaiseStepAST(new VariableReferenceExpression(valueVariable))],
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
      [conditionVariableName, new PrimitiveExpression('raise')],
      [
        valueVariableName,
        new VariableReferenceExpression(exceptionVariableName),
      ],
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
      [conditionVariable, new PrimitiveExpression('return')],
      [valueVariable, value ?? new PrimitiveExpression(null)],
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

function parseRetryPolicy(
  node: TSESTree.CallExpression,
): CustomRetryPolicy | string | undefined {
  const callee = node.callee
  if (
    callee.type !== AST_NODE_TYPES.Identifier ||
    callee.name !== 'retry_policy'
  ) {
    // Ignore everything else besides retry_policy()
    return undefined
  }

  if (node.arguments.length < 1) {
    throw new WorkflowSyntaxError('Required argument missing', node.loc)
  }

  const arg0 = throwIfSpread(node.arguments).map(convertExpression)[0]
  const argsLoc = node.arguments[0].loc

  if (isFullyQualifiedName(arg0)) {
    return arg0.toString()
  } else if (arg0.expressionType === 'primitive' && isRecord(arg0.value)) {
    return retryPolicyFromParams(arg0.value, argsLoc)
  } else {
    throw new WorkflowSyntaxError('Unexpected type', argsLoc)
  }
}

function retryPolicyFromParams(
  paramsObject: Record<string, Primitive | Expression>,
  argsLoc: TSESTree.SourceLocation,
): CustomRetryPolicy {
  const params = R.map(asExpression, paramsObject)

  if (!('backoff' in params)) {
    throw new WorkflowSyntaxError(
      'Required parameter "backoff" missing',
      argsLoc,
    )
  } else if (
    params.backoff.expressionType !== 'primitive' ||
    !isRecord(params.backoff.value)
  ) {
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
      initialDelay: safeAsExpression(backoff.initial_delay),
      maxDelay: safeAsExpression(backoff.max_delay),
      multiplier: safeAsExpression(backoff.multiplier),
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
