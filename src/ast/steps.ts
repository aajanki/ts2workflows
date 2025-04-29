import * as R from 'ramda'
import { isRecord } from '../utils.js'
import {
  Expression,
  LiteralValueOrLiteralExpression,
  MemberExpression,
  VariableName,
  VariableReferenceExpression,
  expressionToLiteralValueOrLiteralExpression,
} from './expressions.js'
import { Subworkflow, WorkflowParameter } from './workflows.js'

export type StepName = string
export interface VariableAssignment {
  name: VariableReferenceExpression | MemberExpression
  value: Expression
}
export type WorkflowParameters = Record<VariableName, Expression>

// According to the documentation
// (https://cloud.google.com/workflows/docs/reference/syntax/retrying#try-retry)
// all parameters are required, but in practice they can be left out.
// Perhaps Workflows substitutes some default values?
// Values are expected to be numbers or number valued expressions. Strings
// are apparently accepted, too, and probably coerced to numbers.
export interface CustomRetryPolicy {
  predicate?: string
  maxRetries: Expression
  backoff: {
    initialDelay?: Expression
    maxDelay?: Expression
    multiplier?: Expression
  }
}

export interface WorkflowAST {
  readonly subworkflows: SubworkflowAST[]
}

export class SubworkflowAST {
  readonly name: string
  readonly steps: WorkflowStepAST[]
  readonly params?: WorkflowParameter[]

  constructor(
    name: string,
    steps: WorkflowStepAST[],
    params?: WorkflowParameter[],
  ) {
    this.name = name
    this.steps = steps
    this.params = params
  }

  withStepNames(generate: (prefix: string) => string): Subworkflow {
    const steps = this.steps.map((step) => namedSteps(step, generate))
    return new Subworkflow(this.name, steps, this.params)
  }
}

/**
 * A workflow step before step names have been assigned.
 */
export type WorkflowStepAST =
  | AssignStepAST
  | CallStepAST
  | ForStepAST
  | ForRangeStepAST
  | NextStepAST
  | ParallelStepAST
  | RaiseStepAST
  | ReturnStepAST
  | StepsStepAST
  | SwitchStepAST
  | TryStepAST
  | JumpTargetAST

/**
 * A workflow step after names have been generated for the nested steps.
 */
export type WorkflowStepASTWithNamedNested =
  | AssignStepAST
  | CallStepAST
  | ForStepASTNamed
  | NextStepAST
  | ParallelStepASTNamed
  | RaiseStepAST
  | ReturnStepAST
  | StepsStepASTNamed
  | SwitchStepASTNamed
  | TryStepASTNamed
  | JumpTargetAST

export interface NamedWorkflowStep {
  name: StepName
  step: WorkflowStepASTWithNamedNested
}

// https://cloud.google.com/workflows/docs/reference/syntax/variables#assign-step
export class AssignStepAST {
  readonly tag = 'assign'
  readonly assignments: VariableAssignment[]
  readonly label?: string
  readonly next?: string

  constructor(
    assignments: VariableAssignment[],
    next?: string,
    label?: string,
  ) {
    this.assignments = assignments
    this.next = next
    this.label = label
  }

  withNext(newNext?: string): AssignStepAST {
    if (newNext === this.next) {
      return this
    } else {
      return new AssignStepAST(this.assignments, newNext, this.label)
    }
  }

  withLabel(newLabel?: string): AssignStepAST {
    return new AssignStepAST(this.assignments, this.next, newLabel)
  }

