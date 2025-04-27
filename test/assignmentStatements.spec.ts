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

  it('indexed assignment with a computed expression', () => {
    const code = `function main() {
      const i = 10;
      values[i + 1] = 10;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - i: 10
              - values[i + 1]: 10
    `

    assertTranspiled(code, expected)
  })

  it('indexed assignment with a function call expression as the index', () => {
    const code = `function main() {
      values[getIndex()] = 10;
    }

    function getIndex() {
      return 5;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - values[getIndex()]: 10
    getIndex:
      steps:
        - return1:
            return: 5
    `

    assertTranspiled(code, expected)
  })

  it('indexed assignment with a member expression as the index', () => {
    const code = `function main() {
      const indexes = { first: 0 };
      values[indexes.first] = 10;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - indexes:
                  first: 0
              - values[indexes.first]: 10
    `

    assertTranspiled(code, expected)
  })

  it('indexed assignment with a map literal in the index', () => {
    const code = `function main() {
      values[{ i: 0 }.i] = 10;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp0:
                  i: 0
              - values[__temp0.i]: 10
    `

    assertTranspiled(code, expected)
  })

  it('object property assignment with a variable as a key', () => {
    const code = `function main() {
      const key = "name";
      data[key] = "Bean";
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - key: name
              - data[key]: Bean
    `

    assertTranspiled(code, expected)
  })

  it('object property assignment with a computed expression', () => {
    const code = `function main() {
      data["na" + "me"] = "Bean";
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - data["na" + "me"]: Bean
    `

    assertTranspiled(code, expected)
  })

  it('object property assignment with a computed expression with variables', () => {
    const code = `function main() {
      const prefix = "na";
      const postfix = "me";
      data[prefix + postfix] = "Bean";
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - prefix: na
              - postfix: me
              - data[prefix + postfix]: Bean
    `

    assertTranspiled(code, expected)
  })

  it('assignment to a member expression', () => {
    const code = `function main() {
      people[3].age = 38;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - people[3].age: 38
    `

    assertTranspiled(code, expected)
  })

  it('assignment to a member expression with a variable index', () => {
    const code = `function main() {
      const i = 10;
      people[i].age = 38;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - i: 10
              - people[i].age: 38
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

  it('addition assignment to a member expression with a computed expression', () => {
    const code = `
    function main() {
      const i = 2;
      people[4 + i].age += 1;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - i: 2
              - __temp0: \${4 + i}
              - people[__temp0].age: \${people[__temp0].age + 1}
    `

    assertTranspiled(code, expected)
  })

  it('compound assignment to a member expression with side-effects', () => {
    const code = `
    function main() {
      values[getIndex() + 4] -= 1;
    }

    function getIndex() {
      return 1;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp0: \${getIndex() + 4}
              - values[__temp0]: \${values[__temp0] - 1}
    getIndex:
      steps:
        - return1:
            return: 1
    `

    assertTranspiled(code, expected)
  })

  it('compound assignment to a member expression with many side-effects', () => {
    const code = `
    function main() {
      data.objects[objectIndex()].values[valueIndex()] /= 2;
    }

    function objectIndex() {
      return 2;
    }

    function valueIndex() {
      return 1;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp1: \${objectIndex()}
              - __temp0: \${valueIndex()}
              - data.objects[__temp1].values[__temp0]: \${data.objects[__temp1].values[__temp0] / 2}
    objectIndex:
      steps:
        - return1:
            return: 2
    valueIndex:
      steps:
        - return2:
            return: 1
    `

    assertTranspiled(code, expected)
  })

  it('call step in a compound assignment', () => {
    const code = `
    function main(x) {
      x %= call_step(sum, {a: 10, b: 11});
    }

    function sum(a, b) {
      return a + b;
    }`

    const expected = `
    main:
      params:
        - x
      steps:
        - call_sum_1:
            call: sum
            args:
              a: 10
              b: 11
            result: __temp
        - assign1:
            assign:
              - x: \${x % __temp}
    sum:
      params:
        - a
        - b
      steps:
        - return1:
            return: \${a + b}
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
