import {
  AssignStepAST,
  CallStepAST,
  CustomRetryPolicy,
  ForStepAST,
  RaiseStepAST,
  ReturnStepAST,
  SwitchStepAST,
  TryStepAST,
  WorkflowParameters,
  WorkflowStepAST,
} from '../ast/steps.js'
import { InternalTranspilingError } from '../errors.js'
import { isRecord } from '../utils.js'
import {
  BinaryExpression,
  Expression,
  FunctionInvocationExpression,
  MemberExpression,
  Primitive,
  PrimitiveExpression,
  UnaryExpression,
  VariableName,
  VariableReferenceExpression,
  expressionToLiteralValueOrLiteralExpression,
  isExpression,
  isFullyQualifiedName,
  isLiteral,
} from '../ast/expressions.js'
import { blockingFunctions } from './generated/functionMetadata.js'

const Unmodified = Symbol()
type Unmodified = typeof Unmodified

/**
 * Performs various transformations on the AST.
 *
 * This flat list of steps and does not recurse into nested steps. This gets
 * called on each nesting level separately.
 */
export function transformAST(steps: WorkflowStepAST[]): WorkflowStepAST[] {
  return blockingCallsAsCallSteps(
    runtimeFunctionImplementation(
      flattenPlainNextConditions(
        combineRetryBlocksToTry(
          mergeAssignSteps(mapLiteralsAsAssignSteps(steps)),
        ),
      ),
    ),
  )
}

/**
 * Merge consecutive assign steps into one assign step
 *
 * An assign step can contain up to 50 assignments.
 */
function mergeAssignSteps(steps: WorkflowStepAST[]): WorkflowStepAST[] {
  return steps.reduce((acc: WorkflowStepAST[], current: WorkflowStepAST) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : null

    if (
      current.tag === 'assign' &&
      prev?.tag === 'assign' &&
      prev.assignments.length < 50 &&
      !prev.next
    ) {
      const merged = new AssignStepAST(
        prev.assignments.concat(current.assignments),
        current.next,
        prev.label ?? current.label,
      )

      acc.pop()
      acc.push(merged)
    } else {
      acc.push(current)
    }

    return acc
  }, [])
}

/**
 * Transform a retry_policy call step to a retry block in a preceeding try step
 */
function combineRetryBlocksToTry(steps: WorkflowStepAST[]): WorkflowStepAST[] {
  return steps.reduce((acc: WorkflowStepAST[], current: WorkflowStepAST) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : null

    if (current.tag === 'call' && current.call === 'retry_policy') {
      if (prev?.tag === 'try') {
        if (prev.retryPolicy) {
          throw new InternalTranspilingError('Retry policy already assigned!')
        }

        let retryPolicy: string | CustomRetryPolicy | undefined = undefined
        const retryParameters = current.args as
          | Record<VariableName, Expression | undefined>
          | undefined

        if (retryParameters) {
          const retryPolicyEx = retryParameters.policy
          if (retryPolicyEx && isFullyQualifiedName(retryPolicyEx)) {
            retryPolicy = retryPolicyEx.toString()
          }

          if (!retryPolicy) {
            let predicate = ''
            const predicateEx = retryParameters.predicate
            if (predicateEx) {
              if (isFullyQualifiedName(predicateEx)) {
                predicate = predicateEx.toString()
              } else {
                throw new InternalTranspilingError(
                  '"predicate" must be a function name',
                )
              }
            }

            const maxRetries = parseRetryPolicyNumber(
              retryParameters,
              'max_retries',
            )

            let initialDelay = 1
            let maxDelay = 1
            let multiplier = 1

            const backoffEx = retryParameters.backoff
            if (
              backoffEx &&
              isLiteral(backoffEx) &&
              backoffEx.expressionType === 'primitive'
            ) {
              const backoffLit = backoffEx.value

              if (isRecord(backoffLit)) {
                initialDelay = parseRetryPolicyNumber(
                  backoffLit,
                  'initial_delay',
                )
                maxDelay = parseRetryPolicyNumber(backoffLit, 'max_delay')
                multiplier = parseRetryPolicyNumber(backoffLit, 'multiplier')
              }
            }

            retryPolicy = {
              predicate,
              maxRetries,
              backoff: {
                initialDelay,
                maxDelay,
                multiplier,
              },
            }
          }
        }

        const tryWithRetry = new TryStepAST(
          prev.trySteps,
          prev.exceptSteps,
          retryPolicy,
          prev.errorMap,
        )

        acc.pop()
        acc.push(tryWithRetry)
      }
      // If prev is not a try step, "retry_policy" is ignored. Should print a warning.
    } else {
      acc.push(current)
    }

    return acc
  }, [])
}

