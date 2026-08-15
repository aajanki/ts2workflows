import { expect } from 'chai'
import { transpileText } from '../src/transpiler/index.js'
import { transpileAndSnapshotTest } from './testutils.js'
import { WorkflowSyntaxError } from '../src/errors.js'

describe('workflow transpiler', () => {
  it(
    'transpiles a function with parameters',
    transpileAndSnapshotTest(
      `function my_workflow(a, b, c) {
      return a + b + c;
    }`,
    ),
  )

  it(
    'transpiles a function with body',
    transpileAndSnapshotTest(
      `
    function my_workflow(a) {
      const b = a + 1;
      const c = 2 * b;
    }`,
    ),
  )

  it(
    'transpiles multiple subworkflows',
    transpileAndSnapshotTest(
      `
    function workflow1() {
      return 1;
    }

    function workflow2(first_param) {
      return 2;
    }
    `,
    ),
  )

  it(
    'handles function parameters with default values',
    transpileAndSnapshotTest(
      `
    function greeting(name = "world") {
      return "Hello " + name
    }`,
    ),
  )

  it(
    'handles function parameters with number or boolean default values',
    transpileAndSnapshotTest(
      `
    function test(value = 10, valid = true) {
      return value
    }`,
    ),
  )

  it(
    'handles function parameters with falsy default values',
    transpileAndSnapshotTest(
      `
    function test(falsyString = '', falsyNumber = 0, falsyBoolean = false, falsyNull = null) {
      return falsyString
    }`,
    ),
  )

  it(
    'accepts undefined as function default value (and outputs it as null)',
    transpileAndSnapshotTest(
      `
    function test(name: string | undefined = undefined): string {
      return name ?? ""
    }`,
    ),
  )

  it(
    'accepts optional function arguments',
    transpileAndSnapshotTest(
      `
    function test(name?: string): string {
      return name ?? ""
    }`,
    ),
  )

  it('rejects rest parameters', () => {
    const code = `
    function test(...rest): string {
      return ""
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects optional function argument with default value', () => {
    const code = `
    function test(name?: string = "Bean"): string {
      return name ?? ""
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects a list as a default value', () => {
    const code = `
    function greeting(names = ["Bean"]) {
      return "Hello " + names[0]
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects a binary expression as a default value', () => {
    const code = `function my_workflow(a = 1 + 2) {
      return null;
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects arrow function as a default value', () => {
    const code = `
    function test(x = () => 5): string {
      return x()
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects array destructing pattern as a default value', () => {
    const code = `
    function test([x = 1, y = 2] = []): string {
      return x + y
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it(
    'handles function with positional and optional parameters',
    transpileAndSnapshotTest(
      `function my_workflow(positional_arg, optional_arg = 100) {
      return null;
    }`,
    ),
  )

  it('throws if the subworkflow body is empty', () => {
    const code = `function empty_workflow() {}`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })
})
