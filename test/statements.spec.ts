import { expect } from 'chai'
import { transpileText } from '../src/transpiler/index.js'
import { assertTranspiled } from './testutils.js'

describe('Import statement', () => {
  it('accepts named import declaration on the top-level', () => {
    const code = `
    import { http } from 'workflowlib'
    import { http, sys } from 'workflowlib'`

    expect(() => transpileText(code)).not.to.throw()
  })

  it('accepts side-effecting imports on the top-level', () => {
    const code = `import 'module'`

    expect(() => transpileText(code)).not.to.throw()
  })

  it('throws on default import', () => {
    const code = `import myDefault from 'module'`

    expect(() => transpileText(code)).to.throw()
  })

  it('throws on namespace import', () => {
    const code = `import * as sys from 'sys'`

    expect(() => transpileText(code)).to.throw()
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

  it('fall-through as the last case', () => {
    const code = `
    function main(person: string): string {
      let royal: boolean = false;

      switch (person) {
        case "Bean":
          royal = true;

        case "Sorcerio":
        default:
      }

      return royal;
    }`

    const expected = `
    main:
      params:
        - person
      steps:
        - assign1:
            assign:
              - royal: false
        - switch1:
            switch:
              - condition: \${person == "Bean"}
                next: assign2
              - condition: \${person == "Sorcerio"}
                next: return1
              - condition: true
                next: return1
        - assign2:
            assign:
              - royal: true
        - return1:
            return: \${royal}
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

describe('Debugger statement', () => {
  it('ignores debugger statement', () => {
    const code = `
    function main() {
      const x = 1;

      debugger;

      return x + 1;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - x: 1
        - return1:
            return: \${x + 1}
    `

    assertTranspiled(code, expected)
  })
})