function parseRetryPolicyNumber(
  record: Record<string, Expression | Primitive | undefined>,
  keyName: string,
): number {
  let primitiveValue: Primitive
  const primitiveOrExpression = record[keyName]
  if (primitiveOrExpression && isExpression(primitiveOrExpression)) {
    if (isLiteral(primitiveOrExpression)) {
      primitiveValue = expressionToLiteralValueOrLiteralExpression(
        primitiveOrExpression,
      )
    } else {
      throw new InternalTranspilingError(
        `Support for non-literal "${keyName}" values not yet implemented`,
      )
    }
  } else if (primitiveOrExpression) {
    primitiveValue = primitiveOrExpression
  } else {
    throw new InternalTranspilingError(`"${keyName}" expected`)
  }

  if (typeof primitiveValue !== 'number') {
    throw new InternalTranspilingError(`"${keyName}" must be a number`)
  }

  return primitiveValue
}

/**
 * Merge a next step to the previous step.
 *
 * For example, transforms this:
 *
 * switch:
 *   - condition: ${x > 0}
 *     steps:
 *       - next1:
 *           steps:
 *             next: target1
 *
 * into this:
 *
 * switch:
 *   - condition: ${x > 0}
 *     next: target1
 */
export function flattenPlainNextConditions(
  steps: WorkflowStepAST[],
): WorkflowStepAST[] {
  return steps.reduce((acc: WorkflowStepAST[], step: WorkflowStepAST) => {
    if (acc.length > 0 && step.tag === 'next') {
      // Merge a "next" to the previous "assign" step
      const prev = acc[acc.length - 1]

      if (prev.tag === 'assign' && !prev.next) {
        acc.pop()
        acc.push(prev.withNext(step.target))
      } else {
        acc.push(step)
      }
    } else if (step.tag === 'switch') {
      // If the condition steps consists of a single "next", merge it with the condition
      acc.push(flattenNextToCondition(step))
    } else {
      acc.push(step)
    }

    return acc
  }, [])
}

function flattenNextToCondition(step: SwitchStepAST): SwitchStepAST {
  const transformedBranches = step.branches.map((cond) => {
    if (!cond.next && cond.steps.length === 1 && cond.steps[0].tag === 'next') {
      const nextStep = cond.steps[0]
      return {
        condition: cond.condition,
        steps: [],
        next: nextStep.target,
      }
    } else {
      return cond
    }
  })

  return new SwitchStepAST(transformedBranches)
}

/**
 * Search for blocking calls in expressions and replace them with call step + variable.
 *
 * The Workflows runtime requires that blocking calls must be executed by call steps.
 *
 * For example, transforms this:
 *
 * - return1:
 *     return: ${http.get("https://example.com")}
 *
 * into this:
 *
 * - call_http_get_1:
 *     call: http.get
 *     args:
 *       url: https://example.com
 *     result: __temp0
 * - return1:
 *     return: ${__temp0}
 */
function blockingCallsAsCallSteps(steps: WorkflowStepAST[]): WorkflowStepAST[] {
  const transformer = (ex: Expression): [WorkflowStepAST[], Expression] => {
    const generateTemporaryVariableName = createTempVariableGenerator()
    const { transformedExpression, callSteps } = replaceBlockingCalls(
      ex,
      generateTemporaryVariableName,
    )

    return [callSteps, transformedExpression]
  }

  return steps.reduce((acc: WorkflowStepAST[], current: WorkflowStepAST) => {
    const transformedSteps = transformStepExpressions(current, transformer)
    acc.push(...transformedSteps)

    return acc
  }, [])
}

