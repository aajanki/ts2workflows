import * as R from 'ramda'
import { InternalTranspilingError } from '../errors.js'
import {
  binaryEx,
  Expression,
  expressionToLiteralValueOrLiteralExpression,
  expressionToString,
  LiteralValueOrLiteralExpression,
  nullEx,
  stringEx,
  VariableName,
  variableReferenceEx,
} from './expressions.js'
import {
  BreakStatement,
  ContinueStatement,
  CustomRetryPolicy,
  DoWhileStatement,
  ForRangeStatement,
  ForStatement,
  FunctionInvocationStatement,
  IfNextBranch,
  IfStatement,
  LabelledStatement,
  ParallelForStatement,
  ParallelStatement,
  ReturnStatement,
  SwitchStatement,
  TryStatement,
  VariableAssignment,
  WhileStatement,
  WorkflowParameters,
  WorkflowStatement,
} from './statements.js'
import { Subworkflow, SubworkflowStatements } from './workflows.js'

export type StepName = string

// https://cloud.google.com/workflows/docs/reference/syntax/variables#assign-step
interface AssignStep {
  tag: 'assign'
  label: StepName
  assignments: VariableAssignment[]
  next?: StepName
}

// https://cloud.google.com/workflows/docs/reference/syntax/calls
interface CallStep {
  tag: 'call'
  label: StepName
  call: string
  args?: WorkflowParameters
  result?: VariableName
}

// https://cloud.google.com/workflows/docs/reference/syntax/iteration
interface ForStep {
  tag: 'for'
  label: StepName
  steps: WorkflowStep[]
  loopVariableName: VariableName
  listExpression?: Expression
  indexVariableName?: VariableName
  rangeStart?: number | Expression
  rangeEnd?: number | Expression
}

// https://cloud.google.com/workflows/docs/reference/syntax/jumps
interface NextStep {
  tag: 'next'
  label: StepName
  next: StepName
}

// https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps
interface ParallelStep {
  tag: 'parallel'
  label: StepName
  branches: ParallelBranch[]
  shared?: VariableName[]
  concurrencyLimit?: number
  exceptionPolicy?: string
}

interface ParallelBranch {
  readonly name: StepName
  readonly steps: WorkflowStep[]
}

// https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps#parallel-iteration
interface ParallelIterationStep {
  tag: 'parallel-for'
  label: StepName
  forStep: ForStep
  shared?: VariableName[]
  concurrencyLimit?: number
  exceptionPolicy?: string
}

// https://cloud.google.com/workflows/docs/reference/syntax/raising-errors
interface RaiseStep {
  tag: 'raise'
  label: string
  value: Expression
}

// https://cloud.google.com/workflows/docs/reference/syntax/completing
interface ReturnStep {
  tag: 'return'
  label: string
  value: Expression | undefined
}

// https://cloud.google.com/workflows/docs/reference/syntax/conditions
interface SwitchStep {
  tag: 'switch'
  label: StepName
  branches: SwitchBranch[]
  next?: StepName
}

interface SwitchBranch {
  readonly condition: Expression
  readonly steps?: WorkflowStep[]
  readonly next?: StepName
}

// https://cloud.google.com/workflows/docs/reference/syntax/catching-errors
interface TryStep {
  tag: 'try'
  label: StepName
  trySteps: WorkflowStep[]
  exceptSteps?: WorkflowStep[]
  retryPolicy?: string | CustomRetryPolicy
  errorMap?: VariableName
}

// Internal step that represents a potential jump target.
// This can be used as a placeholder when the actual target step is not yet known.
// JumpTargetSteps are removed before transpiling to workflows YAML.
interface JumpTargetStep {
  tag: 'jump-target'
  label: StepName
}

export type WorkflowStep =
  | AssignStep
  | CallStep
  | ForStep
  | NextStep
  | ParallelStep
  | ParallelIterationStep
  | RaiseStep
  | ReturnStep
  | SwitchStep
  | TryStep
  | JumpTargetStep

interface StepContext {
  // breakTarget is a jump target for an unlabeled break statement
  readonly breakTarget?: StepName
  // continueTarget is a jump target for an unlabeled continue statement
  readonly continueTarget?: StepName
  // finalizerTargets is an array of jump targets for return statements. Used
  // for delaying a return until a finally block. Array of nested try-finally
  // blocks, the inner most block is last. This also used as a flag to indicate
  // that we are in a try or catch block that has a related finally block.
  finalizerTargets?: StepName[]
}

interface JumpStackElement {
  step: WorkflowStep
  nestingLevel: number
  isLastInBlock: boolean
}

/**
 * Returns an GCP Workflows object representation of a step.
 */
