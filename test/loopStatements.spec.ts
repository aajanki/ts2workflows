import { expect } from 'chai'
import { transpileText } from '../src/transpiler/index.js'
import { transpileAndSnapshotTest } from './testutils.js'
import { WorkflowSyntaxError } from '../src/errors.js'

describe('Loops', () => {
  it(
    'transpiles a for loop',
    transpileAndSnapshotTest(`
    function main() {
      let total = 0;
      for (const x of [1, 2, 3]) {
        total = total + x;
      }
      return total;
    }`),
  )

  it(
    'transpiles a for loop with identifier as the for loop variable',
    transpileAndSnapshotTest(
      `function main() {
      let total = 0;
      for (x of [1, 2, 3]) {
        total = total + x;
      }
      return total;
    }`,
    ),
  )

  it(
    'transpiles a for loop with a let for loop variable',
    transpileAndSnapshotTest(
      `function main() {
      let total = 0;
      for (let x of [1, 2, 3]) {
        total = total + x;
      }
      return total;
    }`,
    ),
  )

  it(
    'transpiles a for loop with an empty body',
    transpileAndSnapshotTest(
      `function main() {
      for (const x of [1, 2, 3]) {
      }
    }`,
    ),
  )

  it(
    'transpiles a for loop over map keys',
    transpileAndSnapshotTest(
      `function main(my_map) {
      let total = 0;
      for (const key of keys(my_map)) {
        total = total + my_map[key];
      }
      return total;
    }`,
    ),
  )

  it(
    'transpiles a continue in a for loop body',
    transpileAndSnapshotTest(
      `function main() {
      let total = 0;
      for (const x of [1, 2, 3, 4]) {
        if (x % 2 === 0) {
          continue;
        }

        total = total + x;
      }
      return total;
    }`,
    ),
  )

  it(
    'accepts a continue with a label',
    transpileAndSnapshotTest(
      `function main() {
      let total = 0;
      loop: for (const x of [1, 2, 3, 4]) {
        if (x % 2 === 0) {
          continue loop;
        }

        total = total + x;
      }
      return total;
    }`,
    ),
  )

  it(
    'transpiles a break in a for loop body',
    transpileAndSnapshotTest(
      `function main() {
      let total = 0;
      for (const x of [1, 2, 3, 4]) {
        if (total > 5) {
          break;
        }

        total = total + x;
      }
      return total;
    }`,
    ),
  )

  it(
    'accepts a break with a label',
    transpileAndSnapshotTest(
      `function main() {
      let total = 0;
      loop: for (const x of [1, 2, 3, 4]) {
        if (total > 5) {
          break loop;
        }

        total = total + x;
      }
      return total;
    }`,
    ),
  )

  it(
    'transpiles a for loop of a list expression',
    transpileAndSnapshotTest(
      `
    function main() {
      let total = 0;
      const values = [1, 2, 3];
      for (let x of values) {
        total = total + x;
      }
      return total;
    }`,
    ),
  )

  it(
    'transpiles nested for loops with continue on the outer loop',
    transpileAndSnapshotTest(
      `
    function main() {
      let total = 0;
      for (let x of [1, 2]) {
        for (let y of [3, 4]) {
          total += y;
        }

        continue;
      }
    }`,
    ),
  )

  it(
    'transpiles nested for loops with continue on the inner loop',
    transpileAndSnapshotTest(
      `
    function main() {
      let total = 0;
      for (let x of [1, 2]) {
        for (let y of [3, 4]) {
          total += y;
          continue;
        }
      }
    }`,
    ),
  )

  it(
    'transpiles a while loop',
    transpileAndSnapshotTest(
      `
    function main() {
      const i = 5;
      while (i > 0) {
        i -= 1;
      }
    }`,
    ),
  )

  it(
    'transpiles a while loop with a single-statement body',
    transpileAndSnapshotTest(
      `
    function main() {
      const i = 5;
      while (i > 0) i -= 1;
    }`,
    ),
  )

  it(
    'transpiles a break in a while loop',
    transpileAndSnapshotTest(
      `
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
    }`,
    ),
  )

  it(
    'transpiles a break and a while loop as the last statement in a block',
    transpileAndSnapshotTest(
      `
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
    }`,
    ),
  )

  it(
    'transpiles a continue in a while loop',
    transpileAndSnapshotTest(
      `
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
    }`,
    ),
  )

  it(
    'transpiles a do...while loop',
    transpileAndSnapshotTest(
      `
    function main() {
      const i = 5;
      do {
        i -= 1;
      } while (i > 0);
    }`,
    ),
  )

  it(
    'transpiles a break in a do...while loop',
    transpileAndSnapshotTest(
      `
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
    }`,
    ),
  )

  it(
    'transpiles a break and a do...while loop as the last statement in a block',
    transpileAndSnapshotTest(
      `
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
    }`,
    ),
  )

  it(
    'transpiles a break in a do...while loop nested in try statement',
    transpileAndSnapshotTest(
      `
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
    }`,
    ),
  )

  it(
    'transpiles a continue in a do...while loop',
    transpileAndSnapshotTest(
      `
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
    }`,
    ),
  )

  it(
    'transpiles nested while loops with continue on the outer loop',
    transpileAndSnapshotTest(
      `
    function main() {
      let x = 0;

      while (x < 5) {
        continue;

        while (x < 5) {
          x += 1;
        }
      }
    }`,
    ),
  )

  it(
    'transpiles nested while loops with continue on the inner loop',
    transpileAndSnapshotTest(
      `
    function main() {
      let x = 0;

      while (x < 5) {
        while (x < 5) {
          continue;

          x += 1;
        }
      }
    }`,
    ),
  )

  it(
    'transpiles nested while loops with continue on all levels',
    transpileAndSnapshotTest(
      `
    function main() {
      let x = 0;

      while (x < 5) {
        continue;

        while (x < 5) {
          continue;

          x += 1;
        }
      }
    }`,
    ),
  )

  it(
    'transpiles a continue in a for loop nested in a while loop',
    transpileAndSnapshotTest(
      `
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
    }`,
    ),
  )

  it(
    'transpiles a break in a for loop nested in a while loop',
    transpileAndSnapshotTest(
      `
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
    }`,
    ),
  )

  it('fails to parse for...of a number', () => {
    const code = `
    function main() {
      for (const x of 5) {
      }
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('fails to parse for...of a string', () => {
    const code = `
    function main() {
      for (const x of "fails") {
      }
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('fails to parse for...of a map', () => {
    const code = `
    function main() {
      for (const x of {key: 1}) {
      }
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('does not support the old for', () => {
    const code = `
    function main() {
      for (let x=0; i++; i < 10) {}
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('does not support for...in', () => {
    const code = `
    function main() {
      for (const x in [1, 2, 3]) {
      }
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('object pattern is not supported in for...of', () => {
    const code = `
    function main() {
      for ({ val } of [{ val: 1 }, { val: 2}]) {
      }
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('object pattern declaration is not supported in for...of', () => {
    const code = `
    function main() {
      for (const { val } of [{ val: 1 }, { val: 2}]) {
      }
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })
})