function createTempVariableGenerator(): () => string {
  let i = 0
  const generator = () => `__temp${i++}`
  return generator
}

function replaceBlockingCalls(
  expression: Expression,
  generateName: () => string,
): { transformedExpression: Expression; callSteps: CallStepAST[] } {
  function replaceBlockingFunctionInvocations(
    ex: Expression,
  ): Expression | Unmodified {
    if (ex.expressionType === 'functionInvocation') {
      const callStepsForArguments: CallStepAST[] = []
      const replacedArguments = ex.arguments.map((ex) => {
        const replaced = replaceBlockingCalls(ex, generateName)
        callStepsForArguments.push(...replaced.callSteps)
        return replaced.transformedExpression
      })

      const blockingCallArgumentNames = blockingFunctions.get(ex.functionName)
      if (blockingCallArgumentNames) {
        if (replacedArguments.length > blockingCallArgumentNames.length) {
          throw new InternalTranspilingError(
            'FunctionInvocationTerm has more arguments than metadata allows!',
          )
        }

        const nameAndValue = replacedArguments.map(
          (val, i) => [blockingCallArgumentNames[i], val] as const,
        )
        const args: WorkflowParameters = Object.fromEntries(nameAndValue)
        const tempCallResultVariable = generateName()

        callSteps.push(...callStepsForArguments)
        callSteps.push(
          new CallStepAST(ex.functionName, args, tempCallResultVariable),
        )

        // replace function invocation with a reference to the temporary variable
        return new VariableReferenceExpression(tempCallResultVariable)
      } else {
        return Unmodified
      }
    } else {
      return Unmodified
    }
  }

  const callSteps: CallStepAST[] = []

  return {
    transformedExpression: transformExpression(
      expression,
      replaceBlockingFunctionInvocations,
    ),
    callSteps,
  }
}

/**
 * Transform expressions in a step by applying transform.
 *
 * Returns an array of steps. The array includes the transformed step and possibly
 * additional steps constructed during the transformation. For example, a
 * transformation might extract blocking call expressions into call steps.
 */
function transformStepExpressions(
  step: WorkflowStepAST,
  transform: (ex: Expression) => [WorkflowStepAST[], Expression],
): WorkflowStepAST[] {
  switch (step.tag) {
    case 'assign':
      return transformExpressionsAssign(step, transform)

    case 'call':
      return transformExpressionsCall(step, transform)

    case 'for':
      return transformExpressionsFor(step, transform)

    case 'raise':
      return transformExpressionsRaise(step, transform)

    case 'return':
      return transformExpressionsReturn(step, transform)

    case 'switch':
      return transformExpressionsSwitch(step, transform)

    case 'next':
    case 'parallel':
    case 'steps':
    case 'try':
    case 'jumptarget':
      return [step]
  }
}

function transformExpressionsAssign(
  step: AssignStepAST,
  transform: (ex: Expression) => [WorkflowStepAST[], Expression],
): WorkflowStepAST[] {
  if (step.assignments) {
    const newSteps: WorkflowStepAST[] = []
    const newAssignments = step.assignments.map(([name, ex]) => {
      const [steps2, ex2] = transform(ex)
      newSteps.push(...steps2)
      return [name, ex2] as const
    })
    newSteps.push(new AssignStepAST(newAssignments, step.next, step.label))
    return newSteps
  } else {
    return [step]
  }
}

function transformExpressionsCall(
  step: CallStepAST,
  transform: (ex: Expression) => [WorkflowStepAST[], Expression],
): WorkflowStepAST[] {
  if (step.args) {
    const newSteps: WorkflowStepAST[] = []
    const newArgs = Object.fromEntries(
      Object.entries(step.args).map(([name, ex]) => {
        const [steps2, ex2] = transform(ex)
        newSteps.push(...steps2)
        return [name, ex2] as const
      }),
    )
    newSteps.push(new CallStepAST(step.call, newArgs, step.result, step.label))
    return newSteps
  } else {
    return [step]
  }
}