export function renderStep(step: WorkflowStep): Record<string, unknown> {
  switch (step.tag) {
    case 'assign':
      return { [step.label]: renderAssignStep(step) }

    case 'call':
      return { [step.label]: renderCallStep(step) }

    case 'for':
      return { [step.label]: renderForStep(step) }

    case 'next':
      return { [step.label]: { next: step.next } }

    case 'parallel':
      return { [step.label]: renderParallelStep(step) }

    case 'parallel-for':
      return { [step.label]: renderParallelIterationStep(step) }

    case 'raise':
      return { [step.label]: renderRaiseStep(step) }

    case 'return':
      return { [step.label]: renderReturnStep(step) }

    case 'switch':
      return { [step.label]: renderSwitchStep(step) }

    case 'try':
      return { [step.label]: renderTryStep(step) }

    case 'jump-target':
      // Should not be reached
      return {}
  }
}

function renderSteps(steps: WorkflowStep[]): Record<string, unknown>[] {
  return steps.map(renderStep)
}

function renderAssignStep(step: AssignStep): Record<string, unknown> {
  return {
    assign: step.assignments.map(({ name, value }) => {
      return {
        [expressionToString(name)]:
          expressionToLiteralValueOrLiteralExpression(value),
      }
    }),
    ...(step.next !== undefined && { next: step.next }),
  }
}

function renderCallStep(step: CallStep): Record<string, unknown> {
  let args:
    | Record<string, null | string | number | boolean | object>
    | undefined = undefined
  if (step.args) {
    args = R.map(expressionToLiteralValueOrLiteralExpression, step.args)
  }

  return {
    call: step.call,
    ...(args && Object.keys(args).length > 0 && { args }),
    ...(step.result !== undefined && { result: step.result }),
  }
}

function renderForStep(step: ForStep): Record<string, unknown> {
  return {
    for: renderForBody(step),
  }
}

function renderForBody(step: ForStep): object {
  let range: LiteralValueOrLiteralExpression[] | undefined
  let inValue: null | string | number | boolean | object | undefined
  if (typeof step.listExpression === 'undefined') {
    inValue = undefined
    range = [
      renderForRangeLimit(step.rangeStart),
      renderForRangeLimit(step.rangeEnd),
    ]
  } else {
    inValue = expressionToLiteralValueOrLiteralExpression(step.listExpression)
    range = undefined
  }

  return {
    value: step.loopVariableName,
    ...(step.indexVariableName !== undefined && {
      index: step.indexVariableName,
    }),
    ...(inValue !== undefined && { in: inValue }),
    ...(range !== undefined && { range }),
    steps: renderSteps(step.steps),
  }
}

function renderForRangeLimit(
  value: number | Expression | undefined,
): LiteralValueOrLiteralExpression {
  if (value === undefined) {
    return null
  } else if (typeof value === 'number') {
    return value
  } else {
    return expressionToLiteralValueOrLiteralExpression(value)
  }
}

function renderParallelStep(step: ParallelStep): Record<string, unknown> {
  const renderedBranches: Record<string, unknown> = {
    branches: step.branches.map(({ name, steps }) => ({
      [name]: {
        steps: renderSteps(steps),
      },
    })),
  }

  return {
    parallel: {
      ...renderedBranches,
      ...(step.shared && { shared: step.shared }),
      ...(step.concurrencyLimit !== undefined && {
        concurrency_limit: step.concurrencyLimit,
      }),
      ...(step.exceptionPolicy !== undefined && {
        exception_policy: step.exceptionPolicy,
      }),
    },
  }
}

function renderParallelIterationStep(
  step: ParallelIterationStep,
): Record<string, unknown> {
  return {
    parallel: {
      for: renderForBody(step.forStep),
      ...(step.shared && { shared: step.shared }),
      ...(step.concurrencyLimit !== undefined && {
        concurrency_limit: step.concurrencyLimit,
      }),
      ...(step.exceptionPolicy !== undefined && {
        exception_policy: step.exceptionPolicy,
      }),
    },
  }
}

function renderRaiseStep(step: RaiseStep): Record<string, unknown> {
  return {
    raise: expressionToLiteralValueOrLiteralExpression(step.value),
  }
}

function renderReturnStep(step: ReturnStep): Record<string, unknown> {
  if (step.value) {
    return {
      return: expressionToLiteralValueOrLiteralExpression(step.value),
    }
  } else {
    return {
      next: 'end',
    }
  }
}

function renderSwitchStep(step: SwitchStep): Record<string, unknown> {
  return {
    switch: step.branches.map(renderSwitchBranch),
    ...(step.next !== undefined && { next: step.next }),
  }
}

function renderSwitchBranch(branch: SwitchBranch): object {
  const includeSteps =
    (branch.steps ?? []).length > 0 || branch.next === undefined

  return {
    condition: expressionToLiteralValueOrLiteralExpression(branch.condition),
    ...(includeSteps && { steps: renderSteps(branch.steps ?? []) }),
    ...(branch.next !== undefined && { next: branch.next }),
  }
}

