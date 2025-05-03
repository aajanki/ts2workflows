import { assertTranspiled } from './testutils.js'

describe('Variable scope', () => {
  it('variable can be accessed in sub-blocks', () => {
    const code = `
    function test() {
      let x = 5;

      {
        x += 1;
      }

      return x;
    }`

    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - x: 5
              - x: \${x + 1}
        - return1:
            return: \${x}
    `

    assertTranspiled(code, expected)
  })

  it('variable can be accessed in if-blocks', () => {
    const code = `
    function test() {
      let x = 5;

      if (2 > 1) {
        x += 1;
      }

      return x;
    }`

    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - x: 5
        - switch1:
            switch:
              - condition: \${2 > 1}
                steps:
                  - assign2:
                      assign:
                        - x: \${x + 1}
        - return1:
            return: \${x}
    `

    assertTranspiled(code, expected)
  })

  it('const and let variables have function scope (unlike TypeScript)', () => {
    // This is not valid as a Typescript program, but is valid ts2workflows/GCP Workflows program
    const code = `
    function test(x: number) {
      if (x > 0) {
        const res = 'positive';
      } else {
        const res = 'non-positive';
      }

      return res;
    }`

    const expected = `
    test:
      params:
        - x
      steps:
        - switch1:
            switch:
              - condition: \${x > 0}
                steps:
                  - assign1:
                      assign:
                        - res: positive
              - condition: true
                steps:
                  - assign2:
                      assign:
                        - res: non-positive
        - return1:
            return: \${res}
    `

    assertTranspiled(code, expected)
  })

  it('uninitialized variables are set to null', () => {
    // This is not valid as a Typescript program, but is valid ts2workflows/GCP Workflows program
    const code = `
    function test() {
      let x: number | null;
      return x;
    }`

    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - x: null
        - return1:
            return: \${x}
    `

    assertTranspiled(code, expected)
  })

  it('variable read before it is assigned', () => {
    // This will fail on run-time, but the transpiler accepts it anyway.
    // TODO: The transpilers should be changed to detect read-before-assigned
    // cases and to throw an error.
    const code = `
    function test() {
      const y = x + 1;
      const x = 1;
    }`

    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - y: \${x + 1}
              - x: 1
    `

    assertTranspiled(code, expected)
  })
})
