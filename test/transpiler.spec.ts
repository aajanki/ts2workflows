/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { expect } from 'chai'
import * as YAML from 'yaml'
import { transpile } from '../src/transpiler.js'

describe('transpiler', () => {
  it('transpiles an assignment', () => {
    const code = 'function main() { const a = 1; }'
    const observed = YAML.parse(transpile(code))

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - a: 1
    `)

    expect(observed).to.deep.equal(expected)
  })

  it('property assignment', () => {
    const code = 'function main() { person.name = "Bean"; }'
    const observed = YAML.parse(transpile(code))

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - person.name: Bean
    `)

    expect(observed).to.deep.equal(expected)
  })

  it('indexed assignment', () => {
    const code = 'function main() { values[3] = 10; }'
    const observed = YAML.parse(transpile(code))

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - values[3]: 10
    `)

    expect(observed).to.deep.equal(expected)
  })

  it('assignment of a function call result', () => {
    const code = 'function main() { const name = getName(); }'
    const observed = YAML.parse(transpile(code))

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - name: \${getName()}
    `)

    expect(observed).to.deep.equal(expected)
  })

  it('assignment of a function call result with anonymous parameters', () => {
    const code = 'function main() { const three = add(1, 2); }'
    const observed = YAML.parse(transpile(code))

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - three: \${add(1, 2)}
    `)

    expect(observed).to.deep.equal(expected)
  })

  it('assignment of a scoped function call result', () => {
    const code = `function main() {
      const projectId = sys.get_env("GOOGLE_CLOUD_PROJECT_ID");
    }`
    const observed = YAML.parse(transpile(code))

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - projectId: \${sys.get_env("GOOGLE_CLOUD_PROJECT_ID")}
    `)

    expect(observed).to.deep.equal(expected)
  })

  it('side effecting function call', () => {
    const code = 'function main() { writeLog("Everything going OK!"); }'
    const observed = YAML.parse(transpile(code))

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - "": \${writeLog("Everything going OK!")}
    `)

    expect(observed).to.deep.equal(expected)
  })

  it('throws if top level contains non-function elements', () => {
    const code = `
    function main() { }

    const a = 1;
    `

    expect(() => transpile(code)).to.throw()
  })
})
