import {
  AssignStepAST,
  ForStepASTNamed,
  NamedWorkflowStep,
  NextStepAST,
  ParallelIterationStepASTNamed,
  ParallelStepASTNamed,
  StepName,
  SwitchStepASTNamed,
  TryStepASTNamed,
  WorkflowAST,
  WorkflowStepASTWithNamedNested,
  nestedSteps,
} from './steps.js'
import { Subworkflow, WorkflowApp } from './workflows.js'

interface JumpStackElement {
  namedStep: NamedWorkflowStep
  nestingLevel: number
  isLastInBlock: boolean
}

export class StepNameGenerator {
  private counters: Map<string, number>

  constructor() {
    this.counters = new Map<string, number>()
  }

  generate(prefix: string): string {
    const i = this.counters.get(prefix) ?? 1
    this.counters.set(prefix, i + 1)

    return `${prefix}${i}`
  }
}

export function generateStepNames(ast: WorkflowAST): WorkflowApp {
  const subworkflows = ast.subworkflows
    .map((subworkflow) => {
      const stepNameGenerator = new StepNameGenerator()
      return subworkflow.withStepNames((x) => stepNameGenerator.generate(x))
    })
    .map(fixJumpLabels)

  return new WorkflowApp(subworkflows)
}

function fixJumpLabels(subworkflow: Subworkflow): Subworkflow {
  const jumpTargetLabels = collectActualJumpTargets(subworkflow)
  const stepsWithoutJumpTargetNodes = removeJumpTargetSteps(subworkflow.steps)
  const relabeledSteps = relabelNextLabels(
    stepsWithoutJumpTargetNodes,
    jumpTargetLabels,
  )

  return new Subworkflow(subworkflow.name, relabeledSteps, subworkflow.params)
}

/**
 * Find a mapping from jump target labels to step names.
 *
 * Iterate over all steps in the workflow. For JumpTargetAST nodes, find the
 * next node that is not a JumpTargetAST, save its name as the real jump taget
 * name.
 */
function collectActualJumpTargets(
  subworkflow: Subworkflow,
): Map<StepName, StepName> {
  const replacements = new Map<StepName, StepName>()

  // The processing is done iteratively with an explicit stack because
  // nextNonJumpTargetNode() needs the stack. Note the order of steps on the
  // stack: the first step is the last element of the stack.
  const stack: JumpStackElement[] = []
  stack.push(...stepsToJumpStackElements(subworkflow.steps, 0))

  while (stack.length > 0) {
    // Do not yet pop in case nextNonJumpTargetNode needs to search the stack
    const { namedStep, nestingLevel } = stack[stack.length - 1]

    if (namedStep.step.tag === 'jumptarget') {
      const currentLabel = namedStep.step.label
      const target = nextNonJumpTargetNode(stack)
      const targetName = target ? target.name : 'end'
      replacements.set(currentLabel, targetName)
    }

    // Now nextNonJumpTargetNode has been executed and it's safe to pop the
    // current element from the stack.
    stack.pop()

    const children = nestedSteps(namedStep.step).map((x) =>
      stepsToJumpStackElements(x, nestingLevel + 1),
    )
    children.reverse()
    children.forEach((children) => {
      stack.push(...children)
    })
  }

  return replacements
}

function stepsToJumpStackElements(
  steps: NamedWorkflowStep[],
  nestingLevel: number,
): JumpStackElement[] {
  const block = steps.map((step, i) => ({
    namedStep: step,
    nestingLevel,
    isLastInBlock: i === steps.length - 1,
  }))
  block.reverse()
  return block
}

function nextNonJumpTargetNode(
  stack: readonly JumpStackElement[],
): NamedWorkflowStep | undefined {
  if (stack.length <= 0) {
    return undefined
  }

  let nestingLevel = stack[stack.length - 1].nestingLevel
  while (nestingLevel >= 0) {
    // Consider only the steps in the current code block (= the same nesting
    // level, taking steps until isLastInBlock)
    let endOfBlockIndex = stack.findLastIndex(
      (x) => x.nestingLevel === nestingLevel && x.isLastInBlock,
    )
    if (endOfBlockIndex < 0) {
      // should not be reached
      endOfBlockIndex = stack.findLastIndex(
        (x) => x.nestingLevel <= nestingLevel,
      )
      if (endOfBlockIndex < 0) {
        endOfBlockIndex = 0
      }
    }

    const firstNonJumpTarget = stack
      .slice(endOfBlockIndex)
      .findLast(
        (x) =>
          x.nestingLevel === nestingLevel &&
          x.namedStep.step.tag !== 'jumptarget',
      )
    if (firstNonJumpTarget) {
      return firstNonJumpTarget.namedStep
    }

    nestingLevel--
  }

  return undefined
}

function removeJumpTargetSteps(
  steps: NamedWorkflowStep[],
): NamedWorkflowStep[] {
  return steps
    .filter((x) => x.step.tag !== 'jumptarget')
    .map(({ name, step }) => ({
      name,
      step: removeJumpTargetRecurse(step),
    }))
}

function removeJumpTargetRecurse(
  step: WorkflowStepASTWithNamedNested,
): WorkflowStepASTWithNamedNested {
  switch (step.tag) {
    case 'assign':
    case 'call':
    case 'next':
    case 'raise':
    case 'return':
    case 'jumptarget':
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
      return new TryStepASTNamed(
        removeJumpTargetSteps(step.trySteps),
        step.exceptSteps !== undefined
          ? removeJumpTargetSteps(step.exceptSteps)
          : undefined,
        step.retryPolicy,
        step.errorMap,
      )
  }
}