function renderTryStep(step: TryStep): Record<string, unknown> {
  let retry
  if (typeof step.retryPolicy === 'undefined') {
    retry = undefined
  } else if (typeof step.retryPolicy === 'string') {
    retry = `\${${step.retryPolicy}}`
  } else {
    const predicateName = step.retryPolicy.predicate
    retry = {
      ...(predicateName ? { predicate: `\${${predicateName}}` } : {}),
      max_retries: expressionToLiteralValueOrLiteralExpression(
        step.retryPolicy.maxRetries,
      ),
      backoff: {
        ...(step.retryPolicy.backoff.initialDelay !== undefined
          ? {
              initial_delay: expressionToLiteralValueOrLiteralExpression(
                step.retryPolicy.backoff.initialDelay,
              ),
            }
          : {}),
        ...(step.retryPolicy.backoff.maxDelay !== undefined
          ? {
              max_delay: expressionToLiteralValueOrLiteralExpression(
                step.retryPolicy.backoff.maxDelay,
              ),
            }
          : {}),
        ...(step.retryPolicy.backoff.multiplier !== undefined
          ? {
              multiplier: expressionToLiteralValueOrLiteralExpression(
                step.retryPolicy.backoff.multiplier,
              ),
            }
          : {}),
      },
    }
  }

  let except
  if (step.exceptSteps !== undefined) {
    except = {
      as: step.errorMap,
      steps: renderSteps(step.exceptSteps),
    }
  } else {
    except = undefined
  }

  return {
    try: {
      steps: renderSteps(step.trySteps),
    },
    ...(retry !== undefined && { retry }),
    ...(except && { except }),
  }
}

/**
 * Convert a IR subworkflow to WorkflowSteps.
 *
 * This function also assigns step labels.
 */
export function toStepSubworkflow(
  ast: SubworkflowStatements,
  generateLabel: (prefix: string) => string,
): Subworkflow {
  const steps = fixJumpLabels(
    statementListToSteps(generateLabel, {}, ast.statements),
  )

  return new Subworkflow(ast.name, steps, ast.params)
}

const statementListToSteps = R.curry(function (
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statements: WorkflowStatement[],
): WorkflowStep[] {
  return mergeNextStep(
    statements.flatMap((s) => statementToSteps(generateLabel, ctx, s)),
  )
})

function statementToSteps(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: WorkflowStatement,
): WorkflowStep[] {
  switch (statement.tag) {
    case 'assign':
      return [
        {
          tag: statement.tag,
          label: generateLabel(statement.tag),
          assignments: statement.assignments,
        },
      ]

    case 'break':
      return [breakStep(generateLabel, ctx, statement)]

    case 'continue':
      return [continueStep(generateLabel, ctx, statement)]

    case 'do-while':
      return doWhileSteps(generateLabel, ctx, statement)

    case 'for':
      return [forStep(generateLabel, ctx, statement)]

    case 'for-range':
      return [forRangeStep(generateLabel, ctx, statement)]

    case 'function-invocation':
      return [callStep(generateLabel, statement)]

    case 'if':
      return [ifStep(generateLabel, ctx, statement)]

    case 'label':
      return labelledSteps(generateLabel, ctx, statement)

    case 'parallel-for':
      return [parallelIterationStep(generateLabel, ctx, statement)]

    case 'parallel':
      return [parallelStep(generateLabel, ctx, statement)]

    case 'raise':
      return [
        {
          tag: statement.tag,
          label: generateLabel(statement.tag),
          value: statement.value,
        },
      ]

    case 'return':
      return [returnStep(generateLabel, ctx, statement)]

    case 'switch':
      return switchSteps(generateLabel, ctx, statement)

    case 'try':
      return trySteps(generateLabel, ctx, statement)

    case 'while':
      return whileSteps(generateLabel, ctx, statement)
  }
}

function callStep(
  generateLabel: (prefix: string) => string,
  statement: FunctionInvocationStatement,
): CallStep {
  const labelPrefix =
    'call_' + statement.callee.replaceAll(/[^a-zA-Z0-9]/g, '_') + '_'

  return {
    tag: 'call',
    label: generateLabel(labelPrefix),
    call: statement.callee,
    args: statement.args,
    result: statement.result,
  }
}

function breakStep(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: BreakStatement,
): NextStep {
  if (ctx.finalizerTargets) {
    // TODO: would need to detect if this breaks out of the try or catch block,
    // execute the finally block first and then do the break.
    throw new InternalTranspilingError(
      'break is not supported inside a try-finally block',
    )
  }

  return {
    tag: 'next',
    label: generateLabel('next'),
    next: statement.label ?? ctx.breakTarget ?? 'break',
  }
}

