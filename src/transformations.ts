import {
  AssignStepAST,
  CallStepAST,
  CustomRetryPolicy,
  TryStepAST,
  WorkflowStepAST,
} from './ast/steps.js'
import { InternalTranspilingError } from './errors.js'
import { isRecord } from './utils.js'
import { Expression, Primitive } from './ast/expressions.js'

export function transformAST(steps: WorkflowStepAST[]): WorkflowStepAST[] {
  return combineRetryBlocksToTry(mergeAssignSteps(steps))
}

// Merge consecutive assign steps
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

// Merge a retry call step with a preceeding try block
function combineRetryBlocksToTry(steps: WorkflowStepAST[]): WorkflowStepAST[] {
  return steps.reduce((acc: WorkflowStepAST[], current: WorkflowStepAST) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : null

    if (current instanceof CallStepAST && current.call === 'retry') {
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
      // If prev is not a try step, "retry" is ignored. Should print a warning.
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
