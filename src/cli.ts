#!/usr/bin/env node

import * as fs from 'node:fs'
import { program } from 'commander'
import { transpile } from './transpiler.js'
import { SourceCodeLocation, WorkflowSyntaxError } from './errors.js'
import { TSError } from '@typescript-eslint/typescript-estree'

function parseArgs() {
  program
    .name('ts2workflow')
    .version('0.1.0')
    .description(
      'Transpile a Typescript program into GCP Workflows YAML syntax.',
    )
    .argument(
      '[FILES]',
      'Path to source file(s) to compile. If not given, reads from stdin.',
    )
  program.parse()
  return {
    sourceFiles: program.args,
  }
}

function cliMain() {
  const args = parseArgs()

  let files = []
  if (args.sourceFiles.length === 0) {
    files = ['-']
  } else {
    files = args.sourceFiles
  }

  files.forEach((inputFile) => {
    const inp = inputFile === '-' ? process.stdin.fd : inputFile
    let sourceCode = ''

    try {
      sourceCode = fs.readFileSync(inp, 'utf8')
      console.log(transpile(sourceCode))
    } catch (err) {
      if (isIoError(err, 'ENOENT')) {
        console.error(`Error: "${inp}" not found`)
        process.exit(1)
      } else if (isIoError(err, 'EISDIR')) {
        console.error(`Error: "${inp}" is a directory`)
        process.exit(1)
      } else if (isIoError(err, 'EAGAIN') && inp === process.stdin.fd) {
        // Reading from stdin if there's no input causes error. This is a bug in node
        console.error('Error: Failed to read from stdin')
        process.exit(1)
      } else if (err instanceof WorkflowSyntaxError) {
        prettyPrintSyntaxError(err, inputFile, sourceCode)
        process.exit(1)
      } else if (err instanceof TSError) {
        prettyPrintSyntaxError(err, inputFile, sourceCode)
        process.exit(1)
      } else {
        throw err
      }
    }
  })
}

function isIoError(err: unknown, errorCode: string): boolean {
  return err instanceof Error && 'code' in err && err.code == errorCode
}

function prettyPrintSyntaxError(
  exception: WorkflowSyntaxError,
  inputFile: string,
  sourceCode: string,
): void {
  console.error(errorDisplay(inputFile, sourceCode, exception.location))
  console.error(`${exception.message}`)
}

function errorDisplay(
  filename: string,
  sourceCode: string,
  location: SourceCodeLocation | undefined,
): string {
  const lines: string[] = []
  const prettyFilename = filename === '-' ? '<stdin>' : filename
  if (
    typeof location?.start === 'undefined' ||
    typeof location?.end === 'undefined' ||
    isNaN(location?.start.line) ||
    isNaN(location?.end.line)
  ) {
    lines.push(`File ${prettyFilename}:`)
  } else {
    lines.push(
      `File ${prettyFilename}, line ${location.start.line}, column ${location.start.column}:`,
    )
  }

  const highlightedLine = highlightedSourceCodeLine(
    sourceCode,
    location?.start?.line,
    location?.start?.column,
    location?.start?.line === location?.end?.line
      ? location?.end?.column
      : undefined,
  )
  if (highlightedLine.length > 0) {
    lines.push(highlightedLine)
    lines.push('')
  }

  return lines.join('\n')
}

function highlightedSourceCodeLine(
  sourceCode: string,
  lineNumber?: number,
  start?: number,
  end?: number,
): string {
  if (
    typeof lineNumber === 'undefined' ||
    typeof start === 'undefined' ||
    isNaN(start)
  ) {
    return ''
  }

  const lines = sourceCode.split('\n')
  const sourceLine = lines[lineNumber - 1]
  if (typeof sourceLine === 'undefined') {
    return ''
  }

  let markerLength
  if (typeof end === 'undefined') {
    markerLength = sourceLine.length - start
  } else {
    markerLength = Math.min(end - start + 1, sourceLine.length - start)
  }

  const markerLine = `${' '.repeat(start)}${'^'.repeat(markerLength)}`

  return `${sourceLine}\n${markerLine}`
}

if (
  import.meta.url.endsWith(process.argv[1]) ||
  process.argv[1].endsWith('/ts2workflow')
) {
  cliMain()
}