function continueStep(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: ContinueStatement,
): NextStep {
  if (ctx.finalizerTargets) {
    // TODO: would need to detect if continue breaks out of the try or catch block,
    // execute the finally block first and then do the continue.
    throw new InternalTranspilingError(
      'continue is not supported inside a try-finally block',
    )
  }

  return {
    tag: 'next',
    label: generateLabel('next'),
    next: statement.label ?? ctx.continueTarget ?? 'continue',
  }
}

function doWhileSteps(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: DoWhileStatement,
): WorkflowStep[] {
  const startOfLoopLabel = generatePlaceholderLabel()
  const endOfLoopLabel = generatePlaceholderLabel()
  const ctx2 = Object.assign({}, ctx, {
    continueTarget: startOfLoopLabel,
    breakTarget: endOfLoopLabel,
  })
  const toSteps = statementListToSteps(generateLabel, ctx2)

  return [
    {
      tag: 'jump-target',
      label: startOfLoopLabel,
    },
    ...toSteps(statement.body),
    {
      tag: 'switch',
      label: generateLabel('switch'),
      branches: [
        {
          condition: statement.condition,
          steps: [],
          next: startOfLoopLabel,
        },
      ],
    },
    {
      tag: 'jump-target',
      label: endOfLoopLabel,
    },
  ]
}

function whileSteps(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: WhileStatement,
): WorkflowStep[] {
  const startOfLoopLabel = generateLabel('switch')
  const endOfLoopLabel = generatePlaceholderLabel()
  const ctx2 = Object.assign({}, ctx, {
    continueTarget: startOfLoopLabel,
    breakTarget: endOfLoopLabel,
  })
  const toSteps = statementListToSteps(generateLabel, ctx2)
  const steps = appendNextStep(
    generateLabel,
    toSteps(statement.body),
    startOfLoopLabel,
  )
  const body = {
    condition: statement.condition,
    steps,
  }

  return [
    {
      tag: 'switch',
      label: startOfLoopLabel,
      branches: [body],
    },
    {
      tag: 'jump-target',
      label: endOfLoopLabel,
    },
  ]
}

function forStep(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: ForStatement,
): ForStep {
  const label = generateLabel('for')
  const bodyCtx = Object.assign({}, ctx, {
    continueTarget: undefined,
    breakTarget: undefined,
  })
  const toSteps = statementListToSteps(generateLabel, bodyCtx)

  return {
    tag: 'for',
    label,
    steps: toSteps(statement.body),
    loopVariableName: statement.loopVariableName,
    listExpression: statement.listExpression,
  }
}

function forRangeStep(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: ForRangeStatement,
): ForStep {
  const label = generateLabel('for')
  const bodyCtx = Object.assign({}, ctx, {
    continueTarget: undefined,
    breakTarget: undefined,
  })
  const toSteps = statementListToSteps(generateLabel, bodyCtx)

  return {
    tag: 'for',
    label,
    steps: toSteps(statement.body),
    loopVariableName: statement.loopVariableName,
    rangeStart: statement.rangeStart,
    rangeEnd: statement.rangeEnd,
  }
}

function ifStep(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: IfStatement,
): SwitchStep {
  const label = generateLabel('switch')
  const toSteps = statementListToSteps(generateLabel, ctx)
  const branches = statement.branches.map((branch) => {
    if ('body' in branch) {
      // Use the shorter "next" form on break and continue statements
      if (branch.body.length === 1 && branch.body[0].tag === 'break') {
        return {
          condition: branch.condition,
          next: breakStep(generateLabel, ctx, branch.body[0]).next,
        }
      } else if (
        branch.body.length === 1 &&
        branch.body[0].tag === 'continue'
      ) {
        return {
          condition: branch.condition,
          next: continueStep(generateLabel, ctx, branch.body[0]).next,
        }
      } else {
        return {
          condition: branch.condition,
          steps: toSteps(branch.body),
        }
      }
    } else {
      return {
        condition: branch.condition,
        next: branch.next,
      }
    }
  })

  return {
    tag: 'switch',
    label,
    branches,
  }
}

function labelledSteps(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: LabelledStatement,
): WorkflowStep[] {
  const toSteps = statementListToSteps(generateLabel, ctx)
  const steps = toSteps(statement.statements)

  if (steps.length >= 1) {
    // FIXME: do not first generate a label and then immediately overwrite it here
    steps[0].label = statement.label
  }

  return steps
}

function parallelStep(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: ParallelStatement,
): ParallelStep {
  const label = generateLabel('parallel')
  const toSteps = statementListToSteps(generateLabel, ctx)
  const branches = statement.branches.map((branch) => ({
    name: branch.name,
    steps: toSteps(branch.body),
  }))

  return {
    tag: 'parallel',
    label,
    branches,
    shared: statement.shared,
    concurrencyLimit: statement.concurrencyLimit,
    exceptionPolicy: statement.exceptionPolicy,
  }
}

