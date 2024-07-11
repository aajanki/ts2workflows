import { AssignStepAST, WorkflowStepAST } from './ast/steps.js'

// Merge consecutive assign steps
export function mergeAssignSteps(steps: WorkflowStepAST[]): WorkflowStepAST[] {
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
