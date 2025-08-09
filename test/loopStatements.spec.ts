import { expect } from 'chai'
import { transpileText } from '../src/transpiler/index.js'
import { assertTranspiled } from './testutils.js'

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

  it('transpiles nested for loops with continue on the outer loop', () => {
    const code = `
    function main() {
      let total = 0;
      for (let x of [1, 2]) {
        for (let y of [3, 4]) {
          total += y;
        }

        continue;
      }
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
              in: [1, 2]
              steps:
                - for2:
                    for:
                      value: y
                      in: [3, 4]
                      steps:
                        - assign2:
                            assign:
                              - total: \${total + y}
                - next1:
                    next: continue
    `

    assertTranspiled(code, expected)
  })

  it('transpiles nested for loops with continue on the inner loop', () => {
    const code = `
    function main() {
      let total = 0;
      for (let x of [1, 2]) {
        for (let y of [3, 4]) {
          total += y;
          continue;
        }
      }
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
              in: [1, 2]
              steps:
                - for2:
                    for:
                      value: y
                      in: [3, 4]
                      steps:
                        - assign2:
                            assign:
                              - total: \${total + y}
                            next: continue
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
                  - next2:
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
                  - next2:
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

  it('transpiles nested while loops with continue on the outer loop', () => {
    const code = `
    function main() {
      let x = 0;

      while (x < 5) {
        continue;

        while (x < 5) {
          x += 1;
        }
      }
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - x: 0
        - switch1:
            switch:
              - condition: \${x < 5}
                steps:
                  - next1:
                      next: switch1
                  - switch2:
                      switch:
                        - condition: \${x < 5}
                          steps:
                            - assign2:
                                assign:
                                  - x: \${x + 1}
                                next: switch2
                  - next2:
                      next: switch1
    `

    assertTranspiled(code, expected)
  })

  it('transpiles nested while loops with continue on the inner loop', () => {
    const code = `
    function main() {
      let x = 0;

      while (x < 5) {
        while (x < 5) {
          continue;

          x += 1;
        }
      }
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - x: 0
        - switch1:
            switch:
              - condition: \${x < 5}
                steps:
                  - switch2:
                      switch:
                        - condition: \${x < 5}
                          steps:
                            - next1:
                                next: switch2
                            - assign2:
                                assign:
                                  - x: \${x + 1}
                                next: switch2
                  - next2:
                      next: switch1
    `

    assertTranspiled(code, expected)
  })

  it('transpiles nested while loops with continue on all levels', () => {
    const code = `
    function main() {
      let x = 0;

      while (x < 5) {
        continue;

        while (x < 5) {
          continue;

          x += 1;
        }
      }
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - x: 0
        - switch1:
            switch:
              - condition: \${x < 5}
                steps:
                  - next1:
                      next: switch1
                  - switch2:
                      switch:
                        - condition: \${x < 5}
                          steps:
                            - next2:
                                next: switch2
                            - assign2:
                                assign:
                                  - x: \${x + 1}
                                next: switch2
                  - next3:
                      next: switch1
    `

    assertTranspiled(code, expected)
  })

  it('transpiles a continue in a for loop nested in a while loop', () => {
    const code = `
    function main() {
      let x = 0;

      while (x < 5) {
        for (const y of [1, 2]) {
          if (y % 2 === 0) {
            continue;
          } else {
            x += 1;
          }
        }
      }
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - x: 0
        - switch1:
            switch:
              - condition: \${x < 5}
                steps:
                  - for1:
                      for:
                        value: y
                        in: [1, 2]
                        steps:
                          - switch2:
                              switch:
                                - condition: \${y % 2 == 0}
                                  next: continue
                                - condition: true
                                  steps:
                                    - assign2:
                                        assign:
                                          - x: \${x + 1}
                  - next2:
                      next: switch1
    `

    assertTranspiled(code, expected)
  })

  it('transpiles a break in a for loop nested in a while loop', () => {
    const code = `
    function main() {
      let x = 0;

      while (x < 5) {
        for (const y of [1, 2]) {
          if (y % 2 === 0) {
            break;
          } else {
            x += 1;
          }
        }
      }
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - x: 0
        - switch1:
            switch:
              - condition: \${x < 5}
                steps:
                  - for1:
                      for:
                        value: y
                        in: [1, 2]
                        steps:
                          - switch2:
                              switch:
                                - condition: \${y % 2 == 0}
                                  next: break
                                - condition: true
                                  steps:
                                    - assign2:
                                        assign:
                                          - x: \${x + 1}
                  - next2:
                      next: switch1
    `

    assertTranspiled(code, expected)
  })

  it('fails to parse for...of a number', () => {
    const code = `
    function main() {
      for (const x of 5) {
      }
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('fails to parse for...of a string', () => {
    const code = `
    function main() {
      for (const x of "fails") {
      }
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('fails to parse for...of a map', () => {
    const code = `
    function main() {
      for (const x of {key: 1}) {
      }
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('does not support the old for', () => {
    const code = `
    function main() {
      for (let x=0; i++; i < 10) {}
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('does not support for...in', () => {
    const code = `
    function main() {
      for (const x in [1, 2, 3]) {
      }
    }`

    expect(() => transpileText(code)).to.throw()
  })
})