function parallelIterationStep(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: ParallelForStatement,
): ParallelIterationStep {
  const label = generateLabel('parallel')
  const innerStep =
    statement.forStep.tag === 'for'
      ? forStep(generateLabel, ctx, statement.forStep)
      : forRangeStep(generateLabel, ctx, statement.forStep)

  return {
    tag: 'parallel-for',
    label,
    forStep: innerStep,
    shared: statement.shared,
    concurrencyLimit: statement.concurrencyLimit,
    exceptionPolicy: statement.exceptionPolicy,
  }
}

function returnStep(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: ReturnStatement,
): ReturnStep | AssignStep {
  if (ctx.finalizerTargets && ctx.finalizerTargets.length > 0) {
    // If we are in try statement with a finally block, return statements are
    // replaced by a jump to finally back with a captured return value.
    return delayedReturnAndJumpToFinalizer(generateLabel, ctx, statement.value)
  } else {
    return {
      tag: 'return',
      label: generateLabel('return'),
      value: statement.value,
    }
  }
}

function delayedReturnAndJumpToFinalizer(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  value: Expression | undefined,
): AssignStep {
  const finalizerTarget =
    ctx.finalizerTargets && ctx.finalizerTargets.length > 0
      ? ctx.finalizerTargets[ctx.finalizerTargets.length - 1]
      : undefined
  const [conditionVariable, valueVariable] = finalizerVariables(ctx)

  return {
    tag: 'assign',
    label: generateLabel('assign'),
    assignments: [
      {
        name: variableReferenceEx(conditionVariable),
        value: stringEx('return'),
      },
      {
        name: variableReferenceEx(valueVariable),
        value: value ?? nullEx,
      },
    ],
    next: finalizerTarget,
  }
}

function switchSteps(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: SwitchStatement,
): WorkflowStep[] {
  const label = generateLabel('switch')
  const endOfSwitchLabel = generatePlaceholderLabel()
  const switchCtx = Object.assign({}, ctx, { breakTarget: endOfSwitchLabel })
  const toSteps = statementListToSteps(generateLabel, switchCtx)
  const steps: WorkflowStep[] = []
  const branches: IfNextBranch[] = []

  // prepare steps for each branch so that we will have jump targets ready even for
  // fall-through branches that need to jump to the next branch
  const branchSteps = statement.branches.map((branch) => toSteps(branch.body))
  steps.push(...branchSteps.flat())

  statement.branches.forEach((branch, i) => {
    // search forward until the next non-fall-through branch (= a branch that has
    // non-empty steps)
    const jumpTarget = branchSteps.slice(i).find((s) => s.length > 0)
    const next = jumpTarget?.[0]?.label ?? endOfSwitchLabel
    branches.push({
      condition: branch.condition,
      next,
    })
  })

  steps.unshift({
    tag: 'switch',
    label,
    branches,
  })

  steps.push({
    tag: 'jump-target',
    label: endOfSwitchLabel,
  })

  return steps
}

function trySteps(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: TryStatement,
): WorkflowStep[] {
  if (!statement.finalizerBody) {
    // Basic try-catch without a finally block
    return [tryCatchRetrySteps(generateLabel, ctx, statement)]
  } else {
    // Try-finally is translated to two nested try blocks. The innermost try is
    // the actual try body with control flow statements (return, in the future
    // also break/continue) replaced by jumps to the finally block.
    //
    // The outer try's catch block saves the exception and continues to the
    // finally block.
    //
    // The nested try blocks are followed by the finally block and a switch for
    // checking if we need to perform a delayed return/raise.
    const startOfFinalizer = {
      tag: 'jump-target' as const,
      label: generatePlaceholderLabel(),
    }

    const targets = ctx.finalizerTargets ?? []
    targets.push(startOfFinalizer.label)
    ctx = Object.assign({}, ctx, { finalizerTargets: targets })

    const [conditionVariable, valueVariable] = finalizerVariables(ctx)
    const initStatement = finalizerInitializer(
      generateLabel,
      conditionVariable,
      valueVariable,
    )
    const outerLabel = generateLabel('try')
    const innerTry = tryCatchRetrySteps(generateLabel, ctx, statement)

    const outerTry = {
      tag: 'try' as const,
      label: outerLabel,
      trySteps: [innerTry],
      exceptSteps: finalizerDelayedException(
        generateLabel,
        '__fin_exc',
        conditionVariable,
        valueVariable,
      ),
      errorMap: '__fin_exc',
    }

    // Reset ctx before parsing the finally block because we don't want to
    // transform returns in finally block in to delayed returns
    if (ctx.finalizerTargets && ctx.finalizerTargets.length <= 1) {
      delete ctx.finalizerTargets
    } else {
      ctx.finalizerTargets?.pop()
    }

    const toSteps = statementListToSteps(generateLabel, ctx)
    const finallyBlock = toSteps(statement.finalizerBody)

    return [
      initStatement,
      outerTry,
      startOfFinalizer,
      ...finallyBlock,
      finalizerFooter(generateLabel, conditionVariable, valueVariable),
    ]
  }
}

