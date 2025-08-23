import { expect } from 'chai'
import { transpileText } from '../src/transpiler/index.js'
import { assertTranspiled } from './testutils.js'
import { WorkflowSyntaxError } from '../src/errors.js'

describe('Function invocation statement', () => {
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

  it('a blocking function call and a map literal in the same expression', () => {
    const code = `function main() {
      const response = combine(http.get("https://visit.dreamland.test/"), {values: [1, 2]}.values[0]);
    }`

    const expected = `
    main:
      steps:
        - call_http_get_1:
            call: http.get
            args:
              url: https://visit.dreamland.test/
            result: __temp1
        - assign1:
            assign:
              - __temp0:
                  values: [1, 2]
              - response: \${combine(__temp1, __temp0.values[0])}
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

  it('call_step() without function arguments', () => {
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

  it('call_step() requires at least a function to be called', () => {
    const code = `function main() {
      const res = call_step()
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects call_step() called with a non-function as the first argument', () => {
    const code = `function main() {
      call_step(5)
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects call_step() called with a non map literal as the second argument', () => {
    const code = `function main() {
      call_step(http.get, 5);
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('complex computed properties are not supported in call_step()', () => {
    const code = `function main() {
      call_step(sys[get_name()]);
    }

    function get_name() {
      return "now"
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('call_step() as part of a complex expression is not yet supported', () => {
    const code = `function main() {
      return call_step(http.get, { url: "https://visit.dreamland.test/" }).data
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('spread syntax is not supported as function call arguments', () => {
    const code = 'function main(values: number[]) { return sum(...values) }'

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects immediately invoked function expression', () => {
    const code = `
    function test() {
      return (() => { return 5 })();
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects a call of a returned function', () => {
    const code = `
    function test() {
      wrapped()();
    }

    function wrapped() {
      return () => 1;
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects a call of a returned function in expression', () => {
    const code = `
    function test() {
      return wrapped()();
    }

    function wrapped() {
      return () => 1;
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects function calls at top level', () => {
    const code = `
    function main() {
      return 1;
    }

    main();
    `

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })
})
