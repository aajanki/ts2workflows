import { VariableName, LiteralValueOrLiteralExpression } from './expressions.js'
import { NamedWorkflowStep, renderStep } from './steps.js'

export interface WorkflowParameter {
  name: VariableName
  default?: LiteralValueOrLiteralExpression
}

/**
 * This is the main container class that brings together all subworkflows in a program
 */
export class WorkflowApp {
  readonly subworkflows: Subworkflow[]

  constructor(subworkflows: Subworkflow[]) {
    this.subworkflows = subworkflows
  }

  render(): Record<string, unknown> {
    return Object.fromEntries(
      new Map(this.subworkflows.map((wf) => [wf.name, wf.renderBody()])),
    )
  }
}

// https://cloud.google.com/workflows/docs/reference/syntax/subworkflows
export class Subworkflow {
  readonly name: string
  readonly steps: NamedWorkflowStep[]
  readonly params?: WorkflowParameter[]

  constructor(
    name: string,
    steps: NamedWorkflowStep[],
    params?: WorkflowParameter[],
  ) {
    this.name = name
    this.steps = steps
    this.params = params
  }

  renderBody(): Record<string, unknown> {
    const body = {}
    if (this.params && this.params.length > 0) {
      Object.assign(body, {
        params: this.params.map((x) => {
          if (x.default !== undefined) {
            return { [x.name]: x.default }
          } else {
            return x.name
          }
        }),
      })
    }

    Object.assign(body, {
      steps: this.steps.map(({ name, step }) => {
        return { [name]: renderStep(step) }
      }),
    })

    return body
  }
}
