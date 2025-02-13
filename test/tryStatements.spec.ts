import { expect } from 'chai'
import { transpile } from '../src/transpiler/index.js'
import { assertTranspiled } from './testutils.js'

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
          - assign1:
              assign:
                - __t2w_finally_condition1:
                - __t2w_finally_value1:
          - try1:
              try:
                steps:
                  - try2:
                      try:
                        steps:
                          - assign2:
                              assign:
                                - __temp: \${writeData(data)}
                      except:
                        as: err
                        steps:
                          - call_sys_log_1:
                              call: sys.log
                              args:
                                data: \${err}
              except:
                as: __fin_exc
                steps:
                  - assign3:
                      assign:
                        - __t2w_finally_condition1: raise
                        - __t2w_finally_value1: \${__fin_exc}
          - assign4:
              assign:
                - __temp: \${closeConnection()}
          - switch1:
              switch:
                - condition: \${__t2w_finally_condition1 == "return"}
                  steps:
                    - return1:
                        return: \${__t2w_finally_value1}
                - condition: \${__t2w_finally_condition1 == "raise"}
                  steps:
                    - raise1:
                        raise: \${__t2w_finally_value1}
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
          - assign1:
              assign:
                - __t2w_finally_condition1:
                - __t2w_finally_value1:
          - try1:
              try:
                steps:
                  - try2:
                      try:
                        steps:
                          - assign2:
                              assign:
                                - __temp: \${writeData(data)}
                                - __t2w_finally_condition1: return
                                - __t2w_finally_value1: OK
                              next: assign4
                      except:
                        as: err
                        steps:
                          - call_sys_log_1:
                              call: sys.log
                              args:
                                data: \${err}
              except:
                as: __fin_exc
                steps:
                  - assign3:
                      assign:
                        - __t2w_finally_condition1: raise
                        - __t2w_finally_value1: \${__fin_exc}
          - assign4:
              assign:
                - __temp: \${closeConnection()}
          - switch1:
              switch:
                - condition: \${__t2w_finally_condition1 == "return"}
                  steps:
                    - return1:
                        return: \${__t2w_finally_value1}
                - condition: \${__t2w_finally_condition1 == "raise"}
                  steps:
                    - raise1:
                        raise: \${__t2w_finally_value1}
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
          - assign1:
              assign:
                - __t2w_finally_condition1:
                - __t2w_finally_value1:
          - try1:
              try:
                steps:
                  - try2:
                      try:
                        steps:
                          - assign2:
                              assign:
                                - __temp: \${writeData(data)}
                      except:
                        as: err
                        steps:
                          - call_sys_log_1:
                              call: sys.log
                              args:
                                data: \${err}
                          - assign3:
                              assign:
                                - __t2w_finally_condition1: return
                                - __t2w_finally_value1: Error!
                              next: assign5
              except:
                as: __fin_exc
                steps:
                  - assign4:
                      assign:
                        - __t2w_finally_condition1: raise
                        - __t2w_finally_value1: \${__fin_exc}
          - assign5:
              assign:
                - __temp: \${closeConnection()}
          - switch1:
              switch:
                - condition: \${__t2w_finally_condition1 == "return"}
                  steps:
                    - return1:
                        return: \${__t2w_finally_value1}
                - condition: \${__t2w_finally_condition1 == "raise"}
                  steps:
                    - raise1:
                        raise: \${__t2w_finally_value1}
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
          - assign1:
              assign:
                - __t2w_finally_condition1:
                - __t2w_finally_value1:
          - try1:
              try:
                steps:
                  - try2:
                      try:
                        steps:
                          - assign2:
                              assign:
                                - __temp: \${writeData(data)}
                      except:
                        as: err
                        steps:
                          - call_sys_log_1:
                              call: sys.log
                              args:
                                data: \${err}
              except:
                as: __fin_exc
                steps:
                  - assign3:
                      assign:
                        - __t2w_finally_condition1: raise
                        - __t2w_finally_value1: \${__fin_exc}
          - assign4:
              assign:
                - __temp: \${closeConnection()}
          - return1:
              return: 0
          - switch1:
              switch:
                - condition: \${__t2w_finally_condition1 == "return"}
                  steps:
                    - return2:
                        return: \${__t2w_finally_value1}
                - condition: \${__t2w_finally_condition1 == "raise"}
                  steps:
                    - raise1:
                        raise: \${__t2w_finally_value1}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles try-catch with an empty finally block', () => {
    const code = `
    function safeWrite(data) {
      try {
        writeData(data);
      } catch (err) {
        sys.log(err);
      } finally {
      }
    }`

    const expected = `
      safeWrite:
        params:
          - data
        steps:
          - assign1:
              assign:
                - __t2w_finally_condition1:
                - __t2w_finally_value1:
          - try1:
              try:
                steps:
                  - try2:
                      try:
                        steps:
                          - assign2:
                              assign:
                                - __temp: \${writeData(data)}
                      except:
                        as: err
                        steps:
                          - call_sys_log_1:
                              call: sys.log
                              args:
                                data: \${err}
              except:
                as: __fin_exc
                steps:
                  - assign3:
                      assign:
                        - __t2w_finally_condition1: raise
                        - __t2w_finally_value1: \${__fin_exc}
          - switch1:
              switch:
                - condition: \${__t2w_finally_condition1 == "return"}
                  steps:
                    - return1:
                        return: \${__t2w_finally_value1}
                - condition: \${__t2w_finally_condition1 == "raise"}
                  steps:
                    - raise1:
                        raise: \${__t2w_finally_value1}
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
      retry_policy(http.default_retry)
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
      retry_policy(http.default_retry)
    }`

    const expected = `
      main:
        steps:
          - assign1:
              assign:
                - __t2w_finally_condition1:
                - __t2w_finally_value1:
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
                          - assign2:
                              assign:
                                - __t2w_finally_condition1: return
                                - __t2w_finally_value1: \${response}
                              next: assign5
                      retry: \${http.default_retry}
                      except:
                        steps:
                          - assign3:
                              assign:
                                - __temp: \${log("Error!")}
              except:
                as: __fin_exc
                steps:
                  - assign4:
                      assign:
                        - __t2w_finally_condition1: raise
                        - __t2w_finally_value1: \${__fin_exc}
          - assign5:
              assign:
                - __temp: \${closeConnection()}
          - switch1:
              switch:
                - condition: \${__t2w_finally_condition1 == "return"}
                  steps:
                    - return1:
                        return: \${__t2w_finally_value1}
                - condition: \${__t2w_finally_condition1 == "raise"}
                  steps:
                    - raise1:
                        raise: \${__t2w_finally_value1}
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
      retry_policy(http.default_retry)
    }`

    const expected = `
      main:
        steps:
          - assign1:
              assign:
                - __t2w_finally_condition1:
                - __t2w_finally_value1:
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
                          - assign2:
                              assign:
                                - __t2w_finally_condition1: return
                                - __t2w_finally_value1: \${response}
                              next: assign4
                      retry: \${http.default_retry}
              except:
                as: __fin_exc
                steps:
                  - assign3:
                      assign:
                        - __t2w_finally_condition1: raise
                        - __t2w_finally_value1: \${__fin_exc}
          - assign4:
              assign:
                - __temp: \${closeConnection()}
          - switch1:
              switch:
                - condition: \${__t2w_finally_condition1 == "return"}
                  steps:
                    - return1:
                        return: \${__t2w_finally_value1}
                - condition: \${__t2w_finally_condition1 == "raise"}
                  steps:
                    - raise1:
                        raise: \${__t2w_finally_value1}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles nested try statements with a finally block on the inner try', () => {
    const code = `
    function test() {
      try {
        try {
          return 1;
        } catch (err) {
          sys.log("Error");
        } finally {
          cleanup();
        }

        return 2;
      } catch (err) {
        sys.log("Error");
      }
    }`

    const expected = `
      test:
        steps:
          - try1:
              try:
                steps:
                  - assign1:
                      assign:
                        - __t2w_finally_condition1:
                        - __t2w_finally_value1:
                  - try2:
                      try:
                        steps:
                          - try3:
                              try:
                                steps:
                                  - assign2:
                                      assign:
                                        - __t2w_finally_condition1: return
                                        - __t2w_finally_value1: 1
                                      next: assign4
                              except:
                                as: err
                                steps:
                                  - call_sys_log_1:
                                      call: sys.log
                                      args:
                                        data: Error
                      except:
                        as: __fin_exc
                        steps:
                          - assign3:
                              assign:
                                - __t2w_finally_condition1: raise
                                - __t2w_finally_value1: \${__fin_exc}
                  - assign4:
                      assign:
                        - __temp: \${cleanup()}
                  - switch1:
                      switch:
                        - condition: \${__t2w_finally_condition1 == "return"}
                          steps:
                            - return1:
                                return: \${__t2w_finally_value1}
                        - condition: \${__t2w_finally_condition1 == "raise"}
                          steps:
                            - raise1:
                                raise: \${__t2w_finally_value1}
                  - return2:
                      return: 2
              except:
                as: err
                steps:
                  - call_sys_log_2:
                      call: sys.log
                      args:
                        data: Error
    `

    assertTranspiled(code, expected)
  })

  it('transpiles nested try statements with a finally block on the outer try', () => {
    const code = `
    function test() {
      try {
        try {
          return 1;
        } catch (err) {
          sys.log("Error");
        }

        return 2;
      } catch (err) {
        sys.log("Error");
      } finally {
        cleanup();
      }
    }`

    const expected = `
      test:
        steps:
          - assign1:
              assign:
                - __t2w_finally_condition1:
                - __t2w_finally_value1:
          - try1:
              try:
                steps:
                  - try2:
                      try:
                        steps:
                          - try3:
                              try:
                                steps:
                                  - assign2:
                                      assign:
                                        - __t2w_finally_condition1: return
                                        - __t2w_finally_value1: 1
                                      next: assign5
                              except:
                                as: err
                                steps:
                                  - call_sys_log_1:
                                      call: sys.log
                                      args:
                                        data: Error
                          - assign3:
                              assign:
                                - __t2w_finally_condition1: return
                                - __t2w_finally_value1: 2
                              next: assign5
                      except:
                        as: err
                        steps:
                          - call_sys_log_2:
                              call: sys.log
                              args:
                                data: Error
              except:
                as: __fin_exc
                steps:
                  - assign4:
                      assign:
                        - __t2w_finally_condition1: raise
                        - __t2w_finally_value1: \${__fin_exc}
          - assign5:
              assign:
                - __temp: \${cleanup()}
          - switch1:
              switch:
                - condition: \${__t2w_finally_condition1 == "return"}
                  steps:
                    - return1:
                        return: \${__t2w_finally_value1}
                - condition: \${__t2w_finally_condition1 == "raise"}
                  steps:
                    - raise1:
                        raise: \${__t2w_finally_value1}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles nested try statements with finally blocks on all tries', () => {
    const code = `
    function test() {
      try {
        try {
          return 1;
        } catch (err) {
          sys.log("Error");
        } finally {
          cleanup1();
        }

        return 2;
      } catch (err) {
        sys.log("Error");
      } finally {
        cleanup2();
      }
    }`

    const expected = `
      test:
        steps:
          - assign1:
              assign:
                - __t2w_finally_condition1:
                - __t2w_finally_value1:
          - try1:
              try:
                steps:
                  - try2:
                      try:
                        steps:
                          - assign2:
                              assign:
                                - __t2w_finally_condition2:
                                - __t2w_finally_value2:
                          - try3:
                              try:
                                steps:
                                  - try4:
                                      try:
                                        steps:
                                          - assign3:
                                              assign:
                                                - __t2w_finally_condition2: return
                                                - __t2w_finally_value2: 1
                                              next: assign5
                                      except:
                                        as: err
                                        steps:
                                          - call_sys_log_1:
                                              call: sys.log
                                              args:
                                                data: Error
                              except:
                                as: __fin_exc
                                steps:
                                  - assign4:
                                      assign:
                                        - __t2w_finally_condition2: raise
                                        - __t2w_finally_value2: \${__fin_exc}
                          - assign5:
                              assign:
                                - __temp: \${cleanup1()}
                          - switch1:
                              switch:
                                - condition: \${__t2w_finally_condition2 == "return"}
                                  steps:
                                    - return1:
                                        return: \${__t2w_finally_value2}
                                - condition: \${__t2w_finally_condition2 == "raise"}
                                  steps:
                                    - raise1:
                                        raise: \${__t2w_finally_value2}
                          - assign6:
                              assign:
                                - __t2w_finally_condition1: return
                                - __t2w_finally_value1: 2
                              next: assign8
                      except:
                        as: err
                        steps:
                          - call_sys_log_2:
                              call: sys.log
                              args:
                                data: Error
              except:
                as: __fin_exc
                steps:
                  - assign7:
                      assign:
                        - __t2w_finally_condition1: raise
                        - __t2w_finally_value1: \${__fin_exc}
          - assign8:
              assign:
                - __temp: \${cleanup2()}
          - switch2:
              switch:
                - condition: \${__t2w_finally_condition1 == "return"}
                  steps:
                    - return2:
                        return: \${__t2w_finally_value1}
                - condition: \${__t2w_finally_condition1 == "raise"}
                  steps:
                    - raise2:
                        raise: \${__t2w_finally_value1}
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

  it('retry policy with string values', () => {
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
        max_retries: "5",
        backoff: { initial_delay: "5", max_delay: "60", multiplier: "2" }
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
                max_retries: "5"
                backoff:
                  initial_delay: "5"
                  max_delay: "60"
                  multiplier: "2"
              except:
                steps:
                  - assign1:
                      assign:
                        - __temp: \${log("Error!")}
    `

    assertTranspiled(code, expected)
  })

  it('retry policy with expressions', () => {
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

  it('accepts partial custom retry predicate specifications', () => {
    // According to the documentation all parameters are required. However,
    // missing values are actually accepted in my testing (Jan 2025).
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
                  max_delay: 60
              except:
                steps:
                  - assign1:
                      assign:
                        - __temp: \${log("Error!")}
    `

    assertTranspiled(code, expected)
  })

  it('accepts partial custom retry predicate specifications 2', () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
      retry_policy({
        // predicate missing
        max_retries: 3,
        backoff: { initial_delay: 0.5, max_delay: 60, multiplier: 3 }
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
                max_retries: 3
                backoff:
                  initial_delay: 0.5
                  max_delay: 60
                  multiplier: 3
              except:
                steps:
                  - assign1:
                      assign:
                        - __temp: \${log("Error!")}
    `

    assertTranspiled(code, expected)
  })

  it('applies retry policy only on one try on nested try blocks', () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        try {
          const a = 1;
        } catch (e) {}
      } catch (e) {
        log("Error!");
      }
      retry_policy(http.default_retry);
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
                - try2:
                    try:
                      steps:
                        - assign1:
                            assign:
                              - a: 1
                    except:
                      as: e
                      steps: []
            retry: \${http.default_retry}
            except:
              as: e
              steps:
                - assign2:
                    assign:
                      - __temp: \${log("Error!")}
  `

    assertTranspiled(code, expected)
  })

  it('applies separate retry policies on nested try blocks', () => {
    const code = `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        try {
          const a = 1;
        } catch (e) {}
        retry_policy(custom_retry);
      } catch (e) {
        log("Error!");
      }
      retry_policy(http.default_retry);
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
                - try2:
                    try:
                      steps:
                        - assign1:
                            assign:
                              - a: 1
                    retry: \${custom_retry}
                    except:
                      as: e
                      steps: []
            retry: \${http.default_retry}
            except:
              as: e
              steps:
                - assign2:
                    assign:
                      - __temp: \${log("Error!")}
  `

    assertTranspiled(code, expected)
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
      retry_policy(1000)
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

      retry_policy(http.default_retry)
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
      const x = 1 + retry_policy(http.default_retry)
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
