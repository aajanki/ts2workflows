/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */

import { expect } from 'chai'
import { prettifySyntaxError } from '../src/diagnostics'
import { WorkflowSyntaxError, WorkflowSyntaxErrorWithText } from '../src/errors'

describe('error diagnostics', () => {
  it('prints pretty errors', () => {
    const location = {
      start: { line: 34, column: 6 },
      end: { line: 34, column: 9 },
    }

    const err = new WorkflowSyntaxError('Invalid identifier', location)
    const msg = prettifySyntaxError(err)

    expect(msg).to.equal('File ???, line 34, column 7:\nInvalid identifier')
  })

  it('prints pretty errors with source code', () => {
    const location = {
      start: { line: 34, column: 6 },
      end: { line: 34, column: 9 },
    }

    const err = new WorkflowSyntaxErrorWithText(
      'Invalid identifier',
      location,
      'sample.ts',
      'const 123x = null;',
    )
    const msg = prettifySyntaxError(err)

    expect(msg).to.equal(
      'File sample.ts, line 34, column 7:\n' +
        'const 123x = null;\n' +
        '      ^^^^\n\n' +
        'Invalid identifier',
    )
  })

  it('prints the first line of a multiline error', () => {
    const location = {
      start: { line: 34, column: 6 },
      end: { line: 35, column: 2 },
    }

    const err = new WorkflowSyntaxErrorWithText(
      'Syntax error',
      location,
      'sample.ts',
      'const 5 = \n  ;',
    )
    const msg = prettifySyntaxError(err)

    expect(msg).to.equal(
      'File sample.ts, line 34, column 7:\n' +
        'const 5 = \n' +
        '      ^^^^\n\n' +
        'Syntax error',
    )
  })

  it('prints error if source line is missing', () => {
    const location = {
      start: { line: 34, column: 6 },
      end: { line: 34, column: 8 },
    }

    const err = new WorkflowSyntaxErrorWithText(
      'Syntax error',
      location,
      'sample.ts',
      '',
    )
    const msg = prettifySyntaxError(err)

    expect(msg).to.equal('File sample.ts, line 34, column 7:\nSyntax error')
  })

  it('prints errors without line numbers', () => {
    const location = {
      start: { line: NaN, column: NaN },
      end: { line: NaN, column: NaN },
    }

    const err = new WorkflowSyntaxErrorWithText(
      'Invalid identifier',
      location,
      'sample.ts',
      'const 123x = null;',
    )
    const msg = prettifySyntaxError(err)

    expect(msg).to.equal('File sample.ts:\nInvalid identifier')
  })
})
