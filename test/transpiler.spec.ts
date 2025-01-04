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

describe('Call statement', () => {
  it('assignment of a function call result', () => {
    const code = 'function main() { const name = getName(); }'

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - name: \${getName()}
    `

    assertTranspiled(code, expected)
  })

  it('assignment of a function call result with anonymous parameters', () => {
    const code = 'function main() { const three = add(1, 2); }'

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - three: \${add(1, 2)}
    `

    assertTranspiled(code, expected)
  })

  it('assignment of a scoped function call result', () => {
    const code = `function main() {
      const projectId = sys.get_env("GOOGLE_CLOUD_PROJECT_ID");
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - projectId: \${sys.get_env("GOOGLE_CLOUD_PROJECT_ID")}
    `

    assertTranspiled(code, expected)
  })

  it('side effecting function call', () => {
    const code = 'function main() { writeLog("Everything going OK!"); }'

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp: \${writeLog("Everything going OK!")}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles blocking functions as call steps', () => {
    const code = `function main() {
      sys.log(undefined, "ERROR", "Something bad happened");
    }`

    const expected = `
    main:
      steps:
        - call_sys_log_1:
            call: sys.log
            args:
              text: Something bad happened
              severity: ERROR
    `

    assertTranspiled(code, expected)
  })

  it('assigns the return value of a blocking function call (variable declaration)', () => {
    const code = `function main() {
      const response = http.get("https://visit.dreamland.test/");
    }`

    const expected = `
    main:
      steps:
        - call_http_get_1:
            call: http.get
            args:
              url: https://visit.dreamland.test/
            result: response
    `

    assertTranspiled(code, expected)
  })

  it('assigns the return value of a blocking function call (assignment)', () => {
    const code = `function main() {
      let response;
      response = http.get("https://visit.dreamland.test/");
    }`

    const expected = `
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
    `

    assertTranspiled(code, expected)
  })

  it('assigns the return value of a blocking function call to a complex variable', () => {
    const code = `function main() {
      const results = {};
      results.response = http.get("https://visit.dreamland.test/");
    }`

    const expected = `
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
    `

    assertTranspiled(code, expected)
  })

  it('creates call steps for blocking calls in a condition', () => {
    const code = `function check_post_result() {
      if (http.post("https://visit.dreamland.test/").code === 200) {
        return "ok"
      } else {
        return "error"
      }
    }`

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
  })

  it('creates call steps for blocking calls in return expressions', () => {
    const code = `function download() {
      return http.get("https://visit.dreamland.test/")
    }`

    const expected = `
    download:
      steps:
        - call_http_get_1:
            call: http.get
            args:
              url: https://visit.dreamland.test/
            result: __temp0
        - return1:
            return: \${__temp0}
    `

    assertTranspiled(code, expected)
  })

  it('creates call steps for blocking calls in complex expressions', () => {
    const code = `function location() {
      return "response:" + \
        map.get(http.get("https://visit.dreamland.test/elfo.html"), "body") + \
        http.get("https://visit.dreamland.test/luci.html").body
    }`

    const expected = `
    location:
      steps:
        - call_http_get_1:
            call: http.get
            args:
              url: https://visit.dreamland.test/elfo.html
            result: __temp1
        - call_http_get_2:
            call: http.get
            args:
              url: https://visit.dreamland.test/luci.html
            result: __temp2
        - return1:
            return: \${"response:" + map.get(__temp1, "body") + __temp2.body}
    `

    assertTranspiled(code, expected)
  })

  it('creates call steps for nested blocking calls', () => {
    const code = `function nested() {
      return http.get(http.get(http.get("https://example.com/redirected.json").body).body)
    }`

    const expected = `
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
            return: \${__temp2}
    `

    assertTranspiled(code, expected)
  })

  it('creates call steps for a nested blocking nested in non-blocking calls', () => {
    const code = `function nested() {
      return map.get(map.get(http.get("https://example.com/redirected.json"), "body"), "value")
    }`

    const expected = `
    nested:
      steps:
        - call_http_get_1:
            call: http.get
            args:
              url: https://example.com/redirected.json
            result: __temp3
        - return1:
            return: \${map.get(map.get(__temp3, "body"), "value")}
    `

    assertTranspiled(code, expected)
  })

  it('call_step() outputs a call step', () => {
    const code = `function main() {
      call_step(sys.log, {
        json: {"message": "Meow. That's what cats say, right?"},
        severity: "DEBUG"
      })
    }`

    const expected = `
    main:
      steps:
        - call_sys_log_1:
            call: sys.log
            args:
              json:
                message: Meow. That's what cats say, right?
              severity: DEBUG
    `

    assertTranspiled(code, expected)
  })

  it('call_step() outputs a call step 2', () => {
    const code = `function main() {
      call_step(sys.log, {
        json: {data: {name: "Oona", occupations: ["queen", "pirate"]}},
        severity: "INFO"
      })
    }`

    const expected = `
    main:
      steps:
        - call_sys_log_1:
            call: sys.log
            args:
              json:
                data:
                  name: Oona
                  occupations:
                    - queen
                    - pirate
              severity: INFO
    `

    assertTranspiled(code, expected)
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

    const expected = `
    main:
      steps:
        - call_http_post_1:
            call: http.post
            args:
              url: https://visit.dreamland.test/
              body:
                user: bean
            result: response
    `

    assertTranspiled(code, expected)
  })

  it('call_step() with a return value assigned to a member variable', () => {
    const code = `function main() {
      const data = {}
      data.response = call_step(http.post, {
        url: "https://visit.dreamland.test/",
        body: {
          "user": "bean"
        }
      })
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - data: {}
        - call_http_post_1:
            call: http.post
            args:
              url: https://visit.dreamland.test/
              body:
                user: bean
            result: __temp
        - assign2:
            assign:
              - data.response: \${__temp}
    `

    assertTranspiled(code, expected)
  })

  it('call_step() without arguments', () => {
    const code = `function main() {
      const timestamp = call_step(sys.now)
    }`

    const expected = `
    main:
      steps:
        - call_sys_now_1:
            call: sys.now
            args: {}
            result: timestamp
    `

    assertTranspiled(code, expected)
  })
})

