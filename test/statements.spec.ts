import { expect } from 'chai'
import { transpile } from '../src/transpiler/index.js'
import { assertTranspiled } from './testutils.js'

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

  it('creates call steps for blocking calls in for loops', () => {
    const code = `function check_post_result() {
      for (const i of [1, 2, 3]) {
        const res = http.get(\`https://visit.dreamland.test/page-\${i}.html\`)
      }
    }`

    const expected = `
    check_post_result:
      steps:
        - for1:
            for:
              value: i
              in: [1, 2, 3]
              steps:
                - call_http_get_1:
                    call: http.get
                    args:
                      url: \${"https://visit.dreamland.test/page-" + default(i, "null") + ".html"}
                    result: res
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
            result: __temp0
        - call_http_get_2:
            call: http.get
            args:
              url: https://visit.dreamland.test/luci.html
            result: __temp1
        - return1:
            return: \${"response:" + map.get(__temp0, "body") + __temp1.body}
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
            result: __temp0
        - return1:
            return: \${map.get(map.get(__temp0, "body"), "value")}
    `

    assertTranspiled(code, expected)
  })

  it('ignores extra arguments in a blocking function call', () => {
    const code = `function main() {
      sys.sleep(1000, 2000, 3000)
    }`

    const expected = `
    main:
      steps:
        - call_sys_sleep_1:
            call: sys.sleep
            args:
              seconds: 1000
    `

    assertTranspiled(code, expected)
  })

  it('ignores extra arguments in a blocking function call in a nested expression', () => {
    const code = `function main(callbackobj) {
      handle(events.await_callback(callbackobj, 1000, 'a', null, 89))
    }`

    const expected = `
    main:
      params:
        - callbackobj
      steps:
        - call_events_await_callback_1:
            call: events.await_callback
            args:
              callback: \${callbackobj}
              timeout: 1000
            result: __temp0
        - assign1:
            assign:
              - __temp: \${handle(__temp0)}
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
            result: timestamp
    `

    assertTranspiled(code, expected)
  })

  it('rejects function calls at top level', () => {
    const code = `
    function main() {
      return 1;
    }

    main();
    `

    expect(() => transpile(code)).to.throw()
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

  it('if with an empty body', () => {
    const code = `
    function main(x) {
      let isPositive = true;
      if (x > 0) {} else { isPositive = false; }
    }`

    const expected = `
    main:
      params:
        - x
      steps:
        - assign1:
            assign:
              - isPositive: true
        - switch1:
            switch:
              - condition: \${x > 0}
                steps: []
              - condition: true
                steps:
                  - assign2:
                      assign:
                        - isPositive: false
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

describe('Empty statement', () => {
  it('accepts an empty statement in a function', () => {
    const code = `
    function main() {
      ;

      return 1;
    }`

    const expected = `
    main:
      steps:
        - return1:
            return: 1
    `

    assertTranspiled(code, expected)
  })

  it('accepts empty statements at top level', () => {
    const code = `
    ;

    function main() {
      return 1;
    }

    ;
    `

    const expected = `
    main:
      steps:
        - return1:
            return: 1
    `

    assertTranspiled(code, expected)
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
      const a = 1
      const b = 2
      setImportantVariable: const c = 3
      setAnotherVariable: const d = 4
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

  it('temporary variables inside nested parallel steps should have a postfix', () => {
    const code = `
    function main() {
      log("Before parallel")

      parallel([
        () => {
          parallel([
            () => {
              log("Hello from nested branch 1");
            },
            () => {
              log("Hello from nested branch 2");
            },
          ])
        },
        () => {
          log("Hello from branch 3");
        },
      ]);
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp: \${log("Before parallel")}
        - parallel1:
            parallel:
              branches:
                - branch1:
                    steps:
                      - parallel2:
                          parallel:
                            branches:
                              - branch1:
                                  steps:
                                    - assign2:
                                        assign:
                                          - __temp_parallel2: \${log("Hello from nested branch 1")}
                              - branch2:
                                  steps:
                                    - assign3:
                                        assign:
                                          - __temp_parallel2: \${log("Hello from nested branch 2")}
                - branch2:
                    steps:
                      - assign4:
                          assign:
                            - __temp_parallel1: \${log("Hello from branch 3")}
    `

    assertTranspiled(code, expected)
  })
})
