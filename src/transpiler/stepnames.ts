import { toStepSubworkflow, Label } from '../ast/steps.js'
import { SubworkflowStatements, WorkflowApp } from '../ast/workflows.js'

function createStepNameGenerator() {
  const counters = new Map<string, number>()

  return (prefix: string): Label => {
    const i = counters.get(prefix) ?? 1
    counters.set(prefix, i + 1)

    return Label(`${prefix}${i}`)
  }
}

export function generateStepNames(
  subworkflows: SubworkflowStatements[],
): WorkflowApp {
  const transformed = subworkflows.map((subworkflow) => {
    const generateLabel = createStepNameGenerator()
    return toStepSubworkflow(subworkflow, generateLabel)
  })

  return new WorkflowApp(transformed)
}
