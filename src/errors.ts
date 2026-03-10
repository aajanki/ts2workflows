export interface SourceCodeLocation {
  start: { line: number; column: number }
  end: { line: number; column: number }
}

// WorkflowSyntaxError is thrown when the input contains a syntax error.
// The error is in user's input.
export class WorkflowSyntaxError extends Error {
  constructor(
    message: string,
    public readonly location: SourceCodeLocation,
  ) {
    super(message)
  }
}

// WorkflowSyntaxError enriched with the source code filename and the text of
// the line where the error occurred.
export class WorkflowSyntaxErrorWithText extends WorkflowSyntaxError {
  constructor(
    message: string,
    public readonly location: SourceCodeLocation,
    public readonly filename: string,
    public readonly errorLine: string,
  ) {
    super(message, location)
  }
}

export function syntaxErrorWithText(
  error: WorkflowSyntaxError,
  filename: string,
  sourceCode: string,
): WorkflowSyntaxErrorWithText {
  const lineNumber = Math.max(error.location.start.line, 0)
  const lines = sourceCode.split('\n')
  const errorLine = lines[lineNumber - 1]

  return new WorkflowSyntaxErrorWithText(
    error.message,
    error.location,
    filename,
    errorLine,
  )
}

// InternalTranspilingError is thrown when ts2workflow ends up in an unexpected state.
// This is a bug in ts2workflow.
export class InternalTranspilingError extends Error {
  constructor(message: string) {
    super(`Internal error: ${message}`)
  }
}

// An IO error with an error code string, similar to Node's SystemError
export class IOError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
  }
}
