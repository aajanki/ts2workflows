/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { expect } from 'chai'
import * as YAML from 'yaml'
import { transpile } from '../src/transpiler.js'

describe('transpiler', () => {
  it('transpiles an assignment', () => {
    const code = `const a = 1;`
    const observed = YAML.parse(transpile(code))[0]

    const expected = YAML.parse(`
    assign:
      - a: 1
    `)

    expect(observed).to.deep.equal(expected)
  })
})
