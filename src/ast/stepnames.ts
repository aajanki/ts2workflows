import {
  JumpTargetAST,
  NamedWorkflowStep,
  StepName,
  WorkflowAST,
} from './steps.js'
import { Subworkflow, WorkflowApp } from './workflows.js'

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

function collectActualJumpTargets(
  subworkflow: Subworkflow,
): Map<StepName, StepName> {
  let currentLabels: StepName[] = []
  const replacements = new Map<StepName, StepName>()

  // fixme: this does not work for steps that have multiple children blocks
  for (const { name, step } of subworkflow.iterateStepsDepthFirst()) {
    if (step instanceof JumpTargetAST) {
      // Collecting multiple successive JumpTargets into a list so that we can
      // link them all to the following non-JumpTarget node
      currentLabels.push(step.label)
    } else if (currentLabels.length > 0) {
      currentLabels.forEach((label) => {
        replacements.set(label, name)
      })

      currentLabels = []
    }
  }

  currentLabels.forEach((label) => {
    replacements.set(label, 'end')
  })

  return replacements
}

function removeJumpTargetNodesSteps(
  steps: NamedWorkflowStep[],
): NamedWorkflowStep[] {
  return steps
    .filter((x) => x.step.tag !== 'jumptarget')
    .map((namedStep) => {
      return {
        name: namedStep.name,
        step: namedStep.step.transformNestedSteps(removeJumpTargetNodesSteps),
      }
    })
}

function relabelNextLabels(
  steps: NamedWorkflowStep[],
  replacements: Map<StepName, StepName>,
): NamedWorkflowStep[] {
  return steps.map((step) => ({
    name: step.name,
    step: step.step.renameJumpTargets(replacements),
  }))
}