function removeJumpTargetsFor(step: ForStepASTNamed): ForStepASTNamed {
  return new ForStepASTNamed(
    removeJumpTargetSteps(step.steps),
    step.loopVariableName,
    step.listExpression,
    step.indexVariableName,
    step.rangeStart,
    step.rangeEnd,
  )
}

function removeJumpTargetsParallel(
  step: ParallelStepASTNamed,
): ParallelStepASTNamed {
  const branches = step.branches.map(({ name, steps: nestedSteps }) => ({
    name,
    steps: removeJumpTargetSteps(nestedSteps),
  }))

  return new ParallelStepASTNamed(
    branches,
    step.shared,
    step.concurrenceLimit,
    step.exceptionPolicy,
  )
}

function removeJumpTargetsParallelIteration(
  step: ParallelIterationStepASTNamed,
): ParallelIterationStepASTNamed {
  return new ParallelIterationStepASTNamed(
    removeJumpTargetsFor(step.forStep),
    step.shared,
    step.concurrenceLimit,
    step.exceptionPolicy,
  )
}

function removeJumpTargetsSwitch(step: SwitchStepASTNamed): SwitchStepASTNamed {
  const transformedConditions = step.branches.map((cond) => {
    return {
      condition: cond.condition,
      steps: removeJumpTargetSteps(cond.steps),
      next: cond.next,
    }
  })
  return new SwitchStepASTNamed(transformedConditions, step.next)
}

function relabelNextLabels(
  steps: NamedWorkflowStep[],
  replacements: Map<StepName, StepName>,
): NamedWorkflowStep[] {
  return steps.map((step) => ({
    name: step.name,
    step: renameJumpTargets(step.step, replacements),
  }))
}

/**
 * Renames a copy of a step with jump targets renamed according to replaceLabels map.
 */
function renameJumpTargets(
  step: WorkflowStepASTWithNamedNested,
  replaceLabels: Map<StepName, StepName>,
): WorkflowStepASTWithNamedNested {
  switch (step.tag) {
    case 'call':
    case 'raise':
    case 'return':
    case 'jumptarget':
      return step

    case 'assign':
      return renameJumpTargetsAssign(step, replaceLabels)

    case 'next':
      return renameJumpTargetsNext(step, replaceLabels)

    case 'for':
      return renameJumpTargetsFor(step, replaceLabels)

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
  step: AssignStepAST,
  replaceLabels: Map<StepName, StepName>,
): AssignStepAST {
  if (step.next) {
    const newLabel = replaceLabels.get(step.next)

    if (newLabel) {
      return step.withNext(newLabel)
    }
  }

  return step
}

function renameJumpTargetsFor(
  step: ForStepASTNamed,
  replaceLabels: Map<StepName, StepName>,
): ForStepASTNamed {
  const transformedSteps = step.steps.map(({ name, step: nested }) => ({
    name,
    step: renameJumpTargets(nested, replaceLabels),
  }))

  return new ForStepASTNamed(
    transformedSteps,
    step.loopVariableName,
    step.listExpression,
    step.indexVariableName,
    step.rangeStart,
    step.rangeEnd,
  )
}

function renameJumpTargetsNext(
  step: NextStepAST,
  replaceLabels: Map<StepName, StepName>,
): NextStepAST {
  const newLabel = replaceLabels.get(step.target)
  if (newLabel) {
    return new NextStepAST(newLabel)
  } else {
    return step
  }
}

function renameJumpTargetsParallel(
  step: ParallelStepASTNamed,
  replaceLabels: Map<StepName, StepName>,
): ParallelStepASTNamed {
  const branches = step.branches.map(({ name, steps: nestedSteps }) => ({
    name,
    steps: nestedSteps.map(({ name, step: s }) => ({
      name,
      step: renameJumpTargets(s, replaceLabels),
    })),
  }))

  return new ParallelStepASTNamed(
    branches,
    step.shared,
    step.concurrenceLimit,
    step.exceptionPolicy,
  )
}

function renameJumpTargetsParallelIteration(
  step: ParallelIterationStepASTNamed,
  replaceLabels: Map<StepName, StepName>,
): ParallelIterationStepASTNamed {
  return new ParallelIterationStepASTNamed(
    renameJumpTargetsFor(step.forStep, replaceLabels),
    step.shared,
    step.concurrenceLimit,
    step.exceptionPolicy,
  )
}

function renameJumpTargetsSwitch(
  step: SwitchStepASTNamed,
  replaceLabels: Map<StepName, StepName>,
): SwitchStepASTNamed {
  let updatedNext: StepName | undefined = undefined
  if (step.next) {
    updatedNext = replaceLabels.get(step.next) ?? step.next
  }

  const updatedConditions = step.branches.map((cond) => {
    let updatedCondNext: StepName | undefined = undefined
    if (cond.next) {
      updatedCondNext = replaceLabels.get(cond.next) ?? cond.next
    }

    const updatedCondSteps = cond.steps.map((nested) => ({
      name: nested.name,
      step: renameJumpTargets(nested.step, replaceLabels),
    }))

    return {
      condition: cond.condition,
      steps: updatedCondSteps,
      next: updatedCondNext,
    }
  })

  return new SwitchStepASTNamed(updatedConditions, updatedNext)
}

function renameJumpTargetsTry(
  step: TryStepASTNamed,
  replaceLabels: Map<StepName, StepName>,
): TryStepASTNamed {
  const transformedTrySteps = step.trySteps.map(({ name, step: nested }) => ({
    name,
    step: renameJumpTargets(nested, replaceLabels),
  }))
  const transformedExceptSteps = step.exceptSteps?.map(
    ({ name, step: nested }) => ({
      name,
      step: renameJumpTargets(nested, replaceLabels),
    }),
  )

  return new TryStepASTNamed(
    transformedTrySteps,
    transformedExceptSteps,
    step.retryPolicy,
    step.errorMap,
  )
}