function transformExpressionsFor(
  step: ForStepAST,
  transform: (ex: Expression) => [WorkflowStepAST[], Expression],
): WorkflowStepAST[] {
  if (step.listExpression) {
    const [newSteps, newListExpression] = transform(step.listExpression)
    newSteps.push(
      new ForStepAST(
        step.steps,
        step.loopVariableName,
        newListExpression,
        step.indexVariableName,
        step.rangeStart,
        step.rangeEnd,
        step.label,
      ),
    )
    return newSteps
  } else {
    return [step]
  }
}

function transformExpressionsRaise(
  step: RaiseStepAST,
  transform: (ex: Expression) => [WorkflowStepAST[], Expression],
): WorkflowStepAST[] {
  if (step.value) {
    const [newSteps, newEx] = transform(step.value)
    newSteps.push(new RaiseStepAST(newEx, step.label))
    return newSteps
  } else {
    return [step]
  }
}

function transformExpressionsReturn(
  step: ReturnStepAST,
  transform: (ex: Expression) => [WorkflowStepAST[], Expression],
): WorkflowStepAST[] {
  if (step.value) {
    const [newSteps, newEx] = transform(step.value)
    newSteps.push(new ReturnStepAST(newEx, step.label))
    return newSteps
  } else {
    return [step]
  }
}

function transformExpressionsSwitch(
  step: SwitchStepAST,
  transform: (ex: Expression) => [WorkflowStepAST[], Expression],
): WorkflowStepAST[] {
  const newSteps: WorkflowStepAST[] = []
  const newBranches = step.branches.map((cond) => {
    const [steps2, ex2] = transform(cond.condition)
    newSteps.push(...steps2)

    return {
      condition: ex2,
      steps: cond.steps,
      next: cond.next,
    }
  })

  newSteps.push(new SwitchStepAST(newBranches, step.label))
  return newSteps
}

function transformExpression(
  ex: Expression,
  transformer: (x: Expression) => Expression | Unmodified,
): Expression {
  const transformed = transformer(ex)

  if (transformed !== Unmodified) {
    // Use the transformed version of this term
    return transformed
  } else {
    // Otherwise, recurse into the nested expression
    switch (ex.expressionType) {
      case 'primitive':
      case 'variableReference':
        return ex

      case 'binary':
        return transformBinaryExpression(ex, transformer)

      case 'functionInvocation':
        return transformFunctionInvocationExpression(ex, transformer)

      case 'member':
        return new MemberExpression(
          transformExpression(ex.object, transformer),
          transformExpression(ex.property, transformer),
          ex.computed,
        )

      case 'unary':
        return new UnaryExpression(
          ex.operator,
          transformExpression(ex.value, transformer),
        )
    }
  }
}

function transformBinaryExpression(
  ex: BinaryExpression,
  transformer: (x: Expression) => Expression | Unmodified,
): BinaryExpression {
  // Transform left first to keep the correct order of execution of sub-expressions
  const newLeft = transformExpression(ex.left, transformer)
  const newRight = transformExpression(ex.right, transformer)
  return new BinaryExpression(newLeft, ex.binaryOperator, newRight)
}

function transformFunctionInvocationExpression(
  ex: FunctionInvocationExpression,
  transformer: (x: Expression) => Expression | Unmodified,
): FunctionInvocationExpression {
  const newArguments = ex.arguments.map((x) =>
    transformExpression(x, transformer),
  )
  return new FunctionInvocationExpression(ex.functionName, newArguments)
}

/**
 * Search for map literals in expressions and replace them with assign step + variable.
 *
 * Workflows does not support a map literal in expressions.
 *
 * For example, transforms this:
 *
 * - return1:
 *     return: ${ {value: 5}.value }
 *
 * into this:
 *
 * - assign1:
 *     assign:
 *       - __temp0:
 *         value: 5
 * - return1:
 *     return: ${__temp0.value}
 */