describe('Assignment statement', () => {
  it('transpiles a const assignment', () => {
    const code = 'function main() { const a = 1; }'

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - a: 1
    `

    assertTranspiled(code, expected)
  })

  it('transpiles a let assignment', () => {
    const code = 'function main() { let a = 1; }'

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - a: 1
    `

    assertTranspiled(code, expected)
  })

  it('transpiles a var assignment', () => {
    const code = 'function main() { var a = 1; }'

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - a: 1
    `

    assertTranspiled(code, expected)
  })

  it('transpiles an assignment expression', () => {
    const code = 'function main() { let a; a = 1; }'

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - a: null
              - a: 1
    `

    assertTranspiled(code, expected)
  })

  it('property assignment', () => {
    const code = 'function main() { person.name = "Bean"; }'

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - person.name: Bean
    `

    assertTranspiled(code, expected)
  })

  it('member expression with map literal body', () => {
    const code = `function main() {
      return { "value": 111 }.value;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp0:
                  value: 111
        - return1:
            return: \${__temp0.value}
    `

    assertTranspiled(code, expected)
  })

  it('deep member expression with map literal body', () => {
    const code = `function main() {
      return { temperature: { value: 18, unit: "Celsius" } }.temperature.value;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp0:
                  temperature:
                    value: 18
                    unit: Celsius
        - return1:
            return: \${__temp0.temperature.value}
    `

    assertTranspiled(code, expected)
  })

  it('member expression with function call body', () => {
    const code = `function main() { const res = get_object().value; }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - res: \${get_object().value}
    `

    assertTranspiled(code, expected)
  })

  it('map literal in an assignment step', () => {
    const code = `function main() {
      const a = ({code: 56} as {code: number}).code
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp0:
                  code: 56
              - a: \${__temp0.code}
    `

    assertTranspiled(code, expected)
  })

  it('map literal as function argument', () => {
    const code = `function main() {
      return get_friends({"name": "Bean"});
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp0:
                  name: Bean
        - return1:
            return: \${get_friends(__temp0)}
    `

    assertTranspiled(code, expected)
  })

  it('nested map literal and functions', () => {
    const code = `function main() {
      const data = {friends: get_friends({name: "Bean"})};
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp0:
                  name: Bean
              - data:
                  friends: \${get_friends(__temp0)}
    `

    assertTranspiled(code, expected)
  })

  it('nested map literal and functions 2', () => {
    const code = `function main() {
      const data = {
        characters: [
          get_character({name: "Bean"}),
          get_character({name: "Elfo"}),
        ]
      };
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp0:
                  name: Bean
              - __temp1:
                  name: Elfo
              - data:
                  characters:
                    - \${get_character(__temp0)}
                    - \${get_character(__temp1)}
    `

    assertTranspiled(code, expected)
  })

  it('nested map literal and functions 3', () => {
    const code = `function main() {
      const data = [
        {
          name: get_name({personId: 1})
        }
      ];
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp0:
                  personId: 1
              - data:
                  - name: \${get_name(__temp0)}
    `

    assertTranspiled(code, expected)
  })

  it('deeply nested map literal and functions', () => {
    const code = `function main() {
      const data = {
        friends: get_friends({name: get_name({personId: 1})})
      };
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp0:
                  personId: 1
              - __temp1:
                  name: \${get_name(__temp0)}
              - data:
                  friends: \${get_friends(__temp1)}
    `

    assertTranspiled(code, expected)
  })

  it('deeply nested map literal and functions 2', () => {
    const code = `function main() {
      const data = {
        friends: get_friends([
          {name: get_name({personId: 1})},
          {name: get_name({personId: 2})}
        ])
      };
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp0:
                  personId: 1
              - __temp1:
                  name: \${get_name(__temp0)}
              - __temp2:
                  personId: 2
              - __temp3:
                  name: \${get_name(__temp2)}
              - data:
                  friends: \${get_friends([__temp1, __temp3])}
    `

    assertTranspiled(code, expected)
  })

  it('map literal in complex expression', () => {
    const code = `function complex() {
      const codes = { success: "OK" }
      try {
        if (2*({value: 5}.value + 10) > 0) {
          return codes[{status: "success"}.status]
        }
      } catch {
        return "error"
      }
    }`

    const expected = `
    complex:
      steps:
        - assign1:
            assign:
              - codes:
                  success: OK
        - try1:
            try:
              steps:
                - assign2:
                    assign:
                      - __temp0:
                          value: 5
                - switch1:
                    switch:
                      - condition: \${2 * (__temp0.value + 10) > 0}
                        steps:
                          - assign3:
                              assign:
                                - __temp0:
                                    status: success
                          - return1:
                              return: \${codes[__temp0.status]}
            except:
              steps:
                - return2:
                    return: error
    `

    assertTranspiled(code, expected)
  })

  it('extracts nested map only on one branches of combined assing step', () => {
    const code = `function main() {
      const data = {friends: get_friends({name: "Bean"})};
      const data2 = {person: {name: "Bean"}}
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp0:
                  name: Bean
              - data:
                  friends: \${get_friends(__temp0)}
              - data2:
                  person:
                    name: Bean
    `

    assertTranspiled(code, expected)
  })

  it('indexed assignment', () => {
    const code = 'function main() { values[3] = 10; }'

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - values[3]: 10
    `

    assertTranspiled(code, expected)
  })

  it('addition assignment', () => {
    const code = `
    function main() {
      let x = 0;
      x += 5;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - x: 0
              - x: \${x + 5}
    `

    assertTranspiled(code, expected)
  })

  it('addition assignment to a member expression', () => {
    const code = `
    function main() {
      people[4].age += 1;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - people[4].age: \${people[4].age + 1}
    `

    assertTranspiled(code, expected)
  })

  it('addition assignment with a complex expression', () => {
    const code = `
    function main() {
      x += 2 * y + 10;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - x: \${x + 2 * y + 10}
    `

    assertTranspiled(code, expected)
  })

  it('substraction assignment', () => {
    const code = `
    function main() {
      let x = 0;
      x -= 5;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - x: 0
              - x: \${x - 5}
    `

    assertTranspiled(code, expected)
  })

  it('multiplication assignment', () => {
    const code = `
    function main() {
      let x = 1;
      x *= 2;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - x: 1
              - x: \${x * 2}
    `

    assertTranspiled(code, expected)
  })

  it('division assignment', () => {
    const code = `
    function main() {
      let x = 10;
      x /= 2;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - x: 10
              - x: \${x / 2}
    `

    assertTranspiled(code, expected)
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

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - a: {}
              - b: test
              - c: 12
              - d: \${c + 1}
              - a.id: "1"
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
  })

  it('variable definition without initial value is treated as null assignment', () => {
    const code = `function main() {
      let a;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - a: null
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
  })

  it('if with a non-block statement', () => {
    const code = `
    function main(x) {
      if (x > 0)
        return "positive";
      else
        return "non-positive";
    }`

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
            next: return1
        - assign3:
            assign:
              - country: Bentwood
            next: return1
        - assign4:
            assign:
              - country: unknown
        - return1:
            return: \${country}
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
            next: end
        - assign3:
            assign:
              - country: Bentwood
            next: end
        - assign4:
            assign:
              - country: unknown
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
                    next: return1
                - assign3:
                    assign:
                      - country: Bentwood
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
            next: return1
        - assign4:
            assign:
              - country: unknown
        - return1:
            return: \${country}
    `

    assertTranspiled(code, expected)
  })
})

describe('Return statement', () => {
  it('return statement without a value', () => {
    const code = `function main() { return; }`

    const expected = `
    main:
      steps:
        - return1:
            next: end
    `

    assertTranspiled(code, expected)
  })

  it('return a literal value', () => {
    const code = `function main() { return "OK"; }`

    const expected = `
    main:
      steps:
        - return1:
            return: OK
    `

    assertTranspiled(code, expected)
  })

  it('return an expression', () => {
    const code = `function addOne(x) { return x + 1; }`

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

  it('return a map', () => {
    const code = `function main() { return { result: "OK", value: 1 }; }`

    const expected = `
    main:
      steps:
        - return1:
            return:
              result: OK
              value: 1
    `

    assertTranspiled(code, expected)
  })

  it('return a list of maps', () => {
    const code = `function main() { return [ { result: "OK", value: 1 } ]; }`

    const expected = `
    main:
      steps:
        - return1:
            return:
              -
                result: OK
                value: 1
    `

    assertTranspiled(code, expected)
  })

  it('return a variable reference inside a map', () => {
    const code = `function main(x) { return { value: x }; }`

    const expected = `
    main:
      params:
        - x
      steps:
        - return1:
            return:
              value: \${x}
    `

    assertTranspiled(code, expected)
  })

  it('return a member of a map', () => {
    const code = `function main() { return {value: 5}.value; }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp0:
                  value: 5
        - return1:
            return: \${__temp0.value}
    `

    assertTranspiled(code, expected)
  })
})

describe('Try-catch-finally statement', () => {
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
                        - __temp: \${log("Error!")}
    `

    assertTranspiled(code, expected)
  })

  it('empty catch block', () => {
    const code = `
    function main() {
      try {
        throw 1;
      } catch {}
    }`

    const expected = `
      main:
        steps:
          - try1:
              try:
                steps:
                  - raise1:
                      raise: 1
              except:
                steps: []
    `

    assertTranspiled(code, expected)
  })

  it('transpiles try-catch-finally statement', () => {
    const code = `
    function safeWrite(data) {
      try {
        writeData(data);
      } catch (err) {
        sys.log(err);
      } finally {
        closeConnection();
      }
    }`

    const expected = `
      safeWrite:
        params:
          - data
        steps:
          - try1:
              try:
                steps:
                  - try2:
                      try:
                        steps:
                          - assign1:
                              assign:
                                - __temp: \${writeData(data)}
                      except:
                        as: err
                        steps:
                          - call_sys_log_1:
                              call: sys.log
                              args:
                                data: \${err}
                  - assign2:
                      assign:
                        - __fin_exc:
                            t2w_finally_tag: "no exception"
                      next: assign3
              except:
                as: __fin_exc
                steps:
                  - assign3:
                      assign:
                        - __temp: \${closeConnection()}
                  - switch1:
                      switch:
                        - condition: \${map.get(__fin_exc, "t2w_finally_tag") == "no exception and return"}
                          steps:
                            - return1:
                                return: \${map.get(__fin_exc, "value")}
                        - condition: \${map.get(__fin_exc, "t2w_finally_tag") != "no exception"}
                          steps:
                            - raise1:
                                raise: \${__fin_exc}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles try-catch-finally statement with a return statement in the try block', () => {
    const code = `
    function safeWrite(data) {
      try {
        writeData(data);
        return "OK";
      } catch (err) {
        sys.log(err);
      } finally {
        closeConnection();
      }
    }`

    const expected = `
      safeWrite:
        params:
          - data
        steps:
          - try1:
              try:
                steps:
                  - try2:
                      try:
                        steps:
                          - assign1:
                              assign:
                                - __temp: \${writeData(data)}
                                - __fin_exc:
                                    t2w_finally_tag: "no exception and return"
                                    value: OK
                              next: assign3
                      except:
                        as: err
                        steps:
                          - call_sys_log_1:
                              call: sys.log
                              args:
                                data: \${err}
                  - assign2:
                      assign:
                        - __fin_exc:
                            t2w_finally_tag: "no exception"
                      next: assign3
              except:
                as: __fin_exc
                steps:
                  - assign3:
                      assign:
                        - __temp: \${closeConnection()}
                  - switch1:
                      switch:
                        - condition: \${map.get(__fin_exc, "t2w_finally_tag") == "no exception and return"}
                          steps:
                            - return1:
                                return: \${map.get(__fin_exc, "value")}
                        - condition: \${map.get(__fin_exc, "t2w_finally_tag") != "no exception"}
                          steps:
                            - raise1:
                                raise: \${__fin_exc}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles try-catch-finally statement with a return statement in the catch block', () => {
    const code = `
    function safeWrite(data) {
      try {
        writeData(data);
      } catch (err) {
        sys.log(err);
        return "Error!"
      } finally {
        closeConnection();
      }
    }`

    const expected = `
      safeWrite:
        params:
          - data
        steps:
          - try1:
              try:
                steps:
                  - try2:
                      try:
                        steps:
                          - assign1:
                              assign:
                                - __temp: \${writeData(data)}
                      except:
                        as: err
                        steps:
                          - call_sys_log_1:
                              call: sys.log
                              args:
                                data: \${err}
                          - assign2:
                              assign:
                                - __fin_exc:
                                    t2w_finally_tag: "no exception and return"
                                    value: Error!
                              next: assign4
                  - assign3:
                      assign:
                        - __fin_exc:
                            t2w_finally_tag: "no exception"
                      next: assign4
              except:
                as: __fin_exc
                steps:
                  - assign4:
                      assign:
                        - __temp: \${closeConnection()}
                  - switch1:
                      switch:
                        - condition: \${map.get(__fin_exc, "t2w_finally_tag") == "no exception and return"}
                          steps:
                            - return1:
                                return: \${map.get(__fin_exc, "value")}
                        - condition: \${map.get(__fin_exc, "t2w_finally_tag") != "no exception"}
                          steps:
                            - raise1:
                                raise: \${__fin_exc}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles try-catch-finally statement with a return statement in the finally block', () => {
    const code = `
    function safeWrite(data) {
      try {
        writeData(data);
      } catch (err) {
        sys.log(err);
      } finally {
        closeConnection();
        return 0;
      }
    }`

    const expected = `
      safeWrite:
        params:
          - data
        steps:
          - try1:
              try:
                steps:
                  - try2:
                      try:
                        steps:
                          - assign1:
                              assign:
                                - __temp: \${writeData(data)}
                      except:
                        as: err
                        steps:
                          - call_sys_log_1:
                              call: sys.log
                              args:
                                data: \${err}
                  - assign2:
                      assign:
                        - __fin_exc:
                            t2w_finally_tag: "no exception"
                      next: assign3
              except:
                as: __fin_exc
                steps:
                  - assign3:
                      assign:
                        - __temp: \${closeConnection()}
                  - return1:
                      return: 0
                  - switch1:
                      switch:
                        - condition: \${map.get(__fin_exc, "t2w_finally_tag") == "no exception and return"}
                          steps:
                            - return2:
                                return: \${map.get(__fin_exc, "value")}
                        - condition: \${map.get(__fin_exc, "t2w_finally_tag") != "no exception"}
                          steps:
                            - raise1:
                                raise: \${__fin_exc}
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
                        - __temp: \${log("Error!")}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles try-catch-retry-finally', () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      } finally {
        closeConnection();
      }
      retry_policy({ policy: http.default_retry })
    }`

    const expected = `
      main:
        steps:
          - try1:
              try:
                steps:
                  - try2:
                      try:
                        steps:
                          - call_http_get_1:
                              call: http.get
                              args:
                                url: https://visit.dreamland.test/
                              result: response
                          - assign1:
                              assign:
                                - __fin_exc:
                                    t2w_finally_tag: no exception and return
                                    value: \${response}
                              next: assign4
                      retry: \${http.default_retry}
                      except:
                        steps:
                          - assign2:
                              assign:
                                - __temp: \${log("Error!")}
                  - assign3:
                      assign:
                        - __fin_exc:
                            t2w_finally_tag: "no exception"
                      next: assign4
              except:
                as: __fin_exc
                steps:
                  - assign4:
                      assign:
                        - __temp: \${closeConnection()}
                  - switch1:
                      switch:
                        - condition: \${map.get(__fin_exc, "t2w_finally_tag") == "no exception and return"}
                          steps:
                            - return1:
                                return: \${map.get(__fin_exc, "value")}
                        - condition: \${map.get(__fin_exc, "t2w_finally_tag") != "no exception"}
                          steps:
                            - raise1:
                                raise: \${__fin_exc}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles try-finally without a catch block', () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } finally {
        closeConnection();
      }
    }`

    const expected = `
      main:
        steps:
          - try1:
              try:
                steps:
                  - try2:
                      try:
                        steps:
                          - call_http_get_1:
                              call: http.get
                              args:
                                url: https://visit.dreamland.test/
                              result: response
                          - assign1:
                              assign:
                                - __fin_exc:
                                    t2w_finally_tag: no exception and return
                                    value: \${response}
                              next: assign3
                  - assign2:
                      assign:
                        - __fin_exc:
                            t2w_finally_tag: "no exception"
                      next: assign3
              except:
                as: __fin_exc
                steps:
                  - assign3:
                      assign:
                        - __temp: \${closeConnection()}
                  - switch1:
                      switch:
                        - condition: \${map.get(__fin_exc, "t2w_finally_tag") == "no exception and return"}
                          steps:
                            - return1:
                                return: \${map.get(__fin_exc, "value")}
                        - condition: \${map.get(__fin_exc, "t2w_finally_tag") != "no exception"}
                          steps:
                            - raise1:
                                raise: \${__fin_exc}
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
                        - __temp: \${log("Error!")}
    `

    assertTranspiled(code, expected)
  })

  it('retries with a custom predicate', () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
      retry_policy({
        predicate: custom_predicate,
        max_retries: 3,
        backoff: { initial_delay: 0.5, max_delay: 60, multiplier: 2.5 }
      })
    }

    function custom_predicate(e) {
      return false
    }`

    const expected = `
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
                predicate: \${custom_predicate}
                max_retries: 3
                backoff:
                  initial_delay: 0.5
                  max_delay: 60
                  multiplier: 2.5
              except:
                steps:
                  - assign1:
                      assign:
                        - __temp: \${log("Error!")}
      custom_predicate:
        params:
          - e
        steps:
          - return2:
              return: false
    `

    assertTranspiled(code, expected)
  })

  it('retry policy with numeric expressions', () => {
    const code = `
    function main() {
      const multiplier = 2;

      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
      retry_policy({
        predicate: http.default_retry_predicate,
        max_retries: sys.get_env("MAX_RETRIES"),
        backoff: { initial_delay: 0.5, max_delay: 60, multiplier: multiplier }
      })
    }`

    const expected = `
      main:
        steps:
          - assign1:
              assign:
                - multiplier: 2
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
                max_retries: \${sys.get_env("MAX_RETRIES")}
                backoff:
                  initial_delay: 0.5
                  max_delay: 60
                  multiplier: \${multiplier}
              except:
                steps:
                  - assign2:
                      assign:
                        - __temp: \${log("Error!")}
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
                        - __temp: \${log("Error!")}
          - assign2:
              assign:
                - __temp: \${log("try block completed")}
    `

    assertTranspiled(code, expected)
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

  it("retry_policy() can't be used in expression", () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
      const x = 1 + retry_policy({ policy: http.default_retry })
    }`

    expect(() => transpile(code)).to.throw()
  })
})

describe('Throw statement', () => {
  it('transpiles a throw with a literal string value', () => {
    const code = `function main() { throw "Error!"; }`

    const expected = `
    main:
      steps:
        - raise1:
            raise: "Error!"
    `

    assertTranspiled(code, expected)
  })

  it('transpiles a throw with a literal map value', () => {
    const code = `
    function main() {
      throw {
        code: 98,
        message: "Access denied"
      };
    }`

    const expected = `
    main:
      steps:
        - raise1:
            raise:
              code: 98
              message: "Access denied"
    `

    assertTranspiled(code, expected)
  })

  it('transpiles a throw with a map value that includes a variable reference', () => {
    const code = `
    function main() {
      const errorCode = 98
      throw {
        code: errorCode,
        message: "Access denied"
      };
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - errorCode: 98
        - raise1:
            raise:
              code: \${errorCode}
              message: "Access denied"
    `

    assertTranspiled(code, expected)
  })

  it('transpiles a throw with an expression', () => {
    const code = `function main(exception) { throw exception; }`

    const expected = `
    main:
      params:
        - exception
      steps:
        - raise1:
            raise: \${exception}
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
  })

  it('transpiles a for loop with an empty body', () => {
    const code = `
    function main() {
      for (const x of [1, 2, 3]) {
      }
    }`

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
                      - condition: \${x % 2 == 0}
                        next: continue
                - assign2:
                    assign:
                      - total: \${total + x}
        - return1:
            return: \${total}
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
                      - condition: \${x % 2 == 0}
                        next: loop
                - assign2:
                    assign:
                      - total: \${total + x}
        - return1:
            return: \${total}
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
  })

  it('transpiles a while loop', () => {
    const code = `
    function main() {
      const i = 5;
      while (i > 0) {
        i -= 1;
      }
    }`

    const expected = `
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
                      next: switch1
    `

    assertTranspiled(code, expected)
  })

  it('transpiles a while loop with a single-statement body', () => {
    const code = `
    function main() {
      const i = 5;
      while (i > 0) i -= 1;
    }`

    const expected = `
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
                      next: switch1
    `

    assertTranspiled(code, expected)
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

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - x: 0.11
        - switch1:
            switch:
              - condition: \${x >= 0}
                steps:
                  - switch2:
                      switch:
                        - condition: \${x > 0.9}
                          next: return1
                  - switch3:
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
                      next: switch1
        - return1:
            return: \${x}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles a break and a while loop as the last statement in a block', () => {
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

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - x: 0.11
        - switch1:
            switch:
              - condition: \${x >= 0}
                steps:
                  - switch2:
                      switch:
                        - condition: \${x > 0.9}
                          next: end
                  - switch3:
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
                      next: switch1
    `

    assertTranspiled(code, expected)
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

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - x: 0.11
        - switch1:
            switch:
              - condition: \${x < 0.9}
                steps:
                  - switch2:
                      switch:
                        - condition: \${x < 0.5}
                          steps:
                            - assign2:
                                assign:
                                  - x: \${x * 2}
                                next: switch1
                  - assign3:
                      assign:
                        - x: \${2 * (1 - x)}
                      next: switch1
        - return1:
            return: \${x}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles a do...while loop', () => {
    const code = `
    function main() {
      const i = 5;
      do {
        i -= 1;
      } while (i > 0);
    }`

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
    main:
      steps:
        - parallel1:
            parallel:
              branches:
                - branch1:
                    steps:
                      - assign1:
                          assign:
                            - __temp: \${log("Hello from branch 1")}
                - branch2:
                    steps:
                      - assign2:
                          assign:
                            - __temp: \${log("Hello from branch 2")}
                - branch3:
                    steps:
                      - assign3:
                          assign:
                            - __temp: \${log("Hello from branch 3")}
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
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

  it("the return value of parallel() can't be assigned to a variable", () => {
    const code = `
      function main() {
          const result = parallel([
          () => {
            return "branch 1";
          },
          () => {
            return "branch 2";
          },
        ]);
      }`

    expect(() => transpile(code)).to.throw()
  })

  it("parallel() can't be used in expression", () => {
    const code = `
      function main() {
        const result = "result: " + parallel([
          () => {
            return "branch 1";
          },
          () => {
            return "branch 2";
          },
        ]);
      }
    `

    expect(() => transpile(code)).to.throw()
  })

  it("parallel() can't be used in expression 2", () => {
    const code = `
      function main() {
        return {
          result: parallel([
            () => {
              return "branch 1";
            },
            () => {
              return "branch 2";
            },
          ])
        };
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

    const expected = `
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
    `

    assertTranspiled(code, expected)
  })

  it('takes the first label when combining assignment steps', () => {
    const code = `
    function test() {
      var a = 1
      var b = 2
      setImportantVariable: var c = 3
      setAnotherVariable: var d = 4
    }`

    const expected = `
    test:
      steps:
        - setImportantVariable:
            assign:
              - a: 1
              - b: 2
              - c: 3
              - d: 4
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

function assertTranspiled(code: string, expected: string): void {
  expect(YAML.parse(transpile(code))).to.deep.equal(YAML.parse(expected))
}
