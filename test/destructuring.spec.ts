import { expect } from 'chai'
import { transpileText } from '../src/transpiler/index.js'
import { assertTranspiled } from './testutils.js'

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
              - __temp_len: \${len(__temp)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 2}
                steps:
                  - assign2:
                      assign:
                        - a: \${__temp[0]}
                        - b: \${__temp[1]}
              - condition: \${__temp_len >= 1}
                steps:
                  - assign3:
                      assign:
                        - a: \${__temp[0]}
                        - b: null
              - condition: true
                steps:
                  - assign4:
                      assign:
                        - a: null
                        - b: null
    `

    assertTranspiled(code, expected)
  })

  it('destructuring the head of array', () => {
    const code = `
    function main() {
      const [head] = getValues();
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp: \${getValues()}
              - __temp_len: \${len(__temp)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 1}
                steps:
                  - assign2:
                      assign:
                        - head: \${__temp[0]}
              - condition: true
                steps:
                  - assign3:
                      assign:
                        - head: null
    `

    assertTranspiled(code, expected)
  })

  it('destructures array from call_step()', () => {
    const code = `
    function main() {
      const [head] = call_step(test_array, {id: 1});
    }
      
    function test_array(id) {
      return [id]
    }`

    const expected = `
    main:
      steps:
        - call_test_array_1:
            call: test_array
            args:
              id: 1
            result: __temp
        - assign1:
            assign:
              - __temp_len: \${len(__temp)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 1}
                steps:
                  - assign2:
                      assign:
                        - head: \${__temp[0]}
              - condition: true
                steps:
                  - assign3:
                      assign:
                        - head: null
    test_array:
      params:
        - id
      steps:
        - return1:
            return:
              - \${id}
    `

    assertTranspiled(code, expected)
  })

  it('destructures array in a nested property', () => {
    const code = `
    function main(data) {
      const [a, b] = data.arr;
    }`

    const expected = `
    main:
      params:
        - data
      steps:
        - assign1:
            assign:
              - __temp_len: \${len(data.arr)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 2}
                steps:
                  - assign2:
                      assign:
                        - a: \${data.arr[0]}
                        - b: \${data.arr[1]}
              - condition: \${__temp_len >= 1}
                steps:
                  - assign3:
                      assign:
                        - a: \${data.arr[0]}
                        - b: null
              - condition: true
                steps:
                  - assign4:
                      assign:
                        - a: null
                        - b: null
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
              - __temp_len: \${len(arr)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 2}
                steps:
                  - assign2:
                      assign:
                        - arr[1]: \${arr[0]}
                        - arr[0]: \${arr[1]}
              - condition: \${__temp_len >= 1}
                steps:
                  - assign3:
                      assign:
                        - arr[1]: \${arr[0]}
                        - arr[0]: null
              - condition: true
                steps:
                  - assign4:
                      assign:
                        - arr[1]: null
                        - arr[0]: null
    `

    assertTranspiled(code, expected)
  })

  it('array destructuring with skipped elements', () => {
    const code = `
    function main() {
      const arr = [1, 2, 3, 4];
      const [, a, , b] = arr;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - arr: [1, 2, 3, 4]
              - __temp_len: \${len(arr)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 4}
                steps:
                  - assign2:
                      assign:
                        - a: \${arr[1]}
                        - b: \${arr[3]}
              - condition: \${__temp_len >= 2}
                steps:
                  - assign3:
                      assign:
                        - a: \${arr[1]}
                        - b: null
              - condition: true
                steps:
                  - assign4:
                      assign:
                        - a: null
                        - b: null
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
              - __temp_len: \${len(__temp)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 2}
                steps:
                  - assign2:
                      assign:
                        - a: \${__temp[0]}
                        - b: \${__temp[1]}
              - condition: \${__temp_len >= 1}
                steps:
                  - assign3:
                      assign:
                        - a: \${__temp[0]}
                        - b: null
              - condition: true
                steps:
                  - assign4:
                      assign:
                        - a: null
                        - b: null
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
              - __temp_len: \${len(__temp)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 2}
                steps:
                  - assign2:
                      assign:
                        - arr[2]: \${__temp[0]}
                        - arr[1]: \${__temp[1]}
              - condition: \${__temp_len >= 1}
                steps:
                  - assign3:
                      assign:
                        - arr[2]: \${__temp[0]}
                        - arr[1]: null
              - condition: true
                steps:
                  - assign4:
                      assign:
                        - arr[2]: null
                        - arr[1]: null
    `

    assertTranspiled(code, expected)
  })

  it('destructures nested arrays', () => {
    const code = `
    function main(data) {
      const [[a], [b]] = data;
    }`

    const expected = `
    main:
      params:
        - data
      steps:
        - assign1:
            assign:
              - __temp_len: \${len(data)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 2}
                steps:
                  - assign2:
                      assign:
                        - __temp_len: \${len(data[0])}
                  - switch2:
                      switch:
                        - condition: \${__temp_len >= 1}
                          steps:
                            - assign3:
                                assign:
                                  - a: \${data[0][0]}
                        - condition: true
                          steps:
                            - assign4:
                                assign:
                                  - a: null
                  - assign5:
                      assign:
                        - __temp_len: \${len(data[1])}
                  - switch3:
                      switch:
                        - condition: \${__temp_len >= 1}
                          steps:
                            - assign6:
                                assign:
                                  - b: \${data[1][0]}
                        - condition: true
                          steps:
                            - assign7:
                                assign:
                                  - b: null
              - condition: \${__temp_len >= 1}
                steps:
                  - assign8:
                      assign:
                        - __temp_len: \${len(data[0])}
                  - switch4:
                      switch:
                        - condition: \${__temp_len >= 1}
                          steps:
                            - assign9:
                                assign:
                                  - a: \${data[0][0]}
                        - condition: true
                          steps:
                            - assign10:
                                assign:
                                  - a: null
                  - assign11:
                      assign:
                        - b: null
              - condition: true
                steps:
                  - assign12:
                      assign:
                        - a: null
                        - b: null
    `

    assertTranspiled(code, expected)
  })

  it('default values in array destructuring', () => {
    const code = `
    function main(arr: number[]) {
      const [a, b = 99] = arr;
    }`

    const expected = `
    main:
      params:
        - arr
      steps:
        - assign1:
            assign:
              - __temp_len: \${len(arr)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 2}
                steps:
                  - assign2:
                      assign:
                        - a: \${arr[0]}
                        - b: \${arr[1]}
              - condition: \${__temp_len >= 1}
                steps:
                  - assign3:
                      assign:
                        - a: \${arr[0]}
                        - b: 99
              - condition: true
                steps:
                  - assign4:
                      assign:
                        - a: null
                        - b: 99
    `

    assertTranspiled(code, expected)
  })

  it('rest element in array destructuring', () => {
    const code = `
    function main() {
      const [a, b, ...rest] = getValues();
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp: \${getValues()}
              - __temp_len: \${len(__temp)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 3}
                steps:
                  - assign2:
                      assign:
                        - a: \${__temp[0]}
                        - b: \${__temp[1]}
                        - rest: []
                  - for1:
                      for:
                        value: __temp_index
                        range:
                          - 2
                          - \${__temp_len - 1}
                        steps:
                          - assign3:
                              assign:
                                - rest: \${list.concat(rest, __temp[__temp_index])}
              - condition: \${__temp_len >= 2}
                steps:
                  - assign4:
                      assign:
                        - a: \${__temp[0]}
                        - b: \${__temp[1]}
                        - rest: []
              - condition: \${__temp_len >= 1}
                steps:
                  - assign5:
                      assign:
                        - a: \${__temp[0]}
                        - b: null
                        - rest: []
              - condition: true
                steps:
                  - assign6:
                      assign:
                        - a: null
                        - b: null
                        - rest: []
    `

    assertTranspiled(code, expected)
  })

  it('rest element as the only pattern', () => {
    const code = `
    function main() {
      const [...values] = getValues();
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp: \${getValues()}
              - __temp_len: \${len(__temp)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 1}
                steps:
                  - assign2:
                      assign:
                        - values: []
                  - for1:
                      for:
                        value: __temp_index
                        range:
                          - 0
                          - \${__temp_len - 1}
                        steps:
                          - assign3:
                              assign:
                                - values: \${list.concat(values, __temp[__temp_index])}
              - condition: true
                steps:
                  - assign4:
                      assign:
                        - values: []
    `

    assertTranspiled(code, expected)
  })

  it('rest element and holes in array destructuring', () => {
    const code = `
    function main() {
      const [a, , , b, , ...rest] = getValues();
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp: \${getValues()}
              - __temp_len: \${len(__temp)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 6}
                steps:
                  - assign2:
                      assign:
                        - a: \${__temp[0]}
                        - b: \${__temp[3]}
                        - rest: []
                  - for1:
                      for:
                        value: __temp_index
                        range:
                          - 5
                          - \${__temp_len - 1}
                        steps:
                          - assign3:
                              assign:
                                - rest: \${list.concat(rest, __temp[__temp_index])}
              - condition: \${__temp_len >= 4}
                steps:
                  - assign4:
                      assign:
                        - a: \${__temp[0]}
                        - b: \${__temp[3]}
                        - rest: []
              - condition: \${__temp_len >= 1}
                steps:
                  - assign5:
                      assign:
                        - a: \${__temp[0]}
                        - b: null
                        - rest: []
              - condition: true
                steps:
                  - assign6:
                      assign:
                        - a: null
                        - b: null
                        - rest: []
    `

    assertTranspiled(code, expected)
  })

  it('rest element in nested array patterns', () => {
    const code = `
    function main(data) {
      const [[a], [b, ...rest2], ...otherValues] = data;
    }`

    const expected = `
    main:
      params:
        - data
      steps:
        - assign1:
            assign:
              - __temp_len: \${len(data)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 3}
                steps:
                  - assign2:
                      assign:
                        - __temp_len: \${len(data[0])}
                  - switch2:
                      switch:
                        - condition: \${__temp_len >= 1}
                          steps:
                            - assign3:
                                assign:
                                  - a: \${data[0][0]}
                        - condition: true
                          steps:
                            - assign4:
                                assign:
                                  - a: null
                  - assign5:
                      assign:
                        - __temp_len: \${len(data[1])}
                  - switch3:
                      switch:
                        - condition: \${__temp_len >= 2}
                          steps:
                            - assign6:
                                assign:
                                  - b: \${data[1][0]}
                                  - rest2: []
                            - for1:
                                for:
                                  value: __temp_index
                                  range:
                                    - 1
                                    - \${__temp_len - 1}
                                  steps:
                                    - assign7:
                                        assign:
                                          - rest2: \${list.concat(rest2, data[1][__temp_index])}
                        - condition: \${__temp_len >= 1}
                          steps:
                            - assign8:
                                assign:
                                  - b: \${data[1][0]}
                                  - rest2: []
                        - condition: true
                          steps:
                            - assign9:
                                assign:
                                  - b: null
                                  - rest2: []
                  - assign10:
                      assign:
                        - otherValues: []
                  - for2:
                      for:
                        value: __temp_index
                        range:
                          - 2
                          - \${__temp_len - 1}
                        steps:
                          - assign11:
                              assign:
                                - otherValues: \${list.concat(otherValues, data[__temp_index])}
              - condition: \${__temp_len >= 2}
                steps:
                  - assign12:
                      assign:
                        - __temp_len: \${len(data[0])}
                  - switch4:
                      switch:
                        - condition: \${__temp_len >= 1}
                          steps:
                            - assign13:
                                assign:
                                  - a: \${data[0][0]}
                        - condition: true
                          steps:
                            - assign14:
                                assign:
                                  - a: null
                  - assign15:
                      assign:
                        - __temp_len: \${len(data[1])}
                  - switch5:
                      switch:
                        - condition: \${__temp_len >= 2}
                          steps:
                            - assign16:
                                assign:
                                  - b: \${data[1][0]}
                                  - rest2: []
                            - for3:
                                for:
                                  value: __temp_index
                                  range:
                                    - 1
                                    - \${__temp_len - 1}
                                  steps:
                                    - assign17:
                                        assign:
                                          - rest2: \${list.concat(rest2, data[1][__temp_index])}
                        - condition: \${__temp_len >= 1}
                          steps:
                            - assign18:
                                assign:
                                  - b: \${data[1][0]}
                                  - rest2: []
                        - condition: true
                          steps:
                            - assign19:
                                assign:
                                  - b: null
                                  - rest2: []
                  - assign20:
                      assign:
                        - otherValues: []
              - condition: \${__temp_len >= 1}
                steps:
                  - assign21:
                      assign:
                        - __temp_len: \${len(data[0])}
                  - switch6:
                      switch:
                        - condition: \${__temp_len >= 1}
                          steps:
                            - assign22:
                                assign:
                                  - a: \${data[0][0]}
                        - condition: true
                          steps:
                            - assign23:
                                assign:
                                  - a: null
                  - assign24:
                      assign:
                        - b: null
                        - rest2: []
                        - otherValues: []
              - condition: true
                steps:
                  - assign25:
                      assign:
                        - a: null
                        - b: null
                        - rest2: []
                        - otherValues: []
    `

    assertTranspiled(code, expected)
  })

  it('empty array pattern', () => {
    const code = `
    function main() {
      const arr = [1, 2, 3];
      let [] = arr;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - arr: [1, 2, 3]
    `

    assertTranspiled(code, expected)
  })

  it('array pattern with only holes', () => {
    const code = `
    function main() {
      const arr = [1, 2, 3];
      let [ , , ] = arr;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - arr: [1, 2, 3]
    `

    assertTranspiled(code, expected)
  })

  it('destructures object patterns nested in an array pattern', () => {
    const code = `
    function main(data: {name: string}[]) {
      const [ {name} ] = data;
    }`

    const expected = `
    main:
      params:
        - data
      steps:
        - assign1:
            assign:
              - __temp_len: \${len(data)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 1}
                steps:
                  - assign2:
                      assign:
                        - name: \${map.get(data[0], "name")}
              - condition: true
                steps:
                  - assign3:
                      assign:
                        - name: null
    `

    assertTranspiled(code, expected)
  })

  it('destructures a nested rest element object pattern in an array pattern', () => {
    const code = `
    function main(arr: {name: string, age: number}[]) {
      const [{ name, ...rest }] = arr;
    }`

    const expected = `
    main:
      params:
        - arr
      steps:
        - assign1:
            assign:
              - __temp_len: \${len(arr)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 1}
                steps:
                  - assign2:
                      assign:
                        - name: \${map.get(arr[0], "name")}
                        - rest: \${map.delete(arr[0], "name")}
              - condition: true
                steps:
                  - assign3:
                      assign:
                        - name: null
                        - rest: null
    `

    assertTranspiled(code, expected)
  })

  it('throws if the rest element is not the last element in array destructuring pattern', () => {
    const code = `
    function main(arr: number[]) {
      const [a, b, ...rest, c] = arr;
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('throws if the rest element is not the last element in object destructuring pattern', () => {
    const code = `
    function main(data) {
      const {a, ...other, b} = data;
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('throws if there are multiple rest elements in array destructuring', () => {
    const code = `
    function main(arr: number[]) {
      const [a, b, ...rest, ...anotherRest] = arr;
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('throws if there are multiple rest elements in object destructuring', () => {
    const code = `
    function main(data) {
      const {a, ...rest, ...anotherRest} = data;
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('throws if the rest element is an object', () => {
    const code = `
    function main(arr: number[]) {
      const [a, b, ...{ push, pop }] = arr;
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('destructures objects', () => {
    const code = `
    function main() {
      const { name, age, address } = getPerson();
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp: \${getPerson()}
              - name: \${map.get(__temp, "name")}
              - age: \${map.get(__temp, "age")}
              - address: \${map.get(__temp, "address")}
    `

    assertTranspiled(code, expected)
  })

  it('destructures object variables', () => {
    const code = `
    function main() {
      const person = { name: "Bean", hairColor: "white" }
      const { name, hairColor } = person;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - person:
                  name: Bean
                  hairColor: white
              - name: \${map.get(person, "name")}
              - hairColor: \${map.get(person, "hairColor")}
    `

    assertTranspiled(code, expected)
  })

  it('destructures objects in a nested property', () => {
    const code = `
    function main(data) {
      const { name, age } = data.person;
    }`

    const expected = `
    main:
      params:
        - data
      steps:
        - assign1:
            assign:
              - name: \${map.get(data.person, "name")}
              - age: \${map.get(data.person, "age")}
    `

    assertTranspiled(code, expected)
  })

  it('destructures objects in a non-pure nested property', () => {
    const code = `
    function main() {
      const { name, age } = getData().person;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp: \${getData().person}
              - name: \${map.get(__temp, "name")}
              - age: \${map.get(__temp, "age")}
    `

    assertTranspiled(code, expected)
  })

  it('destructures deep objects', () => {
    const code = `
    function main() {
      const { name, address: { country: { name: countryName, code } } } = getPerson();
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp: \${getPerson()}
              - name: \${map.get(__temp, "name")}
              - countryName: \${map.get(__temp.address.country, "name")}
              - code: \${map.get(__temp.address.country, "code")}
    `

    assertTranspiled(code, expected)
  })

  it('destructures object from call_step()', () => {
    const code = `
    function main() {
      const { name } = call_step(test_object, {id: 1});
    }
      
    function test_object(id) {
      return {
        name: "Bean"
      }
    }
    `

    const expected = `
    main:
      steps:
        - call_test_object_1:
            call: test_object
            args:
              id: 1
            result: __temp
        - assign1:
            assign:
              - name: \${map.get(__temp, "name")}
    test_object:
      params:
        - id
      steps:
        - return1:
            return:
              name: "Bean"
    `

    assertTranspiled(code, expected)
  })

  it('destructures objects with assigned variables', () => {
    const code = `
    function main() {
      const { name: myName, address: { city: myCity } } = getPerson();
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp: \${getPerson()}
              - myName: \${map.get(__temp, "name")}
              - myCity: \${map.get(__temp.address, "city")}
    `

    assertTranspiled(code, expected)
  })

  it('destructures objects in arrays', () => {
    const code = `
    function main() {
      const [ { name: name1, age: age1 }, { name: name2, age: age2 } ] = getPersons();
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp: \${getPersons()}
              - __temp_len: \${len(__temp)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 2}
                steps:
                  - assign2:
                      assign:
                        - name1: \${map.get(__temp[0], "name")}
                        - age1: \${map.get(__temp[0], "age")}
                        - name2: \${map.get(__temp[1], "name")}
                        - age2: \${map.get(__temp[1], "age")}
              - condition: \${__temp_len >= 1}
                steps:
                  - assign3:
                      assign:
                        - name1: \${map.get(__temp[0], "name")}
                        - age1: \${map.get(__temp[0], "age")}
                        - name2: null
                        - age2: null
              - condition: true
                steps:
                  - assign4:
                      assign:
                        - name1: null
                        - age1: null
                        - name2: null
                        - age2: null
    `

    assertTranspiled(code, expected)
  })

  it('destructures arrays in objects', () => {
    const code = `
    function main() {
      const {
        names: [first, middle, last],
        professions: [firstProfession]
      } = getPerson();
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp: \${getPerson()}
              - __temp_len: \${len(__temp.names)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 3}
                steps:
                  - assign2:
                      assign:
                        - first: \${__temp.names[0]}
                        - middle: \${__temp.names[1]}
                        - last: \${__temp.names[2]}
              - condition: \${__temp_len >= 2}
                steps:
                  - assign3:
                      assign:
                        - first: \${__temp.names[0]}
                        - middle: \${__temp.names[1]}
                        - last: null
              - condition: \${__temp_len >= 1}
                steps:
                  - assign4:
                      assign:
                        - first: \${__temp.names[0]}
                        - middle: null
                        - last: null
              - condition: true
                steps:
                  - assign5:
                      assign:
                        - first: null
                        - middle: null
                        - last: null
        - assign6:
            assign:
              - __temp_len: \${len(__temp.professions)}
        - switch2:
            switch:
              - condition: \${__temp_len >= 1}
                steps:
                  - assign7:
                      assign:
                        - firstProfession: \${__temp.professions[0]}
              - condition: true
                steps:
                  - assign8:
                      assign:
                        - firstProfession: null
    `

    assertTranspiled(code, expected)
  })

  it('destructures arrays in nested objects', () => {
    const code = `
    function main(data) {
      const [ { values: [a, b] } ] = data;
    }`

    const expected = `
    main:
      params:
        - data
      steps:
        - assign1:
            assign:
              - __temp_len: \${len(data)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 1}
                steps:
                  - assign2:
                      assign:
                        - __temp_len: \${len(data[0].values)}
                  - switch2:
                      switch:
                        - condition: \${__temp_len >= 2}
                          steps:
                            - assign3:
                                assign:
                                  - a: \${data[0].values[0]}
                                  - b: \${data[0].values[1]}
                        - condition: \${__temp_len >= 1}
                          steps:
                            - assign4:
                                assign:
                                  - a: \${data[0].values[0]}
                                  - b: null
                        - condition: true
                          steps:
                            - assign5:
                                assign:
                                  - a: null
                                  - b: null
              - condition: true
                steps:
                  - assign6:
                      assign:
                        - a: null
                        - b: null
    `

    assertTranspiled(code, expected)
  })

  it('destructures a mixture of arrays and objects', () => {
    const code = `
    function main(data) {
      const {
        persons: [ { address: { street: streetAddress, city } } ],
        timestamp,
        source: { database: sourceDb, references: [ ref ] },
      } = data;
    }`

    const expected = `
    main:
      params:
        - data
      steps:
        - assign1:
            assign:
              - __temp_len: \${len(data.persons)}
        - switch1:
            switch:
              - condition: \${__temp_len >= 1}
                steps:
                  - assign2:
                      assign:
                        - streetAddress: \${map.get(data.persons[0].address, "street")}
                        - city: \${map.get(data.persons[0].address, "city")}
              - condition: true
                steps:
                  - assign3:
                      assign:
                        - streetAddress: null
                        - city: null
        - assign4:
            assign:
              - timestamp: \${map.get(data, "timestamp")}
              - sourceDb: \${map.get(data.source, "database")}
              - __temp_len: \${len(data.source.references)}
        - switch2:
            switch:
              - condition: \${__temp_len >= 1}
                steps:
                  - assign5:
                      assign:
                        - ref: \${data.source.references[0]}
              - condition: true
                steps:
                  - assign6:
                      assign:
                        - ref: null
    `

    assertTranspiled(code, expected)
  })

  it('destructures objects in an assignment expression', () => {
    const code = `
    function main() {
      const data = { value: 5 };
      let value = 0;
      ({ value } = data);
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - data:
                  value: 5
              - value: 0
              - value: \${map.get(data, "value")}
    `

    assertTranspiled(code, expected)
  })

  it('empty object pattern', () => {
    const code = `
    function main() {
      const data = { name: "Bean" };
      let {} = data;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - data:
                  name: Bean
    `

    assertTranspiled(code, expected)
  })

  it('default values in object destructuring', () => {
    const code = `
    function main(data) {
      const {name, parameters = {type: "simple"}, timestamp} = data;
    }`

    const expected = `
    main:
      params:
        - data
      steps:
        - assign1:
            assign:
              - name: \${map.get(data, "name")}
        - switch1:
            switch:
              - condition: \${"parameters" in data}
                steps:
                  - assign2:
                      assign:
                        - parameters: \${data.parameters}
              - condition: true
                steps:
                  - assign3:
                      assign:
                        - parameters:
                            type: simple
        - assign4:
            assign:
              - timestamp: \${map.get(data, "timestamp")}
    `

    assertTranspiled(code, expected)
  })

  it('rest element in object destructuring', () => {
    const code = `
    function main(data) {
      const {name, country: {code}, ...other} = data;
    }`

    const expected = `
    main:
      params:
        - data
      steps:
        - assign1:
            assign:
              - name: \${map.get(data, "name")}
              - code: \${map.get(data.country, "code")}
              - other: \${map.delete(map.delete(data, "name"), "country")}
    `

    assertTranspiled(code, expected)
  })

  it('rest element in a nested object in object destructuring', () => {
    const code = `
    function main(data) {
      const {name, country: {code, ...otherCountryProperties}} = data;
    }`

    const expected = `
    main:
      params:
        - data
      steps:
        - assign1:
            assign:
              - name: \${map.get(data, "name")}
              - code: \${map.get(data.country, "code")}
              - otherCountryProperties: \${map.delete(data.country, "code")}
    `

    assertTranspiled(code, expected)
  })

  it('rest element as the only pattern in object destructuring', () => {
    const code = `
    function main(data) {
      const {...properties} = data;
    }`

    const expected = `
    main:
      params:
        - data
      steps:
        - assign1:
            assign:
              - properties: \${data}
    `

    assertTranspiled(code, expected)
  })
})
