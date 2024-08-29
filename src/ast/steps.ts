import { Expression, VariableName } from './expressions.js'
import { Subworkflow, WorkflowParameter } from './workflows.js'

export type StepName = string
export type VariableAssignment = readonly [VariableName, Expression]
export type WorkflowParameters = Record<VariableName, Expression>

export interface CustomRetryPolicy {
  predicate: string
  maxRetries: number
  backoff: {
    initialDelay: number
    maxDelay: number
    multiplier: number
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
    const steps = this.steps.map((step) => step.withStepNames(generate))

    return new Subworkflow(this.name, steps, this.params)
  }
}

/**
 * A workflow step before step names have been assigned.
 */
export interface WorkflowStepAST {
  readonly tag: string
  label: string | undefined

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep
  transformEpressions(
    transform: (ex: Expression) => [WorkflowStepAST[], Expression],
  ): WorkflowStepAST[]
}

/**
 * A workflow step after names have been generated for the nested steps.
 */
export interface WorkflowStepASTWithNamedNested {
  readonly tag: string

  render(): object
  nestedSteps(): NamedWorkflowStep[][]
  renameJumpTargets(
    replaceLabels: Map<StepName, StepName>,
  ): WorkflowStepASTWithNamedNested
  transformNestedSteps(
    transform: (steps: NamedWorkflowStep[]) => NamedWorkflowStep[],
  ): WorkflowStepASTWithNamedNested
}

export interface NamedWorkflowStep {
  name: StepName
  step: WorkflowStepASTWithNamedNested
}