function tryCatchRetrySteps(
  generateLabel: (prefix: string) => string,
  ctx: StepContext,
  statement: TryStatement,
): TryStep {
  const toSteps = statementListToSteps(generateLabel, ctx)

  return {
    tag: 'try',
    label: generateLabel('try'),
    trySteps: toSteps(statement.tryBody),
    exceptSteps: statement.exceptBody
      ? toSteps(statement.exceptBody)
      : undefined,
    retryPolicy: statement.retryPolicy,
    errorMap: statement.errorMap,
  }
}

function finalizerVariables(ctx: StepContext): [string, string] {
  const targets = ctx.finalizerTargets ?? []
  const nestingLevel = targets.length > 0 ? `${targets.length}` : ''
  const conditionVariable = `__t2w_finally_condition${nestingLevel}`
  const valueVariable = `__t2w_finally_value${nestingLevel}`

  return [conditionVariable, valueVariable]
}

/**
 * The shared header for try-finally for initializing the temp variables
 */
function finalizerInitializer(
  generateLabel: (prefix: string) => string,
  conditionVariable: string,
  valueVariable: string,
): AssignStep {
  return {
    tag: 'assign',
    label: generateLabel('assign'),
    assignments: [
      {
        name: variableReferenceEx(conditionVariable),
        value: nullEx,
      },
      {
        name: variableReferenceEx(valueVariable),
        value: nullEx,
      },
    ],
  }
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
function finalizerFooter(
  generateLabel: (prefix: string) => string,
  conditionVariable: string,
  valueVariable: string,
): SwitchStep {
  const variable = variableReferenceEx(conditionVariable)
  const val = variableReferenceEx(valueVariable)
  const returnString = stringEx('return')
  const raiseString = stringEx('raise')

  return {
    tag: 'switch',
    label: generateLabel('switch'),
    branches: [
      {
        condition: binaryEx(variable, '==', returnString),
        steps: [{ tag: 'return', label: generateLabel('return'), value: val }],
      },
      {
        condition: binaryEx(variable, '==', raiseString),
        steps: [{ tag: 'raise', label: generateLabel('raise'), value: val }],
      },
    ],
  }
}

function finalizerDelayedException(
  generateLabel: (prefix: string) => string,
  exceptionVariableName: string,
  conditionVariableName: string,
  valueVariableName: string,
): AssignStep[] {
  return [
    {
      tag: 'assign',
      label: generateLabel('assign'),
      assignments: [
        {
          name: variableReferenceEx(conditionVariableName),
          value: stringEx('raise'),
        },
        {
          name: variableReferenceEx(valueVariableName),
          value: variableReferenceEx(exceptionVariableName),
        },
      ],
    },
  ]
}

function generatePlaceholderLabel(): StepName {
  return `jumptarget_${Math.floor(Math.random() * 2 ** 32).toString(16)}`
}

/**
 * Merge a next step to the previous step.
 *
 * For example, transforms this:
 *
 * - assign1:
 *     assign:
 *       - a: 1
 * - next1:
 *     next: target1
 *
 * into this:
 *
 * - assign1:
 *     assign:
 *       - a: 1
 *     next: target1
 */
function mergeNextStep(steps: WorkflowStep[]): WorkflowStep[] {
  return steps.reduce((acc, step) => {
    const prev = acc.at(-1)
    if (step.tag === 'next' && prev?.tag === 'assign') {
      // TODO: This will delete the "next" step that already had a label. The
      // output will have a hole in label number. How to avoid that?
      acc.pop()
      acc.push({ ...prev, next: step.next })
    } else {
      acc.push(step)
    }

    return acc
  }, [] as WorkflowStep[])
}

function appendNextStep(
  generateLabel: (prefix: string) => string,
  steps: WorkflowStep[],
  nextLabel: StepName,
): WorkflowStep[] {
  const last = steps.at(-1)
  if (last?.tag === 'assign') {
    steps.pop()
    steps.push({ ...last, next: nextLabel })
  } else {
    steps.push({
      tag: 'next',
      label: generateLabel('next'),
      next: nextLabel,
    })
  }

  return steps
}

function fixJumpLabels(steps: WorkflowStep[]): WorkflowStep[] {
  const jumpTargetLabels = collectActualJumpTargets(steps)
  const stepsWithoutJumpTargetNodes = removeJumpTargetSteps(steps)
  const relabeledSteps = relabelNextLabels(
    stepsWithoutJumpTargetNodes,
    jumpTargetLabels,
  )

  return relabeledSteps
}

/**
 * Find a mapping from jump target labels to step names.
 *
 * Iterate over all steps in the workflow. For JumpTargetAST nodes, find the
 * next node that is not a JumpTargetAST, save its name as the real jump taget
 * name.
 */
function collectActualJumpTargets(
  steps: WorkflowStep[],
): Map<StepName, StepName> {
  const replacements = new Map<StepName, StepName>()

  // The processing is done iteratively with an explicit stack because
  // nextNonJumpTargetNode() needs the stack. Note the order of steps on the
  // stack: the first step is the last element of the stack.
  const stack: JumpStackElement[] = []
  stack.push(...stepsToJumpStackElements(steps, 0))

  while (stack.length > 0) {
    // Do not yet pop in case nextNonJumpTargetNode needs to search the stack
    const { step, nestingLevel } = stack[stack.length - 1]

    if (step.tag === 'jump-target') {
      const currentLabel = step.label
      const target = nextNonJumpTargetNode(stack)
      const targetName = target ? target.label : 'end'
      replacements.set(currentLabel, targetName)
    }

    // Now nextNonJumpTargetNode has been executed and it's safe to pop the
    // current element from the stack.
    stack.pop()

    const children = nestedSteps(step).map((x) =>
      stepsToJumpStackElements(x, nestingLevel + 1),
    )
    children.reverse()
    children.forEach((nestedChildren) => {
      stack.push(...nestedChildren)
    })
  }

  return replacements
}

function stepsToJumpStackElements(
  steps: WorkflowStep[],
  nestingLevel: number,
): JumpStackElement[] {
  const block = steps.map((step, i) => ({
    step,
    nestingLevel,
    isLastInBlock: i === steps.length - 1,
  }))
  block.reverse()
  return block
}

function nextNonJumpTargetNode(
  stack: readonly JumpStackElement[],
): WorkflowStep | undefined {
  if (stack.length <= 0) {
    return undefined
  }

  let nestingLevel = stack[stack.length - 1].nestingLevel
  while (nestingLevel >= 0) {
    // Consider only the steps in the current code block (= the same nesting
    // level, taking steps until isLastInBlock)
    const endOfBlockIndex = stack.findLastIndex(
      (x) => x.nestingLevel === nestingLevel && x.isLastInBlock,
    )
    if (endOfBlockIndex < 0) {
      // should not be reached
      throw new InternalTranspilingError(
        'Failed to find end of block in nextNonJumpTargetNode',
      )
    }

    const firstNonJumpTarget = stack
      .slice(endOfBlockIndex)
      .findLast(
        (x) => x.nestingLevel === nestingLevel && x.step.tag !== 'jump-target',
      )
    if (firstNonJumpTarget) {
      return firstNonJumpTarget.step
    }

    nestingLevel--
  }

  return undefined
}

function nestedSteps(step: WorkflowStep): WorkflowStep[][] {
  switch (step.tag) {
    case 'assign':
    case 'call':
    case 'next':
    case 'raise':
    case 'return':
    case 'jump-target':
      return []

    case 'for':
      return [step.steps]

    case 'parallel':
      return step.branches.map((x) => x.steps)

    case 'parallel-for':
      return [step.forStep.steps]

    case 'switch':
      return step.branches.map((x) => x.steps ?? [])

    case 'try':
      return nestedStepsTry(step)
  }
}

function nestedStepsTry(step: TryStep): WorkflowStep[][] {
  const nested = []
  if (step.trySteps.length > 0) {
    nested.push(step.trySteps)
  }
  if (step.exceptSteps) {
    nested.push(step.exceptSteps)
  }

  return nested
}

function removeJumpTargetSteps(steps: WorkflowStep[]): WorkflowStep[] {
  return steps
    .filter((x) => x.tag !== 'jump-target')
    .map(removeJumpTargetRecurse)
}

function removeJumpTargetRecurse(step: WorkflowStep): WorkflowStep {
  switch (step.tag) {
    case 'assign':
    case 'call':
    case 'next':
    case 'raise':
    case 'return':
    case 'jump-target':
      return step

    case 'for':
      return removeJumpTargetsFor(step)

    case 'parallel':
      return removeJumpTargetsParallel(step)

    case 'parallel-for':
      return removeJumpTargetsParallelIteration(step)

    case 'switch':
      return removeJumpTargetsSwitch(step)

    case 'try':
      return removeJumpTargetTry(step)
  }
}

function removeJumpTargetsFor(step: ForStep): ForStep {
  return {
    ...step,
    steps: removeJumpTargetSteps(step.steps),
  }
}

function removeJumpTargetsParallel(step: ParallelStep): ParallelStep {
  const branches = step.branches.map(({ name, steps: nestedSteps }) => ({
    name,
    steps: removeJumpTargetSteps(nestedSteps),
  }))

  return {
    ...step,
    branches,
  }
}

function removeJumpTargetsParallelIteration(
  step: ParallelIterationStep,
): ParallelIterationStep {
  return {
    ...step,
    forStep: removeJumpTargetsFor(step.forStep),
  }
}

function removeJumpTargetsSwitch(step: SwitchStep): SwitchStep {
  const transformedBranches = step.branches.map((branch) => {
    return {
      condition: branch.condition,
      steps:
        branch.steps !== undefined
          ? removeJumpTargetSteps(branch.steps)
          : undefined,
      next: branch.next,
    }
  })

  return {
    ...step,
    branches: transformedBranches,
  }
}

function removeJumpTargetTry(step: TryStep): TryStep {
  return {
    ...step,
    trySteps: removeJumpTargetSteps(step.trySteps),
    exceptSteps:
      step.exceptSteps !== undefined
        ? removeJumpTargetSteps(step.exceptSteps)
        : undefined,
  }
}

function relabelNextLabels(
  steps: WorkflowStep[],
  replacements: Map<StepName, StepName>,
): WorkflowStep[] {
  return steps.map((step) => renameJumpTargets(step, replacements))
}

function renameJumpTargets(
  step: WorkflowStep,
  replaceLabels: Map<StepName, StepName>,
): WorkflowStep {
  switch (step.tag) {
    case 'call':
    case 'raise':
    case 'return':
    case 'jump-target':
      return step

    case 'assign':
      return renameJumpTargetsAssign(step, replaceLabels)

    case 'for':
      return renameJumpTargetsFor(step, replaceLabels)

    case 'next':
      return renameJumpTargetsNext(step, replaceLabels)

    case 'parallel':
      return renameJumpTargetsParallel(step, replaceLabels)

    case 'parallel-for':
      return renameJumpTargetsParallelIteration(step, replaceLabels)

    case 'switch':
      return renameJumpTargetsSwitch(step, replaceLabels)

    case 'try':
      return renameJumpTargetsTry(step, replaceLabels)
  }
}

function renameJumpTargetsAssign(
  step: AssignStep,
  replaceLabels: Map<StepName, StepName>,
): AssignStep {
  if (step.next) {
    const newLabel = replaceLabels.get(step.next)

    if (newLabel) {
      return { ...step, next: newLabel }
    }
  }

  return step
}

function renameJumpTargetsFor(
  step: ForStep,
  replaceLabels: Map<StepName, StepName>,
): ForStep {
  const transformedSteps = step.steps.map((s) =>
    renameJumpTargets(s, replaceLabels),
  )

  return { ...step, steps: transformedSteps }
}

function renameJumpTargetsNext(
  step: NextStep,
  replaceLabels: Map<StepName, StepName>,
): NextStep {
  const newLabel = replaceLabels.get(step.next)
  if (newLabel) {
    return { ...step, next: newLabel }
  } else {
    return step
  }
}

function renameJumpTargetsParallel(
  step: ParallelStep,
  replaceLabels: Map<StepName, StepName>,
): ParallelStep {
  const branches = step.branches.map(({ name, steps }) => ({
    name,
    steps: steps.map((s) => renameJumpTargets(s, replaceLabels)),
  }))

  return { ...step, branches }
}

function renameJumpTargetsParallelIteration(
  step: ParallelIterationStep,
  replaceLabels: Map<StepName, StepName>,
): ParallelIterationStep {
  return { ...step, forStep: renameJumpTargetsFor(step.forStep, replaceLabels) }
}

function renameJumpTargetsSwitch(
  step: SwitchStep,
  replaceLabels: Map<StepName, StepName>,
): SwitchStep {
  let updatedNext: StepName | undefined = undefined
  if (step.next) {
    updatedNext = replaceLabels.get(step.next) ?? step.next
  }

  const updatedBranches = step.branches.map((cond) => {
    let updatedCondNext: StepName | undefined = undefined
    if (cond.next) {
      updatedCondNext = replaceLabels.get(cond.next) ?? cond.next
    }

    const updatedCondSteps = cond.steps?.map((nested) =>
      renameJumpTargets(nested, replaceLabels),
    )

    return {
      condition: cond.condition,
      steps: updatedCondSteps,
      next: updatedCondNext,
    }
  })

  return {
    tag: 'switch',
    label: step.label,
    branches: updatedBranches,
    next: updatedNext,
  }
}

function renameJumpTargetsTry(
  step: TryStep,
  replaceLabels: Map<StepName, StepName>,
): TryStep {
  const transformedTrySteps = step.trySteps.map((nested) =>
    renameJumpTargets(nested, replaceLabels),
  )
  const transformedExceptSteps = step.exceptSteps?.map((nested) =>
    renameJumpTargets(nested, replaceLabels),
  )

  return {
    ...step,
    trySteps: transformedTrySteps,
    exceptSteps: transformedExceptSteps,
  }
}
