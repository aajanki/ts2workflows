import { expect } from 'chai'
import * as YAML from 'yaml'
import { transpile } from '../src/transpiler.js'

describe('Transpiler', () => {
  it('throws if top level contains non-function elements', () => {
    const code = `
    function main() { }

    const a = 1;
    `

    expect(() => transpile(code)).to.throw()
  })

  it('accepts type annotations on variable declaration', () => {
    const code = `
    function main() {
      const greeting: string = "Hi, I'm Elfo!";
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - greeting: Hi, I'm Elfo!
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('accepts function parameter and return type annotations', () => {
    const code = `
    function addOne(x: number): number {
      return x + 1;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    addOne:
      params:
        - x
      steps:
        - return1:
            return: \${x + 1}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('accepts the "as" expression', () => {
    const code = `
    function main() {
      return 1 as number;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - return1:
            return: 1
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })
})

describe('Call statement', () => {
  it('assignment of a function call result', () => {
    const code = 'function main() { const name = getName(); }'
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - name: \${getName()}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('assignment of a function call result with anonymous parameters', () => {
    const code = 'function main() { const three = add(1, 2); }'
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - three: \${add(1, 2)}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('assignment of a scoped function call result', () => {
    const code = `function main() {
      const projectId = sys.get_env("GOOGLE_CLOUD_PROJECT_ID");
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - projectId: \${sys.get_env("GOOGLE_CLOUD_PROJECT_ID")}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('side effecting function call', () => {
    const code = 'function main() { writeLog("Everything going OK!"); }'
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - "": \${writeLog("Everything going OK!")}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })
})

describe('Assignment statement', () => {
  it('transpiles a const assignment', () => {
    const code = 'function main() { const a = 1; }'
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - a: 1
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a let assignment', () => {
    const code = 'function main() { let a = 1; }'
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - a: 1
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a var assignment', () => {
    const code = 'function main() { var a = 1; }'
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - a: 1
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('property assignment', () => {
    const code = 'function main() { person.name = "Bean"; }'
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - person.name: Bean
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('indexed assignment', () => {
    const code = 'function main() { values[3] = 10; }'
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - values[3]: 10
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })
})

describe('If statements', () => {
  it('if statement', () => {
    const code = `
    function main(x) {
      if (x > 0) {
        sys.log("positive")
      }
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      params:
        - x
      steps:
        - switch1:
            switch:
              - condition: \${x > 0}
                steps:
                  - assign1:
                      assign:
                        - "": \${sys.log("positive")}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('if-else statement', () => {
    const code = `
    function main(x) {
      if (x > 0) {
        return "positive";
      } else {
        return "non-positive";
      }
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      params:
        - x
      steps:
        - switch1:
            switch:
              - condition: \${x > 0}
                steps:
                  - return1:
                      return: positive
              - condition: true
                steps:
                  - return2:
                      return: non-positive
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('if statement with multiple branches', () => {
    const code = `
    function main(x) {
      if (x > 0) {
        return "positive";
      } else if (x === 0) {
        return "zero";
      } else {
        return "negative";
      }
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      params:
        - x
      steps:
        - switch1:
            switch:
              - condition: \${x > 0}
                steps:
                  - return1:
                      return: positive
              - condition: \${x == 0}
                steps:
                  - return2:
                      return: zero
              - condition: true
                steps:
                  - return3:
                      return: negative
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })
})

describe('Return statement', () => {
  it('return statement without a value', () => {
    const code = `function main() { return; }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - return1:
            next: end
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('return a literal value', () => {
    const code = `function main() { return "OK"; }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - return1:
            return: OK
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('return an expression', () => {
    const code = `function addOne(x) { return x + 1; }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    addOne:
      params:
        - x
      steps:
        - return1:
            return: \${x + 1}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })
})

describe('Try-catch statement', () => {
  it('transpiles try-catch statement', () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch (err) {
        if (err.code === 404) {
          return "Not found";
        }
      }
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
      main:
        steps:
          - try1:
              try:
                steps:
                  - assign1:
                      assign:
                        - response: \${http.get("https://visit.dreamland.test/")}
                  - return1:
                      return: \${response}
              except:
                as: err
                steps:
                  - switch1:
                      - condition: \${err.code == 404}
                        steps:
                          - return2:
                              return: "Not found"
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('throws on try without a catch', () => {
    const code = `
    function main() {
      try {
        response = http.get("https://visit.dreamland.test/");
      }
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('throws on catch without a try', () => {
    const code = `
    function main() {
      catch (err) {
        if (err.code == 404) {
          return "Not found";
        }
      }
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('throws is there are multiple catch blocks', () => {
    const code = `
    function main() {
      try {
        response = http.get("https://visit.dreamland.test/");
      }
      catch (err) {
        throw err;
      }
      catch (err) {
        if (err.code == 404) {
          return "Not found";
        }
      }
    }`

    expect(() => transpile(code)).to.throw()
  })
})

describe('Throw statement', () => {
  it('transpiles a throw with a literal string value', () => {
    const code = `function main() { throw "Error!"; }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - raise1:
            raise: "Error!"
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a throw with a literal map value', () => {
    const code = `
    function main() {
      throw {
        code: 98,
        message: "Access denied"
      };
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - raise1:
            raise:
              code: 98
              message: "Access denied"
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a throw with an expression', () => {
    const code = `function main(exception) { throw exception; }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      params:
        - exception
      steps:
        - raise1:
            raise: \${exception}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })
})

describe('For loops', () => {
  it('transpiles a for loop', () => {
    const code = `
    function main() {
      let total = 0;
      for (const x of [1, 2, 3]) {
        total = total + x;
      }
      return total;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - total: 0
        - for1:
            for:
              value: x
              in:
                - 1
                - 2
                - 3
              steps:
                - assign2:
                    assign:
                      - total: \${total + x}
        - return1:
            return: \${total}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a for loop with identifier as the for loop variable', () => {
    const code = `
    function main() {
      let total = 0;
      for (x of [1, 2, 3]) {
        total = total + x;
      }
      return total;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - total: 0
        - for1:
            for:
              value: x
              in:
                - 1
                - 2
                - 3
              steps:
                - assign2:
                    assign:
                      - total: \${total + x}
        - return1:
            return: \${total}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a for loop with a let for loop variable', () => {
    const code = `
    function main() {
      let total = 0;
      for (let x of [1, 2, 3]) {
        total = total + x;
      }
      return total;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - total: 0
        - for1:
            for:
              value: x
              in:
                - 1
                - 2
                - 3
              steps:
                - assign2:
                    assign:
                      - total: \${total + x}
        - return1:
            return: \${total}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a for loop with an empty body', () => {
    const code = `
    function main() {
      for (const x of [1, 2, 3]) {
      }
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - for1:
            for:
              value: x
              in:
                - 1
                - 2
                - 3
              steps: []
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a for loop over map keys', () => {
    const code = `
    function main(my_map) {
      let total = 0;
      for (const key of keys(my_map)) {
        total = total + my_map[key];
      }
      return total;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      params:
        - my_map
      steps:
        - assign1:
            assign:
              - total: 0
        - for1:
            for:
              value: key
              in: \${keys(my_map)}
              steps:
                - assign2:
                    assign:
                      - total: \${total + my_map[key]}
        - return1:
            return: \${total}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a continue in a for loop body', () => {
    const code = `
    function main() {
      let total = 0;
      for (const x of [1, 2, 3, 4]) {
        if (x % 2 === 0) {
          continue;
        }

        total = total + x;
      }
      return total;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - total: 0
        - for1:
            for:
              value: key
              in:
                - 1
                - 2
                - 3
                - 4
              steps:
                - switch1:
                    switch:
                      - condition: \${x % 2 == 0}
                        steps:
                          - next11:
                              next: continue
                - assign2:
                    assign:
                      - total: \${total + x}
        - return1:
            return: \${total}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a break in a for loop body', () => {
    const code = `
    function main() {
      let total = 0;
      for (const x of [1, 2, 3, 4]) {
        if (total > 5) {
          break;
        }

        total = total + x;
      }
      return total;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - total: 0
        - for1:
            for:
              value: key
              in:
                - 1
                - 2
                - 3
                - 4
              steps:
                - switch1:
                    switch:
                      - condition: \${total > 5}
                        steps:
                          - next11:
                              next: break
                - assign2:
                    assign:
                      - total: \${total + x}
        - return1:
            return: \${total}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a for loop of a list expression', () => {
    const code = `
    function main() {
      let total = 0;
      const values = [1, 2, 3];
      for (let x of values) {
        total = total + x;
      }
      return total;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    // TODO: fix this when merging of assign steps is implemented
    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - total: 0
        - assign2:
            assign:
              - values:
                  - 1
                  - 2
                  - 3
        - for1:
            for:
              value: x
              in: \${values}
              steps:
                - assign3:
                    assign:
                      - total: \${total + x}
        - return1:
            return: \${total}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('fails to parse for of a number', () => {
    const code = `
    function main() {
      for (const x of 5) {
      }
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('fails to parse for of a string', () => {
    const code = `
    function main() {
      for (const x of "fails") {
      }
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('fails to parse for of a map', () => {
    const code = `
    function main() {
      for (const x of {key: 1}) {
      }
    }`

    expect(() => transpile(code)).to.throw()
  })
})
