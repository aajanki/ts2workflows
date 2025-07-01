import * as R from 'ramda'
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
  constructor(
    private readonly name: string,
    private readonly steps: WorkflowStepAST[],
    private readonly params?: WorkflowParameter[],
  ) {}

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
  | ParallelIterationStepAST
  | RaiseStepAST
  | ReturnStepAST
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
  | ParallelIterationStepASTNamed
  | RaiseStepAST
  | ReturnStepAST
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

  constructor(
    public readonly assignments: VariableAssignment[],
    public readonly next?: string,
    public readonly label?: string,
  ) {}

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

  constructor(
    public readonly call: string,
    public readonly args?: WorkflowParameters,
    public readonly result?: VariableName,
    public readonly label?: string,
  ) {}

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

  constructor(
    public readonly steps: WorkflowStepAST[],
    public readonly loopVariableName: VariableName,
    public readonly listExpression: Expression,
    public readonly indexVariableName?: VariableName,
    public readonly label?: string,
  ) {}

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

  constructor(
    public readonly steps: WorkflowStepAST[],
    public readonly loopVariableName: VariableName,
    public readonly rangeStart: number | Expression,
    public readonly rangeEnd: number | Expression,
    public readonly label?: string,
  ) {}

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

  constructor(
    public readonly steps: NamedWorkflowStep[],
    public readonly loopVariableName: VariableName,
    public readonly listExpression?: Expression,
    public readonly indexVariableName?: VariableName,
    public readonly rangeStart?: number | Expression,
    public readonly rangeEnd?: number | Expression,
  ) {}
}

export class NextStepAST {
  readonly tag = 'next'

  constructor(
    public readonly target: string,
    public readonly label?: string,
  ) {}

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

  constructor(
    public readonly branches: ParallelBranch<WorkflowStepAST>[],
    public readonly shared?: VariableName[],
    public readonly concurrencyLimit?: number,
    public readonly exceptionPolicy?: string,
    public readonly label?: string,
  ) {}

  withLabel(newLabel?: string): ParallelStepAST {
    return new ParallelStepAST(
      this.branches,
      this.shared,
      this.concurrencyLimit,
      this.exceptionPolicy,
      newLabel,
    )
  }

  applyNestedSteps(
    fn: (steps: WorkflowStepAST[]) => WorkflowStepAST[],
  ): ParallelStepAST {
    const transformedSteps = this.branches.map(({ name, steps }) => ({
      name,
      steps: steps.map((s) => s.applyNestedSteps(fn)),
    }))

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

  constructor(
    public readonly branches: ParallelBranch<NamedWorkflowStep>[],
    public readonly shared?: VariableName[],
    public readonly concurrenceLimit?: number,
    public readonly exceptionPolicy?: string,
  ) {}
}

export interface ParallelBranch<T extends WorkflowStepAST | NamedWorkflowStep> {
  readonly name: StepName
  readonly steps: T[]
}

// https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps#parallel-iteration
export class ParallelIterationStepAST {
  readonly tag = 'parallel-for'

  constructor(
    public readonly forStep: ForStepAST,
    public readonly shared?: VariableName[],
    public readonly concurrencyLimit?: number,
    public readonly exceptionPolicy?: string,
    public readonly label?: string,
  ) {}

  withLabel(newLabel?: string): ParallelIterationStepAST {
    return new ParallelIterationStepAST(
      this.forStep,
      this.shared,
      this.concurrencyLimit,
      this.exceptionPolicy,
      newLabel,
    )
  }

  applyNestedSteps(
    fn: (steps: WorkflowStepAST[]) => WorkflowStepAST[],
  ): ParallelIterationStepAST {
    return new ParallelIterationStepAST(
      this.forStep.applyNestedSteps(fn),
      this.shared,
      this.concurrencyLimit,
      this.exceptionPolicy,
      this.label,
    )
  }
}

export class ParallelIterationStepASTNamed {
  readonly tag = 'parallel-for'

  constructor(
    public readonly forStep: ForStepASTNamed,
    public readonly shared?: VariableName[],
    public readonly concurrencyLimit?: number,
    public readonly exceptionPolicy?: string,
  ) {}
}

// https://cloud.google.com/workflows/docs/reference/syntax/raising-errors
export class RaiseStepAST {
  readonly tag = 'raise'

