import { expect } from 'chai'
import * as YAML from 'yaml'
import * as fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import { transpile } from '../src/transpiler/index.js'

describe('Import statement', () => {
  it('accepts named import declaration on the top-level', () => {
    const code = `
    import { http } from 'workflowlib'
    import { http, sys } from 'workflowlib'`

    expect(() => transpile(code)).not.to.throw()
  })

  it('accepts side-effecting imports on the top-level', () => {
    const code = `import 'module'`

    expect(() => transpile(code)).not.to.throw()
  })

  it('throws on default import', () => {
    const code = `import myDefault from 'module'`

    expect(() => transpile(code)).to.throw()
  })

  it('throws on namespace import', () => {
    const code = `import * as sys from 'sys'`

    expect(() => transpile(code)).to.throw()
  })
})

describe('Type annotations', () => {
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
})

describe('Function definition', () => {
  it('accepts "export function"', () => {
    const code = `export function main() { return 1; }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - return1:
            return: 1
    `) as unknown

    expect(observed).to.deep.equal(expected)
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
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
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
    `) as unknown

    expect(observed).to.deep.equal(expected)
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

  it('transpiles blocking functions as call steps', () => {
    const code = `function main() {
      sys.log(undefined, "ERROR", "Something bad happened");
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - call_sys_log_1:
            call: sys.log
            args:
              text: Something bad happened
              severity: ERROR
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('assigns the return value of a blocking function call (variable declaration)', () => {
    const code = `function main() {
      const response = http.get("https://visit.dreamland.test/");
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - call_http_get_1:
            call: http.get
            args:
              url: https://visit.dreamland.test/
            result: response
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('assigns the return value of a blocking function call (assignment)', () => {
    const code = `function main() {
      let response;
      response = http.get("https://visit.dreamland.test/");
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - call_http_get_1:
            call: http.get
            args:
              url: https://visit.dreamland.test/
            result: __temp0
        - assign1:
            assign:
              - response:
              - response: \${__temp0}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('assigns the return value of a blocking function call to a complex variable', () => {
    const code = `function main() {
      const results = {};
      results.response = http.get("https://visit.dreamland.test/");
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - call_http_get_1:
            call: http.get
            args:
              url: https://visit.dreamland.test/
            result: __temp0
        - assign1:
            assign:
              - results: {}
              - results.response: \${__temp0}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('creates call steps for blocking calls in a condition', () => {
    const code = `function check_post_result() {
      if (http.post("https://visit.dreamland.test/").code === 200) {
        return "ok"
      } else {
        return "error"
      }
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    check_post_result:
      steps:
        - call_http_post_1:
            call: http.post
            args:
              url: https://visit.dreamland.test/
            result: __temp0
        - switch1:
            switch:
              - condition: \${__temp0.code == 200}
                steps:
                  - return1:
                      return: ok
              - condition: true
                steps:
                  - return2:
                      return: error
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('creates call steps for blocking calls in a nested scopes', () => {
    const code = `function scopes() {
      result = {}
      result.outer = http.get("https://visit.dreamland.test/outer.html")
      if (result.outer.code === 200) {
        try {
          return http.get("https://visit.dreamland.test/inner.html")
        } catch (e) {
          return "exception"
        }
      } else {
        return "error"
      }
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    scopes:
      steps:
        - call_http_get_1:
            call: http.get
            args:
              url: https://visit.dreamland.test/outer.html
            result: __temp0
        - assign1:
            assign:
            - result: {}
            - result.outer: \${__temp0}
        - switch1:
            switch:
              - condition: \${result.outer.code == 200}
                steps:
                  - try1:
                      try:
                        steps:
                          - call_http_get_2:
                              call: http.get
                              args:
                                url: https://visit.dreamland.test/inner.html
                              result: __temp0
                          - return1:
                              return: \${__temp0}
                      except:
                        as: e
                        steps:
                          - return2:
                              return: exception
              - condition: true
                steps:
                  - return3:
                      return: error
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('creates call steps for blocking calls in return expressions', () => {
    const code = `function download() {
      return http.get("https://visit.dreamland.test/")
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    download:
      steps:
        - call_http_get_1:
            call: http.get
            args:
              url: https://visit.dreamland.test/
            result: __temp0
        - return1:
            return: \${__temp0}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('creates call steps for blocking calls in complex expressions', () => {
    const code = `function location() {
      return "response:" + \
        map.get(http.get("https://visit.dreamland.test/elfo.html"), "body") + \
        http.get("https://visit.dreamland.test/luci.html").body
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    location:
      steps:
        - call_http_get_1:
            call: http.get
            args:
              url: https://visit.dreamland.test/elfo.html
            result: __temp0
        - call_http_get_2:
            call: http.get
            args:
              url: https://visit.dreamland.test/luci.html
            result: __temp1
        - return1:
            return: \${"response:" + map.get(__temp0, "body") + __temp1.body}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('creates call steps for nested blocking calls', () => {
    const code = `function nested() {
      return http.get(http.get(http.get("https://example.com/redirected.json").body).body)
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    nested:
      steps:
        - call_http_get_1:
            call: http.get
            args:
              url: https://example.com/redirected.json
            result: __temp0
        - call_http_get_2:
            call: http.get
            args:
              url: \${__temp0.body}
            result: __temp1
        - call_http_get_3:
            call: http.get
            args:
              url: \${__temp1.body}
            result: __temp2
        - return1:
            return: \${__temp2.body}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('call_step() outputs a call step', () => {
    const code = `function main() {
      call_step(sys.log, {
        json: {"message": "Meow. That's what cats say, right?"},
        severity: "DEBUG"
      })
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - call_sys_log_1:
            call: sys.log
            args:
              json:
                message: Meow. That's what cats say, right?
              severity: DEBUG
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('call_step() with a return value', () => {
    const code = `function main() {
      const response = call_step(http.post, {
        url: "https://visit.dreamland.test/",
        body: {
          "user": "bean"
        }
      })
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - call_http_post_1:
            call: http.post
            args:
              url: https://visit.dreamland.test/
              body:
                user: bean
            result: response
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('call_step() without arguments', () => {
    const code = `function main() {
      const timestamp = call_step(sys.now)
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - call_sys_now_1:
            call: sys.now
            args: {}
            result: timestamp
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

  it('variable definition without initial value is treated as null assignment', () => {
    const code = `function main() {
      let a;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - a: null
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })
})

describe('If statement', () => {
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
                  - call_sys_log_1:
                      call: sys.log
                      args:
                        data: positive
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

describe('Switch statement', () => {
  it('switch statement', () => {
    const code = `
    function main(person: string): string {
      let country: string;
      switch (person) {
        case "Bean":
        case "Zøg":
          country = "Dreamland";
          break;

        case "Merkimer":
          country = "Bentwood";
          break;

        default:
          country = "unknown";
      }

      return country;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      params:
        - person
      steps:
        - assign1:
            assign:
              - country: null
        - switch1:
            switch:
              - condition: \${person == "Bean"}
                next: assign2
              - condition: \${person == "Zøg"}
                next: assign2
              - condition: \${person == "Merkimer"}
                next: assign3
              - condition: true
                next: assign4
        - assign2:
            assign:
              - country: Dreamland
        - next1:
            next: return1
        - assign3:
            assign:
              - country: Bentwood
        - next2:
            next: return1
        - assign4:
            assign:
              - country: unknown
        - return1:
            return: \${country}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('switch statement as the last statement in a block', () => {
    const code = `
    function main(person: string): string {
      let country: string;
      switch (person) {
        case "Bean":
        case "Zøg":
          country = "Dreamland";
          break;

        case "Merkimer":
          country = "Bentwood";
          break;

        default:
          country = "unknown";
      }
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      params:
        - person
      steps:
        - assign1:
            assign:
              - country: null
        - switch1:
            switch:
              - condition: \${person == "Bean"}
                next: assign2
              - condition: \${person == "Zøg"}
                next: assign2
              - condition: \${person == "Merkimer"}
                next: assign3
              - condition: true
                next: assign4
        - assign2:
            assign:
              - country: Dreamland
        - next1:
            next: end
        - assign3:
            assign:
              - country: Bentwood
        - next2:
            next: end
        - assign4:
            assign:
              - country: unknown
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('switch statement as a last statement in a nested block', () => {
    const code = `
    function main(person: string): string {
      let country: string;
      try {
        switch (person) {
          case "Bean":
          case "Zøg":
            country = "Dreamland";
            break;
  
          case "Merkimer":
            country = "Bentwood";
            break;
  
          default:
            country = "unknown";
        }
      } catch (e) {
        country = "error";
      }

      return country;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      params:
        - person
      steps:
        - assign1:
            assign:
              - country: null
        - try1:
            try:
              steps:
                - switch1:
                    switch:
                      - condition: \${person == "Bean"}
                        next: assign2
                      - condition: \${person == "Zøg"}
                        next: assign2
                      - condition: \${person == "Merkimer"}
                        next: assign3
                      - condition: true
                        next: assign4
                - assign2:
                    assign:
                      - country: Dreamland
                - next1:
                    next: return1
                - assign3:
                    assign:
                      - country: Bentwood
                - next2:
                    next: return1
                - assign4:
                    assign:
                      - country: unknown
            except:
              as: e
              steps:
                - assign5:
                    assign:
                      - country: error
        - return1:
            return: \${country}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('fall-through', () => {
    const code = `
    function main(person: string): string {
      let country: string;
      let royal: boolean = false;

      switch (person) {
        case "Bean":
          royal = true;

        case "Sorcerio":
          country = "Dreamland";
          break;

        default:
          country = "unknown";
      }

      return country;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      params:
        - person
      steps:
        - assign1:
            assign:
              - country: null
              - royal: false
        - switch1:
            switch:
              - condition: \${person == "Bean"}
                next: assign2
              - condition: \${person == "Sorcerio"}
                next: assign3
              - condition: true
                next: assign4
        - assign2:
            assign:
              - royal: true
        - assign3:
            assign:
            - country: Dreamland
        - next1:
            next: return1
        - assign4:
            assign:
              - country: unknown
        - return1:
            return: \${country}
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
                  - call_http_get_1:
                      call: http.get
                      args:
                        url: https://visit.dreamland.test/
                      result: response
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
                  - call_http_get_1:
                      call: http.get
                      args:
                        url: https://visit.dreamland.test/
                      result: response
                  - return1:
                      return: \${response}
              except:
                steps:
                  - assign1:
                      assign:
                        - "": \${log("Error!")}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles try-catch-retry', () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
      retry_policy({ policy: http.default_retry })
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
      main:
        steps:
          - try1:
              try:
                steps:
                  - call_http_get_1:
                      call: http.get
                      args:
                        url: https://visit.dreamland.test/
                      result: response
                  - return1:
                      return: \${response}
              retry: \${http.default_retry}
              except:
                steps:
                  - assign1:
                      assign:
                        - "": \${log("Error!")}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('does retry with a retry predicate and backoff parameters', () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
      retry_policy({
        predicate: http.default_retry_predicate,
        max_retries: 3,
        backoff: { initial_delay: 0.5, max_delay: 60, multiplier: 2.5 }
      })
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
      main:
        steps:
          - try1:
              try:
                steps:
                  - call_http_get_1:
                      call: http.get
                      args:
                        url: https://visit.dreamland.test/
                      result: response
                  - return1:
                      return: \${response}
              retry:
                predicate: \${http.default_retry_predicate}
                max_retries: 3
                backoff:
                  initial_delay: 0.5
                  max_delay: 60
                  multiplier: 2.5
              except:
                steps:
                  - assign1:
                      assign:
                        - "": \${log("Error!")}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('throws if not all custom retry predicate parameters are given', () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
      retry_policy({
        predicate: http.default_retry_predicate,
        max_retries: 3,
        backoff: { max_delay: 60 } // missing initial_delay and multiplier
      })
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('throws if retry is called without arguments', () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
      retry_policy()
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('throws if retry policy is an unexpected data type', () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
      retry_policy({ policy: 1000 })
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('ignores retry that is not immediately after a try block', () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
      } catch {
        log("Error!");
      }

      log("try block completed")


      retry_policy({ policy: http.default_retry })
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
      main:
        steps:
          - try1:
              try:
                steps:
                  - call_http_get_1:
                      call: http.get
                      args:
                        url: https://visit.dreamland.test/
                      result: response
              except:
                steps:
                  - assign1:
                      assign:
                        - "": \${log("Error!")}
          - assign2:
              assign:
                - "": \${log("try block completed")}
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

describe('Loops', () => {
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
                        next: continue
                - assign2:
                    assign:
                      - total: \${total + x}
        - return1:
            return: \${total}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('accepts a continue with a label', () => {
    const code = `
    function main() {
      let total = 0;
      loop: for (const x of [1, 2, 3, 4]) {
        if (x % 2 === 0) {
          continue loop;
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
        - loop:
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
                        next: loop
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
                        next: break
                - assign2:
                    assign:
                      - total: \${total + x}
        - return1:
            return: \${total}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('accepts a break with a label', () => {
    const code = `
    function main() {
      let total = 0;
      loop: for (const x of [1, 2, 3, 4]) {
        if (total > 5) {
          break loop;
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
        - loop:
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
                        next: loop
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

  it('transpiles a while loop', () => {
    const code = `
    function main() {
      const i = 5;
      while (i > 0) {
        i -= 1;
      }
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - i: 5
        - switch1:
            switch:
              - condition: \${i > 0}
                steps:
                  - assign2:
                      assign:
                        - i: \${i - 1}
                  - next1:
                      next: switch1
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a break in a while loop', () => {
    const code = `
    function main() {
      const x = 0.11;
      while (x >= 0) {
        if (x > 0.9) {
          break;
        }

        if (x < 0.5) {
          x *= 2;
        } else {
          x = 2 * (1 - x);
        }
      }

      return x;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - x: 0.11
        - switch3:
            switch:
              - condition: \${x >= 0}
                steps:
                  - switch1:
                      switch:
                        - condition: \${x > 0.9}
                          next: return1
                  - switch2:
                      switch:
                        - condition: \${x < 0.5}
                          steps:
                            - assign2:
                                assign:
                                  - x: \${x * 2}
                        - condition: true
                          steps:
                            - assign3:
                                assign:
                                  - x: \${2 * (1 - x)}
                  - next1:
                      next: switch3
        - return1:
            return: \${x}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a break and a while loop as the statement in a block', () => {
    const code = `
    function main() {
      const x = 0.11;
      while (x >= 0) {
        if (x > 0.9) {
          break;
        }

        if (x < 0.5) {
          x *= 2;
        } else {
          x = 2 * (1 - x);
        }
      }
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - x: 0.11
        - switch3:
            switch:
              - condition: \${x >= 0}
                steps:
                  - switch1:
                      switch:
                        - condition: \${x > 0.9}
                          next: end
                  - switch2:
                      switch:
                        - condition: \${x < 0.5}
                          steps:
                            - assign2:
                                assign:
                                  - x: \${x * 2}
                        - condition: true
                          steps:
                            - assign3:
                                assign:
                                  - x: \${2 * (1 - x)}
                  - next1:
                      next: switch3
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a continue in a while loop', () => {
    const code = `
    function main() {
      const x = 0.11;
      while (x < 0.9) {
        if (x < 0.5) {
          x *= 2;
          continue;
        }

        x = 2 * (1 - x);
      }

      return x;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - x: 0.11
        - switch2:
            switch:
              - condition: \${x < 0.9}
                steps:
                  - switch1:
                      switch:
                        - condition: \${x < 0.5}
                          steps:
                            - assign2:
                                assign:
                                  - x: \${x * 2}
                            - next1:
                                next: switch2
                  - assign3:
                      assign:
                        - x: \${2 * (1 - x)}
                  - next2:
                      next: switch2
        - return1:
            return: \${x}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a do...while loop', () => {
    const code = `
    function main() {
      const i = 5;
      do {
        i -= 1;
      } while (i > 0);
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - i: 5
        - assign2:
            assign:
              - i: \${i - 1}
        - switch1:
            switch:
              - condition: \${i > 0}
                next: assign2
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a break in a do...while loop', () => {
    const code = `
    function main() {
      const x = 0.11;
      do {
        if (x > 0.9) {
          break;
        }

        if (x < 0.5) {
          x *= 2;
        } else {
          x = 2 * (1 - x);
        }
      } while (x >= 0)

      return x;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - x: 0.11
        - switch1:
            switch:
              - condition: \${x > 0.9}
                next: return1
        - switch2:
            switch:
              - condition: \${x < 0.5}
                steps:
                  - assign2:
                      assign:
                        - x: \${x * 2}
              - condition: true
                steps:
                  - assign3:
                      assign:
                        - x: \${2 * (1 - x)}
        - switch3:
            switch:
              - condition: \${x >= 0}
                next: switch1
        - return1:
            return: \${x}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a break and a do...while loop as the last statement in a block', () => {
    const code = `
    function main() {
      const x = 0.11;
      do {
        if (x > 0.9) {
          break;
        }

        if (x < 0.5) {
          x *= 2;
        } else {
          x = 2 * (1 - x);
        }
      } while (x >= 0)
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - x: 0.11
        - switch1:
            switch:
              - condition: \${x > 0.9}
                next: end
        - switch2:
            switch:
              - condition: \${x < 0.5}
                steps:
                  - assign2:
                      assign:
                        - x: \${x * 2}
              - condition: true
                steps:
                  - assign3:
                      assign:
                        - x: \${2 * (1 - x)}
        - switch3:
            switch:
              - condition: \${x >= 0}
                next: switch1
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a break in a do...while loop nested in try statement', () => {
    const code = `
    function main() {
      const x = 0.11;
      try {
        do {
          if (x > 0.9) {
            break;
          }
  
          if (x < 0.5) {
            x *= 2;
          } else {
            x = 2 * (1 - x);
          }
        } while (x >= 0)
      } catch (e) {
        x = -1;
      }

      return x;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - x: 0.11
        - try1:
            try:
              steps:
                - switch1:
                    switch:
                      - condition: \${x > 0.9}
                        next: return1
                - switch2:
                    switch:
                      - condition: \${x < 0.5}
                        steps:
                          - assign2:
                              assign:
                                - x: \${x * 2}
                      - condition: true
                        steps:
                          - assign3:
                              assign:
                                - x: \${2 * (1 - x)}
                - switch3:
                    switch:
                      - condition: \${x >= 0}
                        next: switch1
            except:
              as: e
              steps:
                - assign4:
                    assign:
                      - x: -1
        - return1:
            return: \${x}
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })

  it('transpiles a continue in a do...while loop', () => {
    const code = `
    function main() {
      const x = 0.11;
      do {
        if (x < 0.5) {
          x *= 2;
          continue;
        }

        x = 2 * (1 - x);
      } while (x < 0.9)

      return x;
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    main:
      steps:
        - assign1:
            assign:
              - x: 0.11
        - switch1:
            switch:
              - condition: \${x < 0.5}
                steps:
                  - assign2:
                      assign:
                        - x: \${x * 2}
                  - next1:
                      next: switch1
        - assign3:
            assign:
              - x: \${2 * (1 - x)}
        - switch2:
            switch:
              - condition: \${x < 0.9}
                next: switch1
        - return1:
            return: \${x}
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

describe('Parallel step', () => {
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
                      - call_branch1_1:
                          call: branch1
                - branch2:
                    steps:
                      - call_branch2_1:
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

describe('Labelled statement', () => {
  it('labels steps', () => {
    const code = `
    function signString(x: int): string {
      if (x > 0) {
        positive: return "x is positive"
      } else {
        nonpositive: return "x is not positive"
      }
    }`
    const observed = YAML.parse(transpile(code)) as unknown

    const expected = YAML.parse(`
    signString:
      params:
        - x
      steps:
        - switch1:
            switch:
              - condition: \${x > 0}
                steps:
                  - positive:
                      return: x is positive
              - condition: true
                steps:
                  - nonpositive:
                      return: x is not positive
    `) as unknown

    expect(observed).to.deep.equal(expected)
  })
})

describe('Sample source files', () => {
  const samplesdir = './samples'

  it('type checks samples files', () => {
    const res = spawnSync('tsc', [
      '--project',
      'samples/tsconfig.workflows.json',
    ])
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
