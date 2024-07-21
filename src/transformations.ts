import {
  AssignStepAST,
  CallStepAST,
  CustomRetryPolicy,
  SwitchStepAST,
  TryStepAST,
  WorkflowStepAST,
} from './ast/steps.js'
import { InternalTranspilingError } from './errors.js'
import { isRecord } from './utils.js'
import { Expression, Primitive } from './ast/expressions.js'

/**
 * Performs various transformations on the AST.
 *
 * This flat list of steps and does not recurse into nested steps. This gets
 * called on each nesting level separately.
 */
export function transformAST(steps: WorkflowStepAST[]): WorkflowStepAST[] {
  return flattenPlainNextConditions(
    combineRetryBlocksToTry(mergeAssignSteps(steps)),
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
            if (backoffEx?.isLiteral()) {
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
