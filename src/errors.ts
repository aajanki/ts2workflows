export interface SourceCodeLocation {
  start: { line: number; column: number }
  end: { line: number; column: number }
}

// WorkflowSyntaxError is thrown when the input contains a syntax error.
// The error is in user's input.
export class WorkflowSyntaxError extends Error {
  location: SourceCodeLocation

  constructor(message: string, location: SourceCodeLocation) {
    super(message)
    this.location = location
  }
}

// InternalTranspilingError is thrown when ts2workflow ends up in an unexpected state.
// The error is in ts2workflow.
export class InternalTranspilingError extends Error {
  constructor(message: string) {
    super(`Internal error: ${message}`)
  }
}

export class IOError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
  }
}
