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

    const expected = YAML.parse(`
    my_workflow:
      params:
        - a
      steps:
        - assign1:
            assign:
              - b: \${a + 1}
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

  it('handles function parameters with default values', () => {
    const code = `
    function greeting(name = "world") {
      return "Hello " + name
    }`

    const expected = YAML.parse(`
    greeting:
      params:
        - name: world
      steps:
        - return1:
            return: \${"Hello " + name}
    `) as unknown

    const observed = YAML.parse(transpile(code)) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('handles function with positional and optional parameters', () => {
    const code = `function my_workflow(positional_arg, optional_arg = 100) {}`

    const expected = YAML.parse(`
    my_workflow:
      params:
        - positional_arg
        - optional_arg: 100
      steps: []
    `) as unknown

    const observed = YAML.parse(transpile(code)) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('throws if the default value is an expression', () => {
    const code = `function my_workflow(a = 1 + 2) {}`

    expect(() => transpile(code)).to.throw()
  })
})
