import { expect } from 'chai'
import * as YAML from 'yaml'
import * as fs from 'node:fs'
import { transpile, transpileText } from '../src/transpiler/index.js'
import { transpileAndSnapshotTest } from './testutils.js'
import { IOError, WorkflowSyntaxError } from '../src/errors.js'

describe('Type annotations', () => {
  it(
    'accepts type annotations on variable declaration',
    transpileAndSnapshotTest(
      `
    function main() {
      const greeting: string = "Hi, I'm Elfo!";
    }`,
    ),
  )

  it(
    'accepts function parameter and return type annotations',
    transpileAndSnapshotTest(
      `
    function addOne(x: number): number {
      return x + 1;
    }`,
    ),
  )

  it(
    'ignores interface declaration',
    transpileAndSnapshotTest(
      `
    interface Person {
      name: string
    }`,
    ),
  )

  it(
    'ignores type declaration',
    transpileAndSnapshotTest(
      `
    type Person = {
      name: string
    }`,
    ),
  )

  it(
    'ignores non-null assertions',
    transpileAndSnapshotTest(
      `
    function getName(person) {
      return person!.name;
    }`,
    ),
  )
})

describe('Type definitions', () => {
  it(
    'ignores type alias on the top level',
    transpileAndSnapshotTest(
      `
    type Person = { name: string };

    function main() {
      return 1;
    }`,
    ),
  )

  it(
    'ignores type alias inside a function',
    transpileAndSnapshotTest(
      `function main() {
      type Person = { name: string };

      const p: Person = { name: "Bean" };
    }`,
    ),
  )

  it(
    'ignores interface on the top level',
    transpileAndSnapshotTest(
      `
    interface Person { name: string }

    function main() {
      const p: Person = { name: "Bean" };
    }`,
    ),
  )

  it(
    'ignores interface inside a function',
    transpileAndSnapshotTest(
      `
    function main() {
      interface Person { name: string }

      const p = { name: "Bean" };
    }`,
    ),
  )

  it('enums are not supported', () => {
    const code = `
    function main() {
      enum Direction { Up, Down, Left, Right }
      const dir: Direction = Direction.Up
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })
})

describe('Generics', () => {
  it(
    'accepts generics in function calls',
    transpileAndSnapshotTest(
      `function main() {
      const city = http.get<CityResponse>("https://example.com/cities/LON")
    }`,
    ),
  )

  it(
    'accepts generics in assignment steps',
    transpileAndSnapshotTest(
      `function main() {
      const name = getName<string>()
    }`,
    ),
  )

  it(
    'transpiles type instantiation expressions',
    transpileAndSnapshotTest(
      // Note that this would fail at run time because functions are not
      // first-class object in Workflows, but we still transpile it.
      `function main() {
      const func = getName<string>
    }`,
    ),
  )

  it(
    'transpiles type instantiation expressions in call_step',
    transpileAndSnapshotTest(
      `function main() {
      const city = call_step(http.get<CityResponse>, { url: "https://example.com/cities/LON" })
    }`,
    ),
  )
})

describe('Function definition', () => {
  it(
    'accepts "export function"',
    transpileAndSnapshotTest(`export function main() { return 1; }`),
  )

  it(
    'accepts but ignores async and await',
    transpileAndSnapshotTest(
      `
    async function workflow1() {
      const result = await workflow2();
      return result;
    }

    async function workflow2() {
      return 1;
    }`,
    ),
  )

  it(
    'ignores function declaration',
    transpileAndSnapshotTest(
      `
    declare function computeIt()
    export declare function exportedComputation()
    `,
    ),
  )

  it('throws if function is defined in a nested scope', () => {
    const code = `
    function main() {
      function not_allowed() {}
    }`
    expect(() => transpileText(code)).to.throw()
  })

  it('throws if top level contains other than functions or import', () => {
    const code = `
    function main() { }

    const a = 1;
    `

    expect(() => transpileText(code)).to.throw()
  })

  it(
    'accepts nested block statements',
    transpileAndSnapshotTest(
      `
    function test() {
      {
        return 1;
      }
    }`,
    ),
  )
})

describe('Compiler intrinsics', () => {
  it(
    'Array.isArray(x) is converted to get_type(x) == "list"',
    transpileAndSnapshotTest(
      `
    function main(x) {
      return Array.isArray(x)
    }`,
    ),
  )

  it(
    'Array.isArray(x) in a nested expression',
    transpileAndSnapshotTest(
      `
    function main(x) {
      return { type: Array.isArray(x) ? "array" : "not array" }
    }`,
    ),
  )

  it(
    'nested Array.isArray() calls',
    transpileAndSnapshotTest(
      `
    function main(x) {
      return Array.isArray(Array.isArray(x))
    }`,
    ),
  )

  it(
    'Array.includes(arr, x) is converted to x in arr',
    transpileAndSnapshotTest(
      `
    function main(arr: number[]) {
      return Array.includes(arr, 55)
    }`,
    ),
  )
})

describe('Sample source files', () => {
  const samplesdir = './samples'

  it('transpiles sample files with transpileText', () => {
    fs.readdirSync(samplesdir).forEach((file) => {
      if (file.endsWith('.ts')) {
        const mainPath = `${samplesdir}/${file}`
        const code = fs.readFileSync(mainPath, 'utf-8')

        expect(() => transpileText(code)).not.to.throw()
      }
    })
  })

  it('transpiles sample files with a project', () => {
    fs.readdirSync(samplesdir).forEach((file) => {
      if (file.endsWith('.ts')) {
        const mainPath = `${samplesdir}/${file}`
        const configPath = `${samplesdir}/tsconfig.json`
        const sourceCode = fs.readFileSync(mainPath, 'utf-8')

        expect(() =>
          transpile(mainPath, sourceCode, configPath, false),
        ).not.to.throw()
      }
    })
  })

  it('transpiles sample files without a project', () => {
    fs.readdirSync(samplesdir).forEach((file) => {
      if (file.endsWith('.ts')) {
        const mainPath = `${samplesdir}/${file}`
        const sourceCode = fs.readFileSync(mainPath, 'utf-8')

        expect(() =>
          transpile(mainPath, sourceCode, undefined, false),
        ).not.to.throw()
      }
    })
  })

  it.skip('generates linked output', () => {
    const mainPath = `${samplesdir}/sample2.ts`
    const configPath = `${samplesdir}/tsconfig.json`
    const sourceCode = fs.readFileSync(mainPath, 'utf-8')
    const yaml = transpile(mainPath, sourceCode, configPath, true)
    const observed = YAML.parse(yaml) as unknown

    if (!(typeof observed === 'object' && observed !== null)) {
      throw new Error(
        `transpiler returned an unexpected type: ${typeof observed}`,
      )
    }

    // main comes from sample2.ts
    // get_url comes from imported file http_helpers.ts
    expect(Object.keys(observed)).to.have.members(['main', 'get_url'])
  })

  it('throws if the input file does not exist', () => {
    const fullPath = `${samplesdir}/this-file-does-not-exist.ts`
    const transpileAttempt = () =>
      transpile(fullPath, '', 'samples/tsconfig.json', false)

    expect(transpileAttempt).to.throw(IOError, 'not found')
  })
})
