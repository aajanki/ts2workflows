#!/usr/bin/env node

import * as fs from 'node:fs'
import * as path from 'node:path'
import { program } from 'commander'
import { transpile } from './transpiler/index.js'
import { SourceCodeLocation, WorkflowSyntaxError } from './errors.js'
import { TSError } from '@typescript-eslint/typescript-estree'

interface CLIOptions {
  project?: string
  outdir?: string
}

function parseArgs() {
  program
    .name('ts2workflow')
    .version('0.1.0')
    .description(
      'Transpile a Typescript program into GCP Workflows YAML syntax.',
    )
    .option(
      '--project <path>',
      'Path to TSConfig for the Typescript sources files.',
    )
    .option(
      '--outdir <path>',
      'Specify an output directory for where transpilation result are written.',
    )
    .argument(
      '[FILES...]',
      'Path to source file(s) to compile. If not given, reads from stdin.',
    )
    .parse()

  return {
    options: program.opts<CLIOptions>(),
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
    try {
      const success = transpileAndOutput(
        inputFile,
        args.options.project,
        args.options.outdir,
      )

      if (!success) {
        process.exit(1)
      }
    } catch (err) {
      if (isIoError(err, 'ENOENT') && isIoError(err, 'EACCES')) {
        console.error(err.message)
        process.exit(1)
      } else if (isIoError(err, 'EISDIR')) {
        console.error(`Error: "${inputFile}" is a directory`)
        process.exit(1)
      } else if (isIoError(err, 'EAGAIN') && inputFile === '-') {
        // Reading from stdin if there's no input causes error. This is a bug in node
        console.error('Error: Failed to read from stdin')
        process.exit(1)
      } else {
        throw err
      }
    }
  })
}

function transpileAndOutput(
  inputFile: string,
  project?: string,
  outdir?: string,
): boolean {
  const inp = inputFile === '-' ? process.stdin.fd : inputFile
  const sourceCode = fs.readFileSync(inp, 'utf8')

  try {
    const transpiled = transpile(sourceCode, inputFile, project)

    if (outdir !== undefined) {
      if (!fs.existsSync(outdir)) {
        fs.mkdirSync(outdir, { recursive: true })
      }

      const outputFile = createOutputFilename(inputFile, outdir)
      fs.writeFileSync(outputFile, transpiled)
    } else {
      process.stdout.write(transpiled)
    }

    return true
  } catch (err) {
    if (err instanceof WorkflowSyntaxError) {
      prettyPrintSyntaxError(err, inputFile, sourceCode)
      return false
    } else if (err instanceof TSError) {
      prettyPrintSyntaxError(err, inputFile, sourceCode)
      return false
    } else {
      throw err
    }
  }
}

function createOutputFilename(inputFile: string, outdir: string): string {
  const parsedInput = path.parse(inputFile)

  return path.format({
    dir: outdir,
    name: parsedInput.name,
    ext: '.yaml',
  })
}

function isIoError(err: unknown, errorCode: string): err is Error {
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
      `File ${prettyFilename}, line ${location.start.line}, column ${location.start.column + 1}:`,
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
  process.argv[1].endsWith('/ts2workflows')
) {
  cliMain()
}
