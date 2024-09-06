import {
  AssignStepAST,
  CallStepAST,
  CustomRetryPolicy,
  SwitchStepAST,
  TryStepAST,
  WorkflowParameters,
  WorkflowStepAST,
  transformExpressions,
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
import { blockingFunctions } from './functionMetadata.js'

/**
 * Performs various transformations on the AST.
 *
 * This flat list of steps and does not recurse into nested steps. This gets
 * called on each nesting level separately.
 */
export function transformAST(steps: WorkflowStepAST[]): WorkflowStepAST[] {
  return blockingCallsAsCallSteps(
    flattenPlainNextConditions(
      combineRetryBlocksToTry(
        mergeAssignSteps(mapLiteralsAsAssignSteps(steps)),
      ),
    ),
  )
}

/**
 * Merge consecutive assign steps into one assign step
 */
function mergeAssignSteps(steps: WorkflowStepAST[]): WorkflowStepAST[] {
  return steps.reduce((acc: WorkflowStepAST[], current: WorkflowStepAST) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : null

    if (current instanceof AssignStepAST && prev instanceof AssignStepAST) {
      const merged = new AssignStepAST(
        prev.assignments.concat(current.assignments),
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

    if (current instanceof CallStepAST && current.call === 'retry_policy') {
      if (prev instanceof TryStepAST) {
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
 * Flatten switch conditions that contain a single next step.
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
  return steps.map((step) => {
    if (step instanceof SwitchStepAST) {
      return step.flattenPlainNextConditions()
    } else {
      return step
    }
  })
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
    const transformedSteps = transformExpressions(current, transformer)
    acc.push(...transformedSteps)

    return acc
  }, [])
}

function createTempVariableGenerator(): () => string {
  let i = 0
  const generator = () => `__temp${i++}`
  return generator
}

const Unmodified = Symbol()
type Unmodified = typeof Unmodified

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
    } else if (current.tag === 'raise') {
      needsTransformation =
        !isLiteral(current.value) && includesMapLiteral(current.value)
    } else if (current.tag === 'call') {
      if (current.args) {
        needsTransformation = Object.values(current.args).some(
          (ex) => !isLiteral(ex) && includesMapLiteral(ex),
        )
      }
    }

    if (needsTransformation) {
      const transformedSteps = transformExpressions(current, transformer)
      acc.push(...transformedSteps)
    } else {
      acc.push(current)
    }

    return acc
  }, [])
}

function includesMapLiteral(ex: Expression): boolean {
  switch (ex.expressionType) {
    case 'primitive':
      return isRecord(ex.value)

    case 'binary':
      return includesMapLiteral(ex.left) || includesMapLiteral(ex.right)

    case 'variableReference':
      return false

    case 'unary':
      return includesMapLiteral(ex.value)

    case 'functionInvocation':
      return ex.arguments.some(includesMapLiteral)

    case 'member':
      return includesMapLiteral(ex.object) || includesMapLiteral(ex.property)
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
