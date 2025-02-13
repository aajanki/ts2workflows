import { expect } from 'chai'
import * as YAML from 'yaml'
import * as fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { transpile } from '../src/transpiler/index.js'
import { assertTranspiled } from './testutils.js'

describe('Type annotations', () => {
  it('accepts type annotations on variable declaration', () => {
    const code = `
    function main() {
      const greeting: string = "Hi, I'm Elfo!";
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - greeting: Hi, I'm Elfo!
    `

    assertTranspiled(code, expected)
  })

  it('accepts function parameter and return type annotations', () => {
    const code = `
    function addOne(x: number): number {
      return x + 1;
    }`

    const expected = `
    addOne:
      params:
        - x
      steps:
        - return1:
            return: \${x + 1}
    `

    assertTranspiled(code, expected)
  })

  it('ignores interface declaration', () => {
    const code = `
    interface Person {
      name: string
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    expect(observed).to.deep.equal({})
  })

  it('ignores type declaration', () => {
    const code = `
    type Person = {
      name: string
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    expect(observed).to.deep.equal({})
  })

  it('ignores non-null assertions', () => {
    const code = `
    function getName(person) {
      return person!.name;
    }`

    const expected = `
    getName:
      params:
        - person
      steps:
        - return1:
            return: \${person.name}
    `

    assertTranspiled(code, expected)
  })
})

describe('Generics', () => {
  it('accepts generics in function calls', () => {
    const code = `function main() {
      const city = http.get<CityResponse>("https://example.com/cities/LON")
    }`

    const expected = `
    main:
      steps:
        - call_http_get_1:
            call: http.get
            args:
              url: https://example.com/cities/LON
            result: city
    `

    assertTranspiled(code, expected)
  })

  it('accepts generics in assignment steps', () => {
    const code = `function main() {
      const name = getName<string>()
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - name: \${getName()}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles type instantiation expressions', () => {
    const code = `function main() {
      const city = call_step(http.get<CityResponse>, { url: "https://example.com/cities/LON" })

    }`

    const expected = `
    main:
      steps:
        - call_http_get_1:
            call: http.get
            args:
              url: https://example.com/cities/LON
            result: city
    `

    assertTranspiled(code, expected)
  })
})

describe('Function definition', () => {
  it('accepts "export function"', () => {
    const code = `export function main() { return 1; }`

    const expected = `
    main:
      steps:
        - return1:
            return: 1
    `

    assertTranspiled(code, expected)
  })

  it('accepts but ignores async and await', () => {
    const code = `
    async function workflow1() {
      const result = await workflow2();
      return result;
    }

    async function workflow2() {
      return 1;
    }`

    const expected = `
    workflow1:
      steps:
        - assign1:
            assign:
              - result: \${workflow2()}
        - return1:
            return: \${result}

    workflow2:
      steps:
        - return2:
            return: 1
    `

    assertTranspiled(code, expected)
  })

  it('ignores function declaration', () => {
    const code = `
    declare function computeIt()
    export declare function exportedComputation()
    `

    const observed = YAML.parse(transpile(code)) as unknown

    expect(observed).to.deep.equal({})
  })

  it('throws if function is defined in a nested scope', () => {
    const code = `
    function main() {
      function not_allowed() {}
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('throws if top level contains other than functions or import', () => {
    const code = `
    function main() { }

    const a = 1;
    `

    expect(() => transpile(code)).to.throw()
  })

  it('accepts nested block statements', () => {
    const code = `
    function test() {
      {
        return 1;
      }
    }`

    const expected = `
    test:
      steps:
        - return1:
            return: 1
    `

    assertTranspiled(code, expected)
  })
})

describe('Runtime functions', () => {
  it('Array.isArray(x) is converted to get_type(x) == "list"', () => {
    const code = `
    function main(x) {
      return Array.isArray(x)
    }`

    const expected = `
    main:
      params:
        - x
      steps:
        - return1:
            return: \${get_type(x) == "list"}
    `

    assertTranspiled(code, expected)
  })

  it('Array.isArray(x) in a nested expression', () => {
    const code = `
    function main(x) {
      return { type: Array.isArray(x) ? "array" : "not array" }
    }`

    const expected = `
    main:
      params:
        - x
      steps:
        - return1:
            return:
              type: \${if(get_type(x) == "list", "array", "not array")}
    `

    assertTranspiled(code, expected)
  })
})

describe('Sample source files', () => {
  const samplesdir = './samples'

  it('type checks samples files', () => {
    const res = spawnSync('tsc', ['--project', 'tsconfig.workflows.json'])
    const stdoutString = res.stdout.toString('utf-8')
    const stderrString = res.stderr.toString('utf-8')

    expect(stdoutString).to.equal('')
    expect(stderrString).to.equal('')
    expect(res.status).to.equal(
      0,
      'Type checking finished with a non-zero exit code',
    )
    expect(res.error).to.be.an('undefined')
  })

  it('transpiles sample files', () => {
    fs.readdirSync(samplesdir).forEach((file) => {
      if (file.endsWith('.ts')) {
        const code = fs.readFileSync(`${samplesdir}/${file}`, {
          encoding: 'utf-8',
        })

        expect(() => transpile(code)).not.to.throw()
      }
    })
  })
})
