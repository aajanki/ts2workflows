export interface SourceCodeLocation {
  start: { line: number; column: number }
  end: { line: number; column: number }
}

export class WorkflowSyntaxError extends Error {
  location: SourceCodeLocation

  constructor(message: string, location: SourceCodeLocation) {
    super(message)
    this.location = location
  }
}
