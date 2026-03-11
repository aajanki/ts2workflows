import {
  SourceCodeLocation,
  WorkflowSyntaxError,
  WorkflowSyntaxErrorWithText,
} from './errors.js'

export function prettifySyntaxError(exception: WorkflowSyntaxError): string {
  const filename =
    exception instanceof WorkflowSyntaxErrorWithText
      ? exception.filename
      : '???'
  const errorLineText =
    exception instanceof WorkflowSyntaxErrorWithText
      ? exception.errorLine
      : undefined

  return (
    `${errorLocator(filename, exception.location, errorLineText)}\n` +
    `${exception.message}`
  )
}

function errorLocator(
  filename: string,
  location: SourceCodeLocation,
  errorLineText: string | undefined,
): string {
  const lines: string[] = []
  if (isNaN(location.start.line) || isNaN(location.end.line)) {
    lines.push(`File ${filename}:`)
  } else {
    lines.push(
      `File ${filename}, line ${location.start.line}, column ${location.start.column + 1}:`,
    )
  }

  if (errorLineText) {
    const highlightedLine = highlightedSourceCodeLine(
      errorLineText,
      location.start.column,
      location.start.line === location.end.line
        ? location.end.column
        : undefined,
    )
    if (highlightedLine.length > 0) {
      lines.push(highlightedLine)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function highlightedSourceCodeLine(
  errorLineText: string,
  start: number,
  end: number | undefined,
): string {
  if (isNaN(start) || start < 0) {
    return ''
  }

  const sourceLine = errorLineText.split('\n')[0] ?? ''

  let markerLength
  if (end === undefined || isNaN(end) || end < 0) {
    markerLength = sourceLine.length - start
  } else {
    markerLength = Math.min(end - start + 1, sourceLine.length - start)
  }
  markerLength = Math.max(markerLength, 0)

  const markerLine = `${' '.repeat(start)}${'^'.repeat(markerLength)}`

  return `${sourceLine}\n${markerLine}`
}
