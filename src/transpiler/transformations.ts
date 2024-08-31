import {
  AssignStepAST,
  CallStepAST,
  CustomRetryPolicy,
  RaiseStepAST,
  SwitchStepAST,
  TryStepAST,
  WorkflowParameters,
  WorkflowStepAST,
} from '../ast/steps.js'
import { InternalTranspilingError } from '../errors.js'
import { isRecord } from '../utils.js'
import {
  Expression,
  FunctionInvocationTerm,
  MemberTerm,
  ParenthesizedTerm,
  Primitive,
  PrimitiveTerm,
  Term,
  VariableReferenceTerm,
  primitiveExpression,
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
        const retryParameters = current.args

        if (retryParameters) {
          const retryPolicyEx = retryParameters.policy
          if (retryPolicyEx?.isFullyQualifiedName()) {
            retryPolicy = retryPolicyEx.toString()
          }

          if (!retryPolicy) {
            let predicate = ''
            const predicateEx = retryParameters.predicate
            if (predicateEx) {
              if (predicateEx.isFullyQualifiedName()) {
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
              backoffEx?.isLiteral() &&
              backoffEx.left instanceof PrimitiveTerm
            ) {
              const backoffLit = backoffEx.left.value

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
  record: Record<string, Expression | Primitive>,
  keyName: string,
): number {
  let primitiveValue: Primitive
  const primitiveOrExpression = record[keyName]
  if (primitiveOrExpression instanceof Expression) {
    if (primitiveOrExpression.isLiteral()) {
      primitiveValue = primitiveOrExpression.toLiteralValueOrLiteralExpression()
    } else {
      throw new InternalTranspilingError(
        `Support for non-literal "${keyName}" values not yet implemented`,
      )
    }
  } else {
    primitiveValue = primitiveOrExpression
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
 * Workflows specify that blocking calls must be executed by call steps.
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
    const transformedSteps = current.transformEpressions(transformer)
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

function replaceBlockingCalls(
  expression: Expression,
  generateName: () => string,
): { transformedExpression: Expression; callSteps: CallStepAST[] } {
  function replaceBlockingFunctionInvocations(
    t: Term,
  ): Term | typeof Unmodified {
    if (t instanceof FunctionInvocationTerm) {
      const callStepsForArguments: CallStepAST[] = []
      const replacedArguments = t.arguments.map((ex) => {
        const replaced = replaceBlockingCalls(ex, generateName)
        callStepsForArguments.push(...replaced.callSteps)
        return replaced.transformedExpression
      })

      const blockingCallArgumentNames = blockingFunctions.get(t.functionName)
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
          new CallStepAST(t.functionName, args, tempCallResultVariable),
        )

        // replace function invocation with a reference to a temporary variable
        return new VariableReferenceTerm(tempCallResultVariable)
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
  transformTerm: (t: Term) => Term | typeof Unmodified,
): Expression {
  function transformRecursively(term: Term): Term {
    const transformedTerm = transformTerm(term)

    if (transformedTerm === Unmodified) {
      // Keep term but recurse into nested expressions
      if (term instanceof ParenthesizedTerm) {
        return new ParenthesizedTerm(
          transformExpression(term.value, transformTerm),
          term.unaryOperator,
        )
      } else if (term instanceof FunctionInvocationTerm) {
        const newArguments = term.arguments.map((x) =>
          transformExpression(x, transformTerm),
        )
        return new FunctionInvocationTerm(
          term.functionName,
          newArguments,
          term.unaryOperator,
        )
      } else if (term instanceof MemberTerm) {
        const newObject = transformExpression(term.object, transformTerm)
        const newProperty = transformExpression(term.property, transformTerm)
        return new MemberTerm(newObject, newProperty, term.computed)
      } else {
        return term
      }
    } else {
      // Use the transformed version of this term
      return transformedTerm
    }
  }

  // Call transformRecursively on left first to keep the correct order of
  // execution of sub-expressions
  const transformedLeft = transformRecursively(ex.left)
  const transformedRest = ex.rest.map((op) => ({
    binaryOperator: op.binaryOperator,
    right: transformRecursively(op.right),
  }))

  return new Expression(transformedLeft, transformedRest)
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
  const transformer = (ex: Expression): [WorkflowStepAST[], Expression] => {
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
    if (current instanceof AssignStepAST) {
      // This does the transformation a bit too eagerly: If any of the
      // assignments need map literal extraction, it is done on all of
      // the variables.
      needsTransformation = !current.assignments.every(([, value]) => {
        return value.rest.length === 0 && value.left instanceof PrimitiveTerm
      })
    } else if (current instanceof RaiseStepAST) {
      needsTransformation =
        !current.value.isLiteral() && includesMapLiteral(current.value)
    } else if (current instanceof CallStepAST) {
      if (current.args) {
        needsTransformation = Object.values(current.args).some(
          (ex) => !ex.isLiteral() && includesMapLiteral(ex),
        )
      }
    }

    if (needsTransformation) {
      const transformedSteps = current.transformEpressions(transformer)
      acc.push(...transformedSteps)
    } else {
      acc.push(current)
    }

    return acc
  }, [])
}

function includesMapLiteral(expression: Expression): boolean {
  return (
    termIncludesMapLiteral(expression.left) ||
    expression.rest.some((op) => termIncludesMapLiteral(op.right))
  )
}

function termIncludesMapLiteral(term: Term): boolean {
  if (term instanceof PrimitiveTerm) {
    return isRecord(term.value)
  } else if (term instanceof FunctionInvocationTerm) {
    return term.arguments.some(includesMapLiteral)
  } else if (term instanceof ParenthesizedTerm) {
    return includesMapLiteral(term.value)
  } else if (term instanceof MemberTerm) {
    return includesMapLiteral(term.object) || includesMapLiteral(term.object)
  } else {
    return false
  }
}

function replaceMapLiterals(
  expression: Expression,
  generateName: () => string,
): { transformedExpression: Expression; assignSteps: AssignStepAST[] } {
  function replace(t: Term): Term | typeof Unmodified {
    if (t instanceof PrimitiveTerm && isRecord(t.value)) {
      const tempVariable = generateName()
      assignSteps.push(
        new AssignStepAST([[tempVariable, primitiveExpression(t.value)]]),
      )

      // replace the map literal with a reference to a temporary variable
      return new VariableReferenceTerm(tempVariable)
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