// https://cloud.google.com/workflows/docs/reference/syntax/variables#assign-step
export class AssignStepAST
  implements WorkflowStepAST, WorkflowStepASTWithNamedNested
{
  readonly tag = 'assign'
  readonly assignments: VariableAssignment[]
  label: string | undefined

  constructor(assignments: VariableAssignment[]) {
    this.assignments = assignments
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    return {
      name: this.label ?? generate('assign'),
      step: this,
    }
  }

  render(): object {
    return {
      assign: this.assignments.map(([key, val]) => {
        return { [key]: val.toLiteralValueOrLiteralExpression() }
      }),
    }
  }

  nestedSteps(): NamedWorkflowStep[][] {
    return []
  }

  renameJumpTargets(): AssignStepAST {
    return this
  }

  transformNestedSteps(): AssignStepAST {
    return this
  }

  transformEpressions(
    transform: (ex: Expression) => [WorkflowStepAST[], Expression],
  ): WorkflowStepAST[] {
    if (this.assignments) {
      const newSteps: WorkflowStepAST[] = []
      const newAssignments = this.assignments.map(([name, ex]) => {
        const [steps2, ex2] = transform(ex)
        newSteps.push(...steps2)
        return [name, ex2] as const
      })
      const transformedAssign = new AssignStepAST(newAssignments)
      transformedAssign.label = this.label
      newSteps.push(transformedAssign)
      return newSteps
    } else {
      return [this]
    }
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/calls
export class CallStepAST
  implements WorkflowStepAST, WorkflowStepASTWithNamedNested
{
  readonly tag = 'call'
  readonly call: string
  readonly args?: WorkflowParameters
  readonly result?: VariableName
  label: string | undefined

  constructor(call: string, args?: WorkflowParameters, result?: VariableName) {
    this.call = call
    this.args = args
    this.result = result
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    return {
      name: this.label ?? generate(this.labelPrefix()),
      step: this,
    }
  }

  labelPrefix(): string {
    return 'call_' + this.call.replaceAll(/[^a-zA-Z0-9]/g, '_') + '_'
  }

  render(): object {
    let args:
      | Record<string, null | string | number | boolean | object>
      | undefined = undefined
    if (this.args) {
      args = Object.fromEntries(
        Object.entries(this.args).map(([k, v]) => {
          return [k, v.toLiteralValueOrLiteralExpression()]
        }),
      )
    }

    return {
      call: this.call,
      ...(args && { args }),
      ...(this.result && { result: this.result }),
    }
  }

  nestedSteps(): NamedWorkflowStep[][] {
    return []
  }

  renameJumpTargets(): CallStepAST {
    return this
  }

  transformNestedSteps(): CallStepAST {
    return this
  }

  transformEpressions(
    transform: (ex: Expression) => [WorkflowStepAST[], Expression],
  ): WorkflowStepAST[] {
    if (this.args) {
      const newSteps: WorkflowStepAST[] = []
      const newArgs = Object.fromEntries(
        Object.entries(this.args).map(([name, ex]) => {
          const [steps2, ex2] = transform(ex)
          newSteps.push(...steps2)
          return [name, ex2] as const
        }),
      )
      const transformedCall = new CallStepAST(this.call, newArgs, this.result)
      transformedCall.label = this.label
      newSteps.push(transformedCall)
      return newSteps
    } else {
      return [this]
    }
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/iteration
export class ForStepAST implements WorkflowStepAST {
  readonly tag = 'for'
  readonly steps: WorkflowStepAST[]
  readonly loopVariableName: VariableName
  readonly indexVariableName?: VariableName
  readonly listExpression: Expression
  readonly rangeStart?: number
  readonly rangeEnd?: number
  label: string | undefined

  constructor(
    steps: WorkflowStepAST[],
    loopVariableName: VariableName,
    listExpression: Expression,
    indexVariable?: VariableName,
    rangeStart?: number,
    rangeEnd?: number,
  ) {
    this.steps = steps
    this.loopVariableName = loopVariableName
    this.listExpression = listExpression
    this.indexVariableName = indexVariable
    this.rangeStart = rangeStart
    this.rangeEnd = rangeEnd
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    const namedSteps = this.steps.map((astStep) =>
      astStep.withStepNames(generate),
    )

    return {
      name: this.label ?? generate('for'),
      step: new ForStepASTNamed(
        namedSteps,
        this.loopVariableName,
        this.listExpression,
      ),
    }
  }

  transformEpressions(
    transform: (ex: Expression) => [WorkflowStepAST[], Expression],
  ): WorkflowStepAST[] {
    if (this.listExpression) {
      const [newSteps, newListExpression] = transform(this.listExpression)
      const newFor = new ForStepAST(
        this.steps,
        this.loopVariableName,
        newListExpression,
        this.indexVariableName,
        this.rangeStart,
        this.rangeEnd,
      )
      newFor.label = this.label
      newSteps.push(newFor)
      return newSteps
    } else {
      return [this]
    }
  }
}

export class ForStepASTNamed implements WorkflowStepASTWithNamedNested {
  readonly tag = 'for'
  readonly steps: NamedWorkflowStep[]
  readonly loopVariableName: VariableName
  readonly indexVariableName?: VariableName
  readonly listExpression?: Expression
  readonly rangeStart?: number
  readonly rangeEnd?: number

  constructor(
    steps: NamedWorkflowStep[],
    loopVariableName: VariableName,
    listExpression?: Expression,
    indexVariable?: VariableName,
    rangeStart?: number,
    rangeEnd?: number,
  ) {
    this.steps = steps
    this.loopVariableName = loopVariableName
    this.listExpression = listExpression
    this.indexVariableName = indexVariable
    this.rangeStart = rangeStart
    this.rangeEnd = rangeEnd
  }

  render(): object {
    return {
      for: this.renderBody(),
    }
  }

  renderBody(): object {
    let range: (number | undefined)[] | undefined
    let inValue: null | string | number | boolean | object | undefined
    if (typeof this.listExpression === 'undefined') {
      range = [this.rangeStart, this.rangeEnd]
      inValue = undefined
    } else {
      inValue = this.listExpression.toLiteralValueOrLiteralExpression()
      range = undefined
    }

    return {
      value: this.loopVariableName,
      ...(this.indexVariableName && { index: this.indexVariableName }),
      ...(inValue && { in: inValue }),
      ...(range && { range }),
      steps: renderSteps(this.steps),
    }
  }

  nestedSteps(): NamedWorkflowStep[][] {
    return [this.steps]
  }

  renameJumpTargets(replaceLabels: Map<StepName, StepName>): ForStepASTNamed {
    const transformedSteps = this.steps.map(({ name, step }) => ({
      name,
      step: step.renameJumpTargets(replaceLabels),
    }))
    return new ForStepASTNamed(
      transformedSteps,
      this.loopVariableName,
      this.listExpression,
      this.indexVariableName,
      this.rangeStart,
      this.rangeEnd,
    )
  }

  transformNestedSteps(
    transform: (steps: NamedWorkflowStep[]) => NamedWorkflowStep[],
  ): ForStepASTNamed {
    return new ForStepASTNamed(
      transform(this.steps),
      this.loopVariableName,
      this.listExpression,
      this.indexVariableName,
      this.rangeStart,
      this.rangeEnd,
    )
  }
}

export class NextStepAST
  implements WorkflowStepAST, WorkflowStepASTWithNamedNested
{
  readonly tag = 'next'
  readonly target: string
  label: string | undefined

  constructor(target: string) {
    this.target = target
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    return {
      name: this.label ?? generate('next'),
      step: this,
    }
  }

  render(): object {
    return {
      next: this.target,
    }
  }

  nestedSteps(): NamedWorkflowStep[][] {
    return []
  }

  renameJumpTargets(replaceLabels: Map<StepName, StepName>): NextStepAST {
    const newLabel = replaceLabels.get(this.target)
    if (newLabel) {
      return new NextStepAST(newLabel)
    } else {
      return this
    }
  }

  transformNestedSteps(): NextStepAST {
    return this
  }

  transformEpressions(): WorkflowStepAST[] {
    return [this]
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/parallel-steps
export class ParallelStepAST implements WorkflowStepAST {
  readonly tag = 'parallel'
  readonly steps: Record<StepName, StepsStepAST> | ForStepAST
  readonly shared?: VariableName[]
  readonly concurrencyLimit?: number
  readonly exceptionPolicy?: string
  label: string | undefined

  constructor(
    steps: Record<StepName, StepsStepAST> | ForStepAST,
    shared?: VariableName[],
    concurrencyLimit?: number,
    exceptionPolicy?: string,
  ) {
    this.steps = steps
    this.shared = shared
    this.concurrencyLimit = concurrencyLimit
    this.exceptionPolicy = exceptionPolicy
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    let steps: Record<StepName, StepsStepASTNamed> | ForStepASTNamed
    if (this.steps instanceof ForStepAST) {
      const forStep = this.steps.withStepNames(generate).step

      if (!(forStep instanceof ForStepASTNamed)) {
        throw new Error('Encountered an unexpected step')
      }

      steps = forStep
    } else {
      steps = Object.fromEntries(
        Object.entries(this.steps).map(([name, astStep]) => {
          const namedSteps = astStep.steps.map((x) => x.withStepNames(generate))
          return [name, new StepsStepASTNamed(namedSteps)]
        }),
      )
    }

    return {
      name: this.label ?? generate('parallel'),
      step: new ParallelStepASTNamed(
        steps,
        this.shared,
        this.concurrencyLimit,
        this.exceptionPolicy,
      ),
    }
  }

  transformEpressions(): WorkflowStepAST[] {
    return [this]
  }
}

export class ParallelStepASTNamed implements WorkflowStepASTWithNamedNested {
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

    if (steps instanceof ForStepASTNamed) {
      this.forStep = steps
    } else {
      this.branches = Object.entries(steps).map((x) => {
        return { name: x[0], step: x[1] }
      })
    }
  }

  render(): object {
    return {
      parallel: {
        ...(this.shared && { shared: this.shared }),
        ...(this.concurrenceLimit && {
          concurrency_limit: this.concurrenceLimit,
        }),
        ...(this.exceptionPolicy && { exception_policy: this.exceptionPolicy }),
        ...(this.branches && { branches: renderSteps(this.branches) }),
        ...(this.forStep && { for: this.forStep.renderBody() }),
      },
    }
  }

  nestedSteps(): NamedWorkflowStep[][] {
    const nested = []
    if (this.branches && this.branches.length > 0) {
      // return each branch as a separate child
      nested.push(...this.branches.map((x) => [x]))
    }
    if (this.forStep?.steps && this.forStep.steps.length > 0) {
      nested.push(this.forStep.steps)
    }

    return nested
  }

  renameJumpTargets(
    replaceLabels: Map<StepName, StepName>,
  ): ParallelStepASTNamed {
    let transformedSteps: Record<StepName, StepsStepASTNamed> | ForStepASTNamed
    if (this.branches) {
      transformedSteps = Object.fromEntries(
        this.branches.map(({ name, step }) => {
          const nestedSteps = step
            .nestedSteps()
            .flat()
            .map((x) => ({
              name: x.name,
              step: x.step.renameJumpTargets(replaceLabels),
            }))

          return [name, new StepsStepASTNamed(nestedSteps)]
        }),
      )
    } else if (this.forStep) {
      transformedSteps = this.forStep.renameJumpTargets(replaceLabels)
    } else {
      // should not be reached
      transformedSteps = {}
    }

    return new ParallelStepASTNamed(
      transformedSteps,
      this.shared,
      this.concurrenceLimit,
      this.exceptionPolicy,
    )
  }

  transformNestedSteps(
    transform: (steps: NamedWorkflowStep[]) => NamedWorkflowStep[],
  ): ParallelStepASTNamed {
    let transformedSteps: Record<StepName, StepsStepASTNamed> | ForStepASTNamed
    if (this.branches) {
      transformedSteps = Object.fromEntries(
        this.branches.map((x) => {
          return [
            x.name,
            new StepsStepASTNamed(transform(x.step.nestedSteps().flat())),
          ]
        }),
      )
    } else if (this.forStep) {
      transformedSteps = this.forStep.transformNestedSteps(transform)
    } else {
      // should not be reached
      transformedSteps = {}
    }

    return new ParallelStepASTNamed(
      transformedSteps,
      this.shared,
      this.concurrenceLimit,
      this.exceptionPolicy,
    )
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/raising-errors
export class RaiseStepAST
  implements WorkflowStepAST, WorkflowStepASTWithNamedNested
{
  readonly tag = 'raise'
  readonly value: Expression
  label: string | undefined

  constructor(value: Expression) {
    this.value = value
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    return {
      name: this.label ?? generate('raise'),
      step: this,
    }
  }

  render(): object {
    return {
      raise: this.value.toLiteralValueOrLiteralExpression(),
    }
  }

  nestedSteps(): NamedWorkflowStep[][] {
    return []
  }

  renameJumpTargets(): RaiseStepAST {
    return this
  }

  transformNestedSteps(): RaiseStepAST {
    return this
  }

  transformEpressions(
    transform: (ex: Expression) => [WorkflowStepAST[], Expression],
  ): WorkflowStepAST[] {
    if (this.value) {
      const [newSteps, newEx] = transform(this.value)
      const newRaise = new RaiseStepAST(newEx)
      newRaise.label = this.label
      newSteps.push(newRaise)
      return newSteps
    } else {
      return [this]
    }
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/completing
export class ReturnStepAST
  implements WorkflowStepAST, WorkflowStepASTWithNamedNested
{
  readonly tag = 'return'
  readonly value: Expression | undefined
  label: string | undefined

  constructor(value: Expression | undefined) {
    this.value = value
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    return {
      name: this.label ?? generate('return'),
      step: this,
    }
  }

  render(): object {
    if (this.value) {
      return {
        return: this.value.toLiteralValueOrLiteralExpression(),
      }
    } else {
      return {
        next: 'end',
      }
    }
  }

  nestedSteps(): NamedWorkflowStep[][] {
    return []
  }

  renameJumpTargets(): ReturnStepAST {
    return this
  }

  transformNestedSteps(): ReturnStepAST {
    return this
  }

  transformEpressions(
    transform: (ex: Expression) => [WorkflowStepAST[], Expression],
  ): WorkflowStepAST[] {
    if (this.value) {
      const [newSteps, newEx] = transform(this.value)
      const newReturn = new ReturnStepAST(newEx)
      newReturn.label = this.label
      newSteps.push(newReturn)
      return newSteps
    } else {
      return [this]
    }
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/steps#embedded-steps
export class StepsStepAST implements WorkflowStepAST {
  readonly tag = 'steps'
  readonly steps: WorkflowStepAST[]
  label: string | undefined

  constructor(steps: WorkflowStepAST[]) {
    this.steps = steps
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    const namedSteps = this.steps.map((astStep) =>
      astStep.withStepNames(generate),
    )

    return {
      name: this.label ?? generate('steps'),
      step: new StepsStepASTNamed(namedSteps),
    }
  }

  transformEpressions(): WorkflowStepAST[] {
    return [this]
  }
}

export class StepsStepASTNamed implements WorkflowStepASTWithNamedNested {
  readonly tag = 'steps'
  readonly steps: NamedWorkflowStep[]

  constructor(steps: NamedWorkflowStep[]) {
    this.steps = steps
  }

  render(): object {
    return {
      steps: renderSteps(this.steps),
    }
  }

  nestedSteps(): NamedWorkflowStep[][] {
    return [this.steps]
  }

  renameJumpTargets(replaceLabels: Map<StepName, StepName>): StepsStepASTNamed {
    const transformedSteps = this.steps.map(({ name, step }) => ({
      name,
      step: step.renameJumpTargets(replaceLabels),
    }))

    return new StepsStepASTNamed(transformedSteps)
  }

  transformNestedSteps(
    transform: (steps: NamedWorkflowStep[]) => NamedWorkflowStep[],
  ): StepsStepASTNamed {
    return new StepsStepASTNamed(transform(this.steps))
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/conditions
export class SwitchStepAST implements WorkflowStepAST {
  readonly tag = 'switch'
  readonly branches: SwitchConditionAST[]
  label: string | undefined

  constructor(branches: SwitchConditionAST[]) {
    this.branches = branches
  }

  flattenPlainNextConditions(): SwitchStepAST {
    const transformedBranches = this.branches.map((cond) => {
      if (
        !cond.next &&
        cond.steps.length === 1 &&
        cond.steps[0] instanceof NextStepAST
      ) {
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

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    const namedBranches = this.branches.map(
      (branch) =>
        new SwitchConditionASTNamed(
          branch.condition,
          branch.steps.map((astStep) => astStep.withStepNames(generate)),
          branch.next,
        ),
    )

    return {
      name: this.label ?? generate('switch'),
      step: new SwitchStepASTNamed(namedBranches),
    }
  }

  transformEpressions(
    transform: (ex: Expression) => [WorkflowStepAST[], Expression],
  ): WorkflowStepAST[] {
    const newSteps: WorkflowStepAST[] = []
    const newBranches = this.branches.map((cond) => {
      const [steps2, ex2] = transform(cond.condition)
      newSteps.push(...steps2)

      return {
        condition: ex2,
        steps: cond.steps,
        next: cond.next,
      }
    })

    const newStep = new SwitchStepAST(newBranches)
    newStep.label = this.label
    newSteps.push(newStep)
    return newSteps
  }
}

export class SwitchStepASTNamed implements WorkflowStepASTWithNamedNested {
  readonly tag = 'switch'
  readonly conditions: SwitchConditionASTNamed[]
  readonly next?: StepName

  constructor(conditions: SwitchConditionASTNamed[], next?: StepName) {
    this.conditions = conditions
    this.next = next
  }

  render(): object {
    return {
      switch: this.conditions.map((cond) => cond.render()),
      ...(this.next && { next: this.next }),
    }
  }

  nestedSteps(): NamedWorkflowStep[][] {
    return this.conditions.map((x) => x.steps)
  }

  renameJumpTargets(
    replaceLabels: Map<StepName, StepName>,
  ): SwitchStepASTNamed {
    let updatedNext: StepName | undefined = undefined
    if (this.next) {
      updatedNext = replaceLabels.get(this.next) ?? this.next
    }

    const updatedConditions = this.conditions.map((cond) => {
      let updatedCondNext: StepName | undefined = undefined
      if (cond.next) {
        updatedCondNext = replaceLabels.get(cond.next) ?? cond.next
      }

      const updatedCondSteps = cond.steps.map((step) => ({
        name: step.name,
        step: step.step.renameJumpTargets(replaceLabels),
      }))

      return new SwitchConditionASTNamed(
        cond.condition,
        updatedCondSteps,
        updatedCondNext,
      )
    })

    return new SwitchStepASTNamed(updatedConditions, updatedNext)
  }

  transformNestedSteps(
    transform: (steps: NamedWorkflowStep[]) => NamedWorkflowStep[],
  ): SwitchStepASTNamed {
    const transformedConditions = this.conditions.map((cond) => {
      return new SwitchConditionASTNamed(
        cond.condition,
        transform(cond.steps),
        cond.next,
      )
    })
    return new SwitchStepASTNamed(transformedConditions, this.next)
  }
}

export interface SwitchConditionAST {
  readonly condition: Expression
  readonly steps: WorkflowStepAST[]
  readonly next?: StepName
}

export class SwitchConditionASTNamed {
  readonly condition: Expression
  readonly steps: NamedWorkflowStep[]
  readonly next?: StepName

  constructor(
    condition: Expression,
    steps: NamedWorkflowStep[],
    next?: StepName,
  ) {
    this.condition = condition
    this.steps = steps
    this.next = next
  }

  render(): object {
    return {
      condition: this.condition.toLiteralValueOrLiteralExpression(),
      ...(this.steps.length > 0 && { steps: renderSteps(this.steps) }),
      ...(this.next && { next: this.next }),
    }
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/catching-errors
export class TryStepAST implements WorkflowStepAST {
  readonly tag = 'try'
  readonly trySteps: WorkflowStepAST[]
  readonly exceptSteps: WorkflowStepAST[]
  readonly retryPolicy?: string | CustomRetryPolicy
  readonly errorMap?: VariableName
  label: string | undefined

  constructor(
    trySteps: WorkflowStepAST[],
    exceptSteps: WorkflowStepAST[],
    retryPolicy?: string | CustomRetryPolicy,
    errorMap?: VariableName,
  ) {
    this.trySteps = trySteps
    this.exceptSteps = exceptSteps
    this.retryPolicy = retryPolicy
    this.errorMap = errorMap
  }

  withStepNames(generate: (prefix: string) => string): NamedWorkflowStep {
    const namedTrySteps = this.trySteps.map((astStep) =>
      astStep.withStepNames(generate),
    )
    const namedExceptSteps = this.exceptSteps.map((astStep) =>
      astStep.withStepNames(generate),
    )

    return {
      name: this.label ?? generate('try'),
      step: new TryStepASTNamed(
        namedTrySteps,
        namedExceptSteps,
        this.retryPolicy,
        this.errorMap,
      ),
    }
  }

  transformEpressions(): WorkflowStepAST[] {
    return [this]
  }
}

export class TryStepASTNamed implements WorkflowStepASTWithNamedNested {
  readonly tag = 'try'
  readonly retryPolicy?: string | CustomRetryPolicy
  readonly errorMap?: VariableName
  // Steps in the try block
  readonly trySteps: NamedWorkflowStep[]
  // Steps in the except block
  readonly exceptSteps: NamedWorkflowStep[]

  constructor(
    steps: NamedWorkflowStep[],
    exceptSteps: NamedWorkflowStep[],
    retryPolicy?: string | CustomRetryPolicy,
    errorMap?: VariableName,
  ) {
    this.trySteps = steps
    this.retryPolicy = retryPolicy
    this.errorMap = errorMap
    this.exceptSteps = exceptSteps
  }

  render(): object {
    let retry
    if (typeof this.retryPolicy === 'undefined') {
      retry = undefined
    } else if (typeof this.retryPolicy === 'string') {
      retry = `\${${this.retryPolicy}}`
    } else {
      const predicateName = this.retryPolicy.predicate
      retry = {
        predicate: `\${${predicateName}}`,
        max_retries: this.retryPolicy.maxRetries,
        backoff: {
          initial_delay: this.retryPolicy.backoff.initialDelay,
          max_delay: this.retryPolicy.backoff.maxDelay,
          multiplier: this.retryPolicy.backoff.multiplier,
        },
      }
    }

    let except
    if (this.exceptSteps.length > 0) {
      except = {
        as: this.errorMap,
        steps: renderSteps(this.exceptSteps),
      }
    } else {
      except = undefined
    }

    return {
      try: {
        steps: renderSteps(this.trySteps),
      },
      ...(retry && { retry }),
      ...(except && { except }),
    }
  }

  nestedSteps(): NamedWorkflowStep[][] {
    const nested = []
    if (this.trySteps.length > 0) {
      nested.push(this.trySteps)
    }
    if (this.exceptSteps.length > 0) {
      nested.push(this.exceptSteps)
    }
    return nested
  }

  renameJumpTargets(replaceLabels: Map<StepName, StepName>): TryStepASTNamed {
    const transformedTrySteps = this.trySteps.map(({ name, step }) => ({
      name,
      step: step.renameJumpTargets(replaceLabels),
    }))
    const transformedExceptSteps = this.exceptSteps.map(({ name, step }) => ({
      name,
      step: step.renameJumpTargets(replaceLabels),
    }))

    return new TryStepASTNamed(
      transformedTrySteps,
      transformedExceptSteps,
      this.retryPolicy,
      this.errorMap,
    )
  }

  transformNestedSteps(
    transform: (steps: NamedWorkflowStep[]) => NamedWorkflowStep[],
  ): TryStepASTNamed {
    return new TryStepASTNamed(
      transform(this.trySteps),
      transform(this.exceptSteps),
      this.retryPolicy,
      this.errorMap,
    )
  }
}

function renderSteps(steps: NamedWorkflowStep[]) {
  return steps.map((x) => {
    return { [x.name]: x.step.render() }
  })
}

// Internal step that represents a potential jump target.
// This can be ued as a placeholder when the actual target step is not yet known.
// JumpTargetAST is removed before transpiling to workflows YAML.
export class JumpTargetAST
  implements WorkflowStepAST, WorkflowStepASTWithNamedNested
{
  readonly tag: string = 'jumptarget'
  readonly label: string

  constructor() {
    this.label = `jumptarget_${Math.floor(Math.random() * 2 ** 32).toString(16)}`
  }

  render(): object {
    return {}
  }

  nestedSteps(): NamedWorkflowStep[][] {
    return []
  }

  renameJumpTargets(): JumpTargetAST {
    return this
  }

  transformNestedSteps(): JumpTargetAST {
    return this
  }

  withStepNames(): NamedWorkflowStep {
    return {
      name: this.label,
      step: this,
    }
  }

  transformEpressions(): WorkflowStepAST[] {
    return [this]
  }
}