function mapLiteralsAsAssignSteps(steps: WorkflowStepAST[]): WorkflowStepAST[] {
  function transformer(ex: Expression): [WorkflowStepAST[], Expression] {
    const generateTemporaryVariableName = createTempVariableGenerator()
    const { transformedExpression, assignSteps } = replaceMapLiterals(
      ex,
      generateTemporaryVariableName,
    )

    return [assignSteps, transformedExpression]
  }

  return steps.reduce((acc: WorkflowStepAST[], current: WorkflowStepAST) => {
    let needsTransformation = true

    // These steps are allowed to contain map literals if the map is the
    // main expression
    if (current.tag === 'assign') {
      // This does the transformation a bit too eagerly: If any of the
      // assignments need the map literal extraction, it is done on all of
      // the variables.
      needsTransformation = !current.assignments.every(([, value]) => {
        return value.expressionType === 'primitive'
      })
    } else if (current.tag === 'raise' || current.tag === 'return') {
      needsTransformation =
        current.value !== undefined &&
        includesExtractableMapLiteral(current.value, true)
    } else if (current.tag === 'call') {
      if (current.args) {
        needsTransformation = Object.values(current.args).some((ex) =>
          includesExtractableMapLiteral(ex, true),
        )
      }
    }

    if (needsTransformation) {
      const transformedSteps = transformStepExpressions(current, transformer)
      acc.push(...transformedSteps)
    } else {
      acc.push(current)
    }

    return acc
  }, [])
}

// Return true if the string representation of ex would include {}
function includesExtractableMapLiteral(
  ex: Expression,
  parentAllowsMaps: boolean,
): boolean {
  switch (ex.expressionType) {
    case 'primitive':
      if (isRecord(ex.value)) {
        return (
          !parentAllowsMaps ||
          Object.values(ex.value).some(
            (x) =>
              isExpression(x) &&
              includesExtractableMapLiteral(x, parentAllowsMaps),
          )
        )
      } else if (Array.isArray(ex.value)) {
        return ex.value.some(
          (x) =>
            isExpression(x) &&
            includesExtractableMapLiteral(x, parentAllowsMaps),
        )
      } else {
        return false
      }

    case 'binary':
      return (
        includesExtractableMapLiteral(ex.left, parentAllowsMaps) ||
        includesExtractableMapLiteral(ex.right, parentAllowsMaps)
      )

    case 'variableReference':
      return false

    case 'unary':
      return includesExtractableMapLiteral(ex.value, parentAllowsMaps)

    case 'functionInvocation':
      return ex.arguments.some((x) => includesExtractableMapLiteral(x, false))

    case 'member':
      return (
        includesExtractableMapLiteral(ex.object, false) ||
        includesExtractableMapLiteral(ex.property, false)
      )
  }
}

function replaceMapLiterals(
  expression: Expression,
  generateName: () => string,
): { transformedExpression: Expression; assignSteps: AssignStepAST[] } {
  function replace(ex: Expression): Expression | Unmodified {
    if (ex.expressionType === 'primitive' && isRecord(ex.value)) {
      const tempVariable = generateName()
      assignSteps.push(
        new AssignStepAST([[tempVariable, new PrimitiveExpression(ex.value)]]),
      )

      // replace the map literal with a reference to the temporary variable
      return new VariableReferenceExpression(tempVariable)
    } else {
      return Unmodified
    }
  }

  const assignSteps: AssignStepAST[] = []

  return {
    transformedExpression: transformExpression(expression, replace),
    assignSteps,
  }
}

/**
 * Replace `Array.isArray(x)` with `get_type(x) == "list"`
 */
function runtimeFunctionImplementation(
  steps: WorkflowStepAST[],
): WorkflowStepAST[] {
  return steps.reduce((acc: WorkflowStepAST[], current: WorkflowStepAST) => {
    const transformedSteps = transformStepExpressions(current, (ex) => [
      [],
      transformExpression(ex, replaceIsArray),
    ])
    acc.push(...transformedSteps)

    return acc
  }, [])
}

function replaceIsArray(ex: Expression): Expression | Unmodified {
  if (
    ex.expressionType === 'functionInvocation' &&
    ex.functionName === 'Array.isArray'
  ) {
    return new BinaryExpression(
      new FunctionInvocationExpression('get_type', ex.arguments),
      '==',
      new PrimitiveExpression('list'),
    )
  } else {
    return Unmodified
  }
}
