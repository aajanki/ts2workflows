import {
  JumpTargetAST,
  NamedWorkflowStep,
  StepName,
  WorkflowAST,
  nestedSteps,
  renameJumpTargets,
  transformNestedSteps,
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
  const stepNameGenerator = new StepNameGenerator()
  const subworkflows = ast.subworkflows
    .map((subworkflow) => {
      return subworkflow.withStepNames((x) => stepNameGenerator.generate(x))
    })
    .map(fixJumpLabels)

  return new WorkflowApp(subworkflows)
}

function fixJumpLabels(subworkflow: Subworkflow): Subworkflow {
  const jumpTargetLabels = collectActualJumpTargets(subworkflow)
  const stepsWithoutJumpTargetNodes = removeJumpTargetNodesSteps(
    subworkflow.steps,
  )
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

function removeJumpTargetNodesSteps(
  steps: NamedWorkflowStep[],
): NamedWorkflowStep[] {
  return steps
    .filter((x) => x.step.tag !== 'jumptarget')
    .map((namedStep) => {
      return {
        name: namedStep.name,
        step: transformNestedSteps(namedStep.step, removeJumpTargetNodesSteps),
      }
    })
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