  applyNestedSteps(): AssignStepAST {
    return this
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/calls
export class CallStepAST {
  readonly tag = 'call'
  readonly call: string
  readonly args?: WorkflowParameters
  readonly result?: VariableName
  readonly label?: string

  constructor(
    call: string,
    args?: WorkflowParameters,
    result?: VariableName,
    label?: string,
  ) {
    this.call = call
    this.args = args
    this.result = result
    this.label = label
  }

  labelPrefix(): string {
    return 'call_' + this.call.replaceAll(/[^a-zA-Z0-9]/g, '_') + '_'
  }

  withLabel(newLabel?: string): CallStepAST {
    return new CallStepAST(this.call, this.args, this.result, newLabel)
  }

  applyNestedSteps(): CallStepAST {
    return this
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/iteration
export class ForStepAST {
  readonly tag = 'for'
  readonly steps: WorkflowStepAST[]
  readonly loopVariableName: VariableName
  readonly indexVariableName?: VariableName
  readonly listExpression: Expression
  readonly label?: string

  constructor(
    steps: WorkflowStepAST[],
    loopVariableName: VariableName,
    listExpression: Expression,
    indexVariable?: VariableName,
    label?: string,
  ) {
    this.steps = steps
    this.loopVariableName = loopVariableName
    this.listExpression = listExpression
    this.indexVariableName = indexVariable
    this.label = label
  }

  withLabel(newLabel?: string): ForStepAST {
    return new ForStepAST(
      this.steps,
      this.loopVariableName,
      this.listExpression,
      this.indexVariableName,
      newLabel,
    )
  }

  applyNestedSteps(
    fn: (steps: WorkflowStepAST[]) => WorkflowStepAST[],
  ): ForStepAST {
    return new ForStepAST(
      fn(this.steps),
      this.loopVariableName,
      this.listExpression,
      this.indexVariableName,
      this.label,
    )
  }
}

export class ForRangeStepAST {
  readonly tag = 'forrange'
  readonly steps: WorkflowStepAST[]
  readonly loopVariableName: VariableName
  readonly rangeStart: number | Expression
  readonly rangeEnd: number | Expression
  readonly label?: string

  constructor(
    steps: WorkflowStepAST[],
    loopVariableName: VariableName,
    rangeStart: number | Expression,
    rangeEnd: number | Expression,
    label?: string,
  ) {
    this.steps = steps
    this.loopVariableName = loopVariableName
    this.rangeStart = rangeStart
    this.rangeEnd = rangeEnd
    this.label = label
  }

  withLabel(newLabel?: string): ForRangeStepAST {
    return new ForRangeStepAST(
      this.steps,
      this.loopVariableName,
      this.rangeStart,
      this.rangeEnd,
      newLabel,
    )
  }

  applyNestedSteps(
    fn: (steps: WorkflowStepAST[]) => WorkflowStepAST[],
  ): ForRangeStepAST {
    return new ForRangeStepAST(
      fn(this.steps),
      this.loopVariableName,
      this.rangeStart,
      this.rangeEnd,
      this.label,
    )
  }
}

export class ForStepASTNamed {
  readonly tag = 'for'
  readonly steps: NamedWorkflowStep[]
  readonly loopVariableName: VariableName
  readonly indexVariableName?: VariableName
  readonly listExpression?: Expression
  readonly rangeStart?: number | Expression
  readonly rangeEnd?: number | Expression

  constructor(
    steps: NamedWorkflowStep[],
    loopVariableName: VariableName,
    listExpression?: Expression,
    indexVariable?: VariableName,
    rangeStart?: number | Expression,
    rangeEnd?: number | Expression,
  ) {
    this.steps = steps
    this.loopVariableName = loopVariableName
    this.listExpression = listExpression
    this.indexVariableName = indexVariable
    this.rangeStart = rangeStart
    this.rangeEnd = rangeEnd
  }
}

export class NextStepAST {
  readonly tag = 'next'
  readonly target: string
  readonly label?: string

  constructor(target: string, label?: string) {
    this.target = target
    this.label = label
  }

  withLabel(newLabel?: string): NextStepAST {
    return new NextStepAST(this.target, newLabel)
  }

  applyNestedSteps(): NextStepAST {
    return this
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps
export class ParallelStepAST {
  readonly tag = 'parallel'
  readonly steps: Record<StepName, StepsStepAST> | ForStepAST
  readonly shared?: VariableName[]
  readonly concurrencyLimit?: number
  readonly exceptionPolicy?: string
  readonly label?: string

  constructor(
    steps: Record<StepName, StepsStepAST> | ForStepAST,
    shared?: VariableName[],
    concurrencyLimit?: number,
    exceptionPolicy?: string,
    label?: string,
  ) {
    this.steps = steps
    this.shared = shared
    this.concurrencyLimit = concurrencyLimit
    this.exceptionPolicy = exceptionPolicy
    this.label = label
  }

  withLabel(newLabel?: string): ParallelStepAST {
    return new ParallelStepAST(
      this.steps,
      this.shared,
      this.concurrencyLimit,
      this.exceptionPolicy,
      newLabel,
    )
  }

  applyNestedSteps(
    fn: (steps: WorkflowStepAST[]) => WorkflowStepAST[],
  ): ParallelStepAST {
    let transformedSteps: Record<StepName, StepsStepAST> | ForStepAST
    if (this.steps instanceof ForStepAST) {
      transformedSteps = this.steps.applyNestedSteps(fn)
    } else {
      transformedSteps = R.map(
        (s) => new StepsStepAST(fn(s.steps), s.label),
        this.steps,
      )
    }

    return new ParallelStepAST(
      transformedSteps,
      this.shared,
      this.concurrencyLimit,
      this.exceptionPolicy,
      this.label,
    )
  }
}

export class ParallelStepASTNamed {
  readonly tag = 'parallel'
  readonly branches?: NamedWorkflowStep[] // Either steps for each branch
  readonly forStep?: ForStepASTNamed // ... or a parallel for
  readonly shared?: VariableName[]
  readonly concurrenceLimit?: number
  readonly exceptionPolicy?: string

  constructor(
    steps: Record<StepName, StepsStepASTNamed> | ForStepASTNamed,
    shared?: VariableName[],
    concurrencyLimit?: number,
    exceptionPolicy?: string,
  ) {
    this.shared = shared
    this.concurrenceLimit = concurrencyLimit
    this.exceptionPolicy = exceptionPolicy

    if (!isRecord(steps)) {
      this.forStep = steps
    } else {
      this.branches = Object.entries(steps).map((x) => {
        return { name: x[0], step: x[1] }
      })
    }
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/raising-errors
export class RaiseStepAST {
  readonly tag = 'raise'
  readonly value: Expression
  readonly label?: string

  constructor(value: Expression, label?: string) {
    this.value = value
    this.label = label
  }

  withLabel(newLabel?: string): RaiseStepAST {
    return new RaiseStepAST(this.value, newLabel)
  }

  applyNestedSteps(): RaiseStepAST {
    return this
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/completing
export class ReturnStepAST {
  readonly tag = 'return'
  readonly value?: Expression
  readonly label?: string

  constructor(value: Expression | undefined, label?: string) {
    this.value = value
    this.label = label
  }

  withLabel(newLabel?: string): ReturnStepAST {
    return new ReturnStepAST(this.value, newLabel)
  }

  applyNestedSteps(): ReturnStepAST {
    return this
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/steps#embedded-steps
export class StepsStepAST {
  readonly tag = 'steps'
  readonly steps: WorkflowStepAST[]
  readonly label?: string

  constructor(steps: WorkflowStepAST[], label?: string) {
    this.steps = steps
    this.label = label
  }

  withLabel(newLabel?: string): StepsStepAST {
    return new StepsStepAST(this.steps, newLabel)
  }

  applyNestedSteps(
    fn: (steps: WorkflowStepAST[]) => WorkflowStepAST[],
  ): StepsStepAST {
    return new StepsStepAST(fn(this.steps), this.label)
  }
}

export class StepsStepASTNamed {
  readonly tag = 'steps'
  readonly steps: NamedWorkflowStep[]

  constructor(steps: NamedWorkflowStep[]) {
    this.steps = steps
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/conditions
export class SwitchStepAST {
  readonly tag = 'switch'
  readonly branches: SwitchConditionAST<WorkflowStepAST>[]
  readonly label?: string

  constructor(branches: SwitchConditionAST<WorkflowStepAST>[], label?: string) {
    this.branches = branches
    this.label = label
  }

  withLabel(newLabel?: string): SwitchStepAST {
    return new SwitchStepAST(this.branches, newLabel)
  }

  applyNestedSteps(
    fn: (steps: WorkflowStepAST[]) => WorkflowStepAST[],
  ): SwitchStepAST {
    return new SwitchStepAST(
      this.branches.map((branch) => ({
        condition: branch.condition,
        steps: fn(branch.steps),
        next: branch.next,
      })),
      this.label,
    )
  }
}

export class SwitchStepASTNamed {
  readonly tag = 'switch'
  readonly branches: SwitchConditionAST<NamedWorkflowStep>[]
  readonly next?: StepName

  constructor(
    branches: SwitchConditionAST<NamedWorkflowStep>[],
    next?: StepName,
  ) {
    this.branches = branches
    this.next = next
  }
}

export interface SwitchConditionAST<
  T extends WorkflowStepAST | NamedWorkflowStep,
> {
  readonly condition: Expression
  readonly steps: T[]
  readonly next?: StepName
}

// https://cloud.google.com/workflows/docs/reference/syntax/catching-errors
export class TryStepAST {
  readonly tag = 'try'
  // Steps in the try block
  readonly trySteps: WorkflowStepAST[]
  // Steps in the except block
  readonly exceptSteps?: WorkflowStepAST[]
  readonly retryPolicy?: string | CustomRetryPolicy
  readonly errorMap?: VariableName
  readonly label?: string

  constructor(
    trySteps: WorkflowStepAST[],
    exceptSteps?: WorkflowStepAST[],
    retryPolicy?: string | CustomRetryPolicy,
    errorMap?: VariableName,
    label?: string,
  ) {
    this.trySteps = trySteps
    this.exceptSteps = exceptSteps
    this.retryPolicy = retryPolicy
    this.errorMap = errorMap
    this.label = label
  }

  withLabel(newLabel?: string): TryStepAST {
    return new TryStepAST(
      this.trySteps,
      this.exceptSteps,
      this.retryPolicy,
      this.errorMap,
      newLabel,
    )
  }

  applyNestedSteps(
    fn: (steps: WorkflowStepAST[]) => WorkflowStepAST[],
  ): TryStepAST {
    return new TryStepAST(
      fn(this.trySteps),
      this.exceptSteps ? fn(this.exceptSteps) : undefined,
      this.retryPolicy,
      this.errorMap,
      this.label,
    )
  }
}

export class TryStepASTNamed {
  readonly tag = 'try'
  // Steps in the try block
  readonly trySteps: NamedWorkflowStep[]
  // Steps in the except block
  readonly exceptSteps?: NamedWorkflowStep[]
  readonly retryPolicy?: string | CustomRetryPolicy
  readonly errorMap?: VariableName

  constructor(
    trySteps: NamedWorkflowStep[],
    exceptSteps?: NamedWorkflowStep[],
    retryPolicy?: string | CustomRetryPolicy,
    errorMap?: VariableName,
  ) {
    this.trySteps = trySteps
    this.retryPolicy = retryPolicy
    this.errorMap = errorMap
    this.exceptSteps = exceptSteps
  }
}

// Internal step that represents a potential jump target.
// This can be ued as a placeholder when the actual target step is not yet known.
// JumpTargetAST is removed before transpiling to workflows YAML.
export class JumpTargetAST {
  readonly tag = 'jumptarget'
  readonly label: string

  constructor() {
    this.label = `jumptarget_${Math.floor(Math.random() * 2 ** 32).toString(16)}`
  }

  applyNestedSteps(): JumpTargetAST {
    return this
  }
}

/**
 * Assign a name for this step and its child steps.
 *
 * The name is generated by calling generateName with a prefix identifying the step type.
 */
export function namedSteps(
  step: WorkflowStepAST,
  generateName: (prefix: string) => string,
): NamedWorkflowStep {
  switch (step.tag) {
    case 'assign':
    case 'next':
    case 'raise':
    case 'return':
      return {
        name: step.label ?? generateName(step.tag),
        step,
      }

    case 'call':
      return {
        name: step.label ?? generateName(step.labelPrefix()),
        step,
      }

    case 'for':
      return namedStepsFor(step, generateName)

    case 'forrange':
      return namedStepsForRange(step, generateName)

    case 'parallel':
      return namedStepsParallel(step, generateName)

    case 'steps':
      return namedStepsSteps(step, generateName)

    case 'switch':
      return namedStepsSwitch(step, generateName)

    case 'try':
      return namedStepsTry(step, generateName)

    case 'jumptarget':
      return {
        name: step.label,
        step: step,
      }
  }
}

function namedStepsFor(
  step: ForStepAST,
  generateName: (prefix: string) => string,
): NamedWorkflowStep {
  return {
    name: step.label ?? generateName('for'),
    step: new ForStepASTNamed(
      step.steps.map((nestedStep) => namedSteps(nestedStep, generateName)),
      step.loopVariableName,
      step.listExpression,
      step.indexVariableName,
    ),
  }
}

function namedStepsForRange(
  step: ForRangeStepAST,
  generateName: (prefix: string) => string,
): NamedWorkflowStep {
  return {
    name: step.label ?? generateName('for'),
    step: new ForStepASTNamed(
      step.steps.map((nestedStep) => namedSteps(nestedStep, generateName)),
      step.loopVariableName,
      undefined,
      undefined,
      step.rangeStart,
      step.rangeEnd,
    ),
  }
}

function namedStepsParallel(
  step: ParallelStepAST,
  generateName: (prefix: string) => string,
) {
  let steps: Record<StepName, StepsStepASTNamed> | ForStepASTNamed
  const mainLabel = step.label ?? generateName('parallel')
  if (!isRecord(step.steps)) {
    const forStep = namedSteps(step.steps, generateName).step

    if (forStep.tag !== 'for') {
      throw new Error(
        `Encountered a step of type ${forStep.tag} when a for step was expected`,
      )
    }

    steps = forStep
  } else {
    steps = R.map((step) => {
      const named = step.steps.map((x) => namedSteps(x, generateName))
      return new StepsStepASTNamed(named)
    }, step.steps)
  }

  return {
    name: mainLabel,
    step: new ParallelStepASTNamed(
      steps,
      step.shared,
      step.concurrencyLimit,
      step.exceptionPolicy,
    ),
  }
}

function namedStepsSteps(
  step: StepsStepAST,
  generateName: (prefix: string) => string,
): NamedWorkflowStep {
  return {
    name: step.label ?? generateName('steps'),
    step: new StepsStepASTNamed(
      step.steps.map((nested) => namedSteps(nested, generateName)),
    ),
  }
}

function namedStepsSwitch(
  step: SwitchStepAST,
  generateName: (prefix: string) => string,
): NamedWorkflowStep {
  const mainLabel = step.label ?? generateName('switch')
  const namedBranches = step.branches.map((branch) => ({
    condition: branch.condition,
    steps: branch.steps.map((nested) => namedSteps(nested, generateName)),
    next: branch.next,
  }))

  return {
    name: mainLabel,
    step: new SwitchStepASTNamed(namedBranches),
  }
}

function namedStepsTry(
  step: TryStepAST,
  generateName: (prefix: string) => string,
) {
  const mainLabel = step.label ?? generateName('try')
  const namedTrySteps = step.trySteps.map((nested) =>
    namedSteps(nested, generateName),
  )
  const namedExceptSteps = step.exceptSteps?.map((nested) =>
    namedSteps(nested, generateName),
  )

  return {
    name: mainLabel,
    step: new TryStepASTNamed(
      namedTrySteps,
      namedExceptSteps,
      step.retryPolicy,
      step.errorMap,
    ),
  }
}

/**
 * Returns the nested steps in contained in this step.
 *
 * Used in iterating the AST tree.
 */
export function nestedSteps(
  step: WorkflowStepASTWithNamedNested,
): NamedWorkflowStep[][] {
  switch (step.tag) {
    case 'assign':
    case 'call':
    case 'next':
    case 'raise':
    case 'return':
    case 'jumptarget':
      return []

    case 'for':
    case 'steps':
      return [step.steps]

    case 'parallel':
      return nestedStepsParallel(step)

    case 'switch':
      return step.branches.map((x) => x.steps)

    case 'try':
      return nestedStepsTry(step)
  }
}

function nestedStepsParallel(
  step: ParallelStepASTNamed,
): NamedWorkflowStep[][] {
  const nested = []
  if (step.branches && step.branches.length > 0) {
    // return each branch as a separate child
    nested.push(...step.branches.map((x) => [x]))
  }
  if (step.forStep?.steps && step.forStep.steps.length > 0) {
    nested.push(step.forStep.steps)
  }

  return nested
}

function nestedStepsTry(step: TryStepASTNamed): NamedWorkflowStep[][] {
  const nested = []
  if (step.trySteps.length > 0) {
    nested.push(step.trySteps)
  }
  if (step.exceptSteps) {
    nested.push(step.exceptSteps)
  }

  return nested
}

/**
 * Returns an GCP Workflows object representation of a step.
 */
export function renderStep(
  step: WorkflowStepASTWithNamedNested,
): Record<string, unknown> {
  switch (step.tag) {
    case 'assign':
      return {
        assign: step.assignments.map(({ name, value }) => {
          return {
            [name.toString()]:
              expressionToLiteralValueOrLiteralExpression(value),
          }
        }),
        ...(step.next && { next: step.next }),
      }

    case 'call':
      return renderCallStep(step)

    case 'for':
      return {
        for: renderForBody(step),
      }

    case 'parallel':
      return {
        parallel: {
          ...(step.shared && { shared: step.shared }),
          ...(step.concurrenceLimit !== undefined && {
            concurrency_limit: step.concurrenceLimit,
          }),
          ...(step.exceptionPolicy !== undefined && {
            exception_policy: step.exceptionPolicy,
          }),
          ...(step.branches && { branches: renderSteps(step.branches) }),
          ...(step.forStep && { for: renderForBody(step.forStep) }),
        },
      }

    case 'next':
      return {
        next: step.target,
      }

    case 'raise':
      return {
        raise: expressionToLiteralValueOrLiteralExpression(step.value),
      }

    case 'return':
      return renderReturnStep(step)

    case 'steps':
      return {
        steps: renderSteps(step.steps),
      }

    case 'switch':
      return {
        switch: step.branches.map(renderSwitchCondition),
        ...(step.next && { next: step.next }),
      }

    case 'try':
      return renderTryStep(step)

    case 'jumptarget':
      return {}
  }
}

function renderSwitchCondition(
  cond: SwitchConditionAST<NamedWorkflowStep>,
): object {
  return {
    condition: expressionToLiteralValueOrLiteralExpression(cond.condition),
    ...(cond.steps.length > 0 && { steps: renderSteps(cond.steps) }),
    ...(cond.next && { next: cond.next }),
  }
}

function renderCallStep(step: CallStepAST): Record<string, unknown> {
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

function renderForBody(step: ForStepASTNamed): object {
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
  if (value === undefined || typeof value === 'number') {
    return value ?? null
  } else {
    return expressionToLiteralValueOrLiteralExpression(value)
  }
}

function renderReturnStep(step: ReturnStepAST): Record<string, unknown> {
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

function renderTryStep(step: TryStepASTNamed): Record<string, unknown> {
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

function renderSteps(steps: NamedWorkflowStep[]) {
  return steps.map((x) => {
    return { [x.name]: renderStep(x.step) }
  })
}
