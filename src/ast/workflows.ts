import {
  BooleanExpression,
  NullExpression,
  NumberExpression,
  StringExpression,
  VariableName,
  expressionToLiteralValueOrLiteralExpression,
} from './expressions.js'
import { WorkflowStatement } from './statements.js'
import { WorkflowStep, renderStep } from './steps.js'

export interface WorkflowParameter {
  name: VariableName
  default?:
    | StringExpression
    | NumberExpression
    | BooleanExpression
    | NullExpression
}

/**
 * This is the main container class that brings together all subworkflows in a program
 */
export class WorkflowApp {
  readonly subworkflows: Subworkflow[]

  constructor(subworkflows: Subworkflow[]) {
    this.subworkflows = subworkflows
  }

  getSubworkflowByName(name: string): Subworkflow | undefined {
    return this.subworkflows.find((w) => w.name === name)
  }

  render(): Record<string, unknown> {
    return Object.fromEntries(
      new Map(this.subworkflows.map((wf) => [wf.name, wf.renderBody()])),
    )
  }
}

export class SubworkflowStatements {
  constructor(
    public readonly name: string,
    public readonly statements: WorkflowStatement[],
    public readonly params?: WorkflowParameter[],
  ) {}
}

// https://cloud.google.com/workflows/docs/reference/syntax/subworkflows
export class Subworkflow {
  readonly name: string
  readonly steps: WorkflowStep[]
  readonly params?: WorkflowParameter[]

  constructor(
    name: string,
    steps: WorkflowStep[],
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
            return {
              [x.name]: expressionToLiteralValueOrLiteralExpression(x.default),
            }
          } else {
            return x.name
          }
        }),
      })
    }

    Object.assign(body, {
      steps: this.steps.map(renderStep),
    })

    return body
  }
}