  constructor(
    public readonly value: Expression,
    public readonly label?: string,
  ) {}

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

  constructor(
    public readonly value: Expression | undefined,
    public readonly label?: string,
  ) {}

  withLabel(newLabel?: string): ReturnStepAST {
    return new ReturnStepAST(this.value, newLabel)
  }

  applyNestedSteps(): ReturnStepAST {
    return this
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/conditions
export class SwitchStepAST {
  readonly tag = 'switch'

  constructor(
    public readonly branches: SwitchConditionAST<WorkflowStepAST>[],
    public readonly label?: string,
  ) {}

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

  constructor(
    public readonly branches: SwitchConditionAST<NamedWorkflowStep>[],
    public readonly next?: StepName,
  ) {}
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

  constructor(
    public readonly trySteps: WorkflowStepAST[],
    public readonly exceptSteps?: WorkflowStepAST[],
    public readonly retryPolicy?: string | CustomRetryPolicy,
    public readonly errorMap?: VariableName,
    public readonly label?: string,
  ) {}

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

  constructor(
    public readonly trySteps: NamedWorkflowStep[],
    public readonly exceptSteps?: NamedWorkflowStep[],
    public readonly retryPolicy?: string | CustomRetryPolicy,
    public readonly errorMap?: VariableName,
  ) {}
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

    case 'parallel-for':
      return namedStepsParallelIteration(step, generateName)

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
): NamedWorkflowStep {
  const mainLabel = step.label ?? generateName('parallel')
  const transformed = step.branches.map(({ name, steps: nestedSteps }) => ({
    name,
    steps: nestedSteps.map((x) => namedSteps(x, generateName)),
  }))

  return {
    name: mainLabel,
    step: new ParallelStepASTNamed(
      transformed,
      step.shared,
      step.concurrencyLimit,
      step.exceptionPolicy,
    ),
  }
}

function namedStepsParallelIteration(
  step: ParallelIterationStepAST,
  generateName: (prefix: string) => string,
): NamedWorkflowStep {
  const mainLabel = step.label ?? generateName('parallel')
  const forStep = new ForStepASTNamed(
    step.forStep.steps.map((nestedStep) =>
      namedSteps(nestedStep, generateName),
    ),
    step.forStep.loopVariableName,
    step.forStep.listExpression,
    step.forStep.indexVariableName,
  )

  return {
    name: mainLabel,
    step: new ParallelIterationStepASTNamed(
      forStep,
      step.shared,
      step.concurrencyLimit,
      step.exceptionPolicy,
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
): NamedWorkflowStep {
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
      return [step.steps]

    case 'parallel':
      return [
        step.branches.flatMap(({ steps }) => {
          return steps
        }),
      ]

    case 'parallel-for':
      return [step.forStep.steps]

    case 'switch':
      return step.branches.map((x) => x.steps)

    case 'try':
      return nestedStepsTry(step)
  }
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
        ...(step.next !== undefined && { next: step.next }),
      }

    case 'call':
      return renderCallStep(step)

    case 'for':
      return {
        for: renderForBody(step),
      }

    case 'parallel':
      return renderParallelStep(step)

    case 'parallel-for':
      return renderParallelIterationStep(step)

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

    case 'switch':
      return {
        switch: step.branches.map(renderSwitchCondition),
        ...(step.next !== undefined && { next: step.next }),
      }

    case 'try':
      return renderTryStep(step)

    case 'jumptarget':
      return {}
  }
}

function renderParallelStep(
  step: ParallelStepASTNamed,
): Record<string, unknown> {
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
      ...(step.concurrenceLimit !== undefined && {
        concurrency_limit: step.concurrenceLimit,
      }),
      ...(step.exceptionPolicy !== undefined && {
        exception_policy: step.exceptionPolicy,
      }),
    },
  }
}

function renderParallelIterationStep(
  step: ParallelIterationStepASTNamed,
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

function renderSwitchCondition(
  cond: SwitchConditionAST<NamedWorkflowStep>,
): object {
  const includeSteps = cond.steps.length > 0 || cond.next === undefined
  return {
    condition: expressionToLiteralValueOrLiteralExpression(cond.condition),
    ...(includeSteps && { steps: renderSteps(cond.steps) }),
    ...(cond.next !== undefined && { next: cond.next }),
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
  if (value === undefined) {
    return null
  } else if (typeof value === 'number') {
    return value
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
