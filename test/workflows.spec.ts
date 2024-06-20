import { expect } from 'chai'
import * as YAML from 'yaml'
import { transpile } from '../src/transpiler.js'

describe('workflow transpiler', () => {
  it('transpiles a function with parameters', () => {
    const code = 'function my_workflow(a, b, c) {}'
    const expected = YAML.parse(`
    my_workflow:
      params:
        - a
        - b
        - c
      steps: []
    `) as unknown

    const observed = YAML.parse(transpile(code)) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a function with body', () => {
    const code = `
    function my_workflow(a) {
      const b = a + 1;
      const c = 2 * b;
    }`

    // TODO: fix this when the assign steps merging is implemented
    const expected = YAML.parse(`
    my_workflow:
      params:
        - a
      steps:
        - assign1:
            assign:
              - b: \${a + 1}
        - assign2:
            assign:
              - c: \${2 * b}
    `) as unknown

    const observed = YAML.parse(transpile(code)) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles multiple subworkflows', () => {
    const code = `
    function workflow1() {}
    function workflow2(first_param) {}
    `

    const expected = YAML.parse(`
    workflow1:
      steps: []

    workflow2:
      params:
        - first_param
      steps: []
    `) as unknown

    const observed = YAML.parse(transpile(code)) as unknown

    expect(observed).to.deep.equal(expected)
  })
})
