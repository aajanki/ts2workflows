import { expect } from 'chai'
import { transpile } from '../src/transpiler/index.js'
import { assertTranspiled } from './testutils.js'

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

  it('transpiles a sequence of const assignments', () => {
    const code = 'function main() { const a = 1, b=2, c=3; }'

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - a: 1
              - b: 2
              - c: 3
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

describe('Destructing', () => {
  it('destructures array elements', () => {
    const code = `
    function main() {
      const [a, b] = getValues();
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp: \${getValues()}
              - a: \${__temp[0]}
              - b: \${__temp[1]}
    `

    assertTranspiled(code, expected)
  })

  it('array destructuring overwriting itself', () => {
    const code = `
    function main() {
      const arr = [1, 2, 3];
      [arr[1], arr[0]] = arr;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - arr: [1, 2, 3]
              - arr[1]: \${arr[0]}
              - arr[0]: \${arr[1]}
    `

    assertTranspiled(code, expected)
  })

  it('array destructuring with skipped elements', () => {
    const code = `
    function main() {
      const arr = [1, 2, 3, 4];
      const [a, , , b] = arr;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - arr: [1, 2, 3, 4]
              - a: \${arr[0]}
              - b: \${arr[3]}
    `

    assertTranspiled(code, expected)
  })

  it('variable swap trick', () => {
    const code = `
    function main() {
      let a = 1;
      let b = 2;
      [a, b] = [b, a];
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - a: 1
              - b: 2
              - __temp:
                  - \${b}
                  - \${a}
              - a: \${__temp[0]}
              - b: \${__temp[1]}
    `

    assertTranspiled(code, expected)
  })

  it('array elements swap trick', () => {
    const code = `
    function main() {
      const arr = [1, 2, 3];
      [arr[2], arr[1]] = [arr[1], arr[2]];
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - arr: [1, 2, 3]
              - __temp:
                  - \${arr[1]}
                  - \${arr[2]}
              - arr[2]: \${__temp[0]}
              - arr[1]: \${__temp[1]}
    `

    assertTranspiled(code, expected)
  })
})
