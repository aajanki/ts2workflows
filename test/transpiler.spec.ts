import { expect } from 'chai'
import * as YAML from 'yaml'
import * as fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { transpile } from '../src/transpiler.js'

describe('Transpiler', () => {
  it('accepts import declaration on the top-level', () => {
    const code = `
    import 'http'
    import defaultExport from 'module'
    import { log } from 'logger'
    import * as sys from 'sys'`

    expect(() => transpile(code)).not.to.throw()
  })

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

  it('addition assignment', () => {
    const code = `
    function main() {
      let x = 0;
      x += 5;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - x: 0
              - x: \${x + 5}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('addition assignment to a member expression', () => {
    const code = `
    function main() {
      people[4].age += 1;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - people[4].age: \${people[4].age + 1}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('addition assignment with a complex expression', () => {
    const code = `
    function main() {
      x += 2 * y + 10;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - x: \${x + ((2 * y) + 10)}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('substraction assignment', () => {
    const code = `
    function main() {
      let x = 0;
      x -= 5;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - x: 0
              - x: \${x - 5}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('multiplication assignment', () => {
    const code = `
    function main() {
      let x = 1;
      x *= 2;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - x: 1
              - x: \${x * 2}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('division assignment', () => {
    const code = `
    function main() {
      let x = 10;
      x /= 2;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - x: 10
              - x: \${x / 2}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('throws if the left-hand side of an assignment is a complex expression', () => {
    const code = `
    function main() {
      2 * x = 4
    }
    `

    expect(() => transpile(code)).to.throw()
  })

  it('throws if the left-hand side of an compound assignment is a complex expression', () => {
    const code = `
    function main() {
      2 * x += 4
    }
    `

    expect(() => transpile(code)).to.throw()
  })

  it('merges consequtive assignments into a single step', () => {
    const code = `
    function main() {
      const a = {};
      const b = 'test';
      const c = 12;
      const d = c + 1;
      a.id = '1';
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - a: {}
              - b: test
              - c: 12
              - d: \${c + 1}
              - a.id: "1"
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('merges consequtive assignments into a single step in a nested scope', () => {
    const code = `
    function main() {
      if (2 > 1) {
        const a = {};
        const b = 'test';
        const c = 12;
        const d = c + 1;
        a.id = '1';
      }
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - switch1:
            switch:
              - condition: \${2 > 1}
                steps:
                  - assign1:
                      assign:
                        - a: {}
                        - b: test
                        - c: 12
                        - d: \${c + 1}
                        - a.id: "1"
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
                      switch:
                        - condition: \${err.code == 404}
                          steps:
                            - return2:
                                return: "Not found"
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles try-catch without an error variable', () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
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
                steps:
                  - assign2:
                      assign:
                        - "": \${log("Error!")}
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
              value: x
              in:
                - 1
                - 2
                - 3
                - 4
              steps:
                - switch1:
                    switch:
                      - condition: \${(x % 2) == 0}
                        steps:
                          - next1:
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
              value: x
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
                          - next1:
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

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - total: 0
              - values:
                  - 1
                  - 2
                  - 3
        - for1:
            for:
              value: x
              in: \${values}
              steps:
                - assign2:
                    assign:
                      - total: \${total + x}
        - return1:
            return: \${total}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('fails to parse for...of a number', () => {
    const code = `
    function main() {
      for (const x of 5) {
      }
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('fails to parse for...of a string', () => {
    const code = `
    function main() {
      for (const x of "fails") {
      }
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('fails to parse for...of a map', () => {
    const code = `
    function main() {
      for (const x of {key: 1}) {
      }
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('does not support for...in', () => {
    const code = `
    function main() {
      for (const x in [1, 2, 3]) {
      }
    }`

    expect(() => transpile(code)).to.throw()
  })
})

describe('Parallel steps', () => {
  it('outputs parallel steps', () => {
    const code = `
    function main() {
      parallel([
        () => {
          log("Hello from branch 1");
        },
        () => {
          log("Hello from branch 2");
        },
        () => {
          log("Hello from branch 3");
        },
      ]);
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - parallel1:
            parallel:
              branches:
                - branch1:
                    steps:
                      - assign1:
                          assign:
                            - "": \${log("Hello from branch 1")}
                - branch2:
                    steps:
                      - assign2:
                          assign:
                            - "": \${log("Hello from branch 2")}
                - branch3:
                    steps:
                      - assign3:
                          assign:
                            - "": \${log("Hello from branch 3")}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('calls subworkflows by name', () => {
    const code = `
    function main() {
      parallel([branch1, branch2]);
    }

    function branch1() {
      return "A";
    }

    function branch2() {
      return "B";
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - parallel1:
            parallel:
              branches:
                - branch1:
                    steps:
                      - call1:
                          call: branch1
                - branch2:
                    steps:
                      - call2:
                          call: branch2

    branch1:
      steps:
        - return1:
            return: "A"

    branch2:
      steps:
        - return2:
            return: "B"
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('handles optional shared variables parameter', () => {
    const code = `
    function main() {
      const results = {};

      parallel([
        () => {
          results.branch1 = "hello from branch 1";
        },
        () => {
          results.branch2 = "hello from branch 2";
        },
      ],
      { shared: ["results"] });
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - results: {}
        - parallel1:
            parallel:
              shared:
                - results
              branches:
                - branch1:
                    steps:
                      - assign2:
                          assign:
                            - results.branch1: hello from branch 1
                - branch2:
                    steps:
                      - assign3:
                          assign:
                            - results.branch2: hello from branch 2
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('handles optional shared variables, exception policy and concurrency limit', () => {
    const code = `
    function main() {
      const results = {};

      parallel([
        () => {
          results.branch1 = "hello from branch 1";
        },
        () => {
          results.branch2 = "hello from branch 2";
        },
      ], {
        shared: ["results"],
        exception_policy: "continueAll",
        concurrency_limit: 2
      });
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - results: {}
        - parallel1:
            parallel:
              shared:
                - results
              concurrency_limit: 2
              exception_policy: continueAll
              branches:
                - branch1:
                    steps:
                      - assign2:
                          assign:
                            - results.branch1: hello from branch 1
                - branch2:
                    steps:
                      - assign3:
                          assign:
                            - results.branch2: hello from branch 2
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('rejects invalid types in optional parameters', () => {
    const code = `
    function main() {
      parallel([branch1, branch2], {
        concurrency_limit: true
      });
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('outputs parallel iteration if called with a for..of loop in an arrow function', () => {
    const code = `
    function main() {
      const total = 0;

      parallel(
        () => {
          for (const accountId of ['11', '22', '33', '44']) {
            total += getBalance(acccountId);
          }
        },
        { shared: ["total"] }
      );
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - total: 0
        - parallel1:
            parallel:
              shared:
                - total
              for:
                value: accountId
                in:
                  - "11"
                  - "22"
                  - "33"
                  - "44"
                steps:
                  - assign2:
                      assign:
                        - total: \${total + getBalance(acccountId)}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('throws if an arrow function contains something else in addition to a for loop', () => {
    const code = `
    function main() {
      const total = 0;

      parallel(
        () => {
          for (const accountId of ['11', '22', '33', '44']) {
            total += getBalance(acccountId);
          }

          total += 1000
        },
        { shared: ["total"] }
      );
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('throws if an arrow function contains something else besides a for loop', () => {
    const code = `
    function main() {
      const total = 0;

      parallel(
        () => { total = 1 },
        { shared: ["total"] }
      );
    }`

    expect(() => transpile(code)).to.throw()
  })
})

describe('Runtime functions', () => {
  it('or_else', () => {
    const code = `
    function main(x) {
      return or_else(x, 0);
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      params:
        - x
      steps:
        - return1:
            return: \${default(x, 0)}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('choose', () => {
    const code = `
    function main(x) {
      return choose(x, "x is true", "x is false");
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      params:
        - x
      steps:
        - return1:
            return: \${if(x, "x is true", "x is false")}
    `) as unknown

    expect(observed).to.deep.equal(expected)
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
      const code = fs.readFileSync(`${samplesdir}/${file}`, {
        encoding: 'utf-8',
      })

      expect(() => transpile(code)).not.to.throw()
    })
  })
})
