import { expect } from 'chai'
import { transpile } from '../src/transpiler/index.js'
import { assertTranspiled } from './testutils.js'

describe('workflow transpiler', () => {
  it('transpiles a function with parameters', () => {
    const code = `function my_workflow(a, b, c) {
      return a + b + c;
    }`
    const expected = `
    my_workflow:
      params:
        - a
        - b
        - c
      steps:
        - return1:
            return: \${a + b + c}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles a function with body', () => {
    const code = `
    function my_workflow(a) {
      const b = a + 1;
      const c = 2 * b;
    }`

    const expected = `
    my_workflow:
      params:
        - a
      steps:
        - assign1:
            assign:
              - b: \${a + 1}
              - c: \${2 * b}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles multiple subworkflows', () => {
    const code = `
    function workflow1() {
      return 1;
    }

    function workflow2(first_param) {
      return 2;
    }
    `

    const expected = `
    workflow1:
      steps:
        - return1:
            return: 1

    workflow2:
      params:
        - first_param
      steps:
        - return1:
            return: 2
    `

    assertTranspiled(code, expected)
  })

  it('handles function parameters with default values', () => {
    const code = `
    function greeting(name = "world") {
      return "Hello " + name
    }`

    const expected = `
    greeting:
      params:
        - name: world
      steps:
        - return1:
            return: \${"Hello " + name}
    `

    assertTranspiled(code, expected)
  })

  it('handles function parameters with number or boolean default values', () => {
    const code = `
    function test(value = 10, valid = true) {
      return value
    }`

    const expected = `
    test:
      params:
        - value: 10
        - valid: true
      steps:
        - return1:
            return: \${value}
    `

    assertTranspiled(code, expected)
  })

  it('handles function parameters with falsy default values', () => {
    const code = `
    function test(falsyString = '', falsyNumber = 0, falsyBoolean = false, falsyNull = null) {
      return falsyString
    }`

    const expected = `
    test:
      params:
        - falsyString: ''
        - falsyNumber: 0
        - falsyBoolean: false
        - falsyNull: null
      steps:
        - return1:
            return: \${falsyString}
    `

    assertTranspiled(code, expected)
  })

  it('accepts undefined as function default value (and outputs it as null)', () => {
    const code = `
    function test(name: string | undefined = undefined): string {
      return name ?? ""
    }`

    const expected = `
    test:
      params:
        - name: null
      steps:
        - return1:
            return: \${default(name, "")}
    `

    assertTranspiled(code, expected)
  })

  it('accepts optional function arguments', () => {
    const code = `
    function test(name?: string): string {
      return name ?? ""
    }`

    const expected = `
    test:
      params:
        - name: null
      steps:
        - return1:
            return: \${default(name, "")}
    `

    assertTranspiled(code, expected)
  })

  it('rejects rest parameters', () => {
    const code = `
    function test(...rest): string {
      return ""
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('rejects optional function argument with default value', () => {
    const code = `
    function test(name?: string = "Bean"): string {
      return name ?? ""
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('throws if the default value is a list', () => {
    const code = `
    function greeting(names = ["Bean"]) {
      return "Hello " + names[0]
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('throws if the default value is an expression', () => {
    const code = `function my_workflow(a = 1 + 2) {
      return null;
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('handles function with positional and optional parameters', () => {
    const code = `function my_workflow(positional_arg, optional_arg = 100) {
      return null;
    }`

    const expected = `
    my_workflow:
      params:
        - positional_arg
        - optional_arg: 100
      steps:
        - return1:
            return: null
    `

    assertTranspiled(code, expected)
  })

  it('throws if the subworkflow body is empty', () => {
    const code = `function empty_workflow() {}`

    expect(() => transpile(code)).to.throw()
  })
})
