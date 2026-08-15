import { expect } from 'chai'
import { transpileText } from '../src/transpiler/index.js'
import { transpileAndSnapshotTest } from './testutils.js'

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
  it(
    'if statement',
    transpileAndSnapshotTest(
      `
    function main(x) {
      if (x > 0) {
        sys.log("positive")
      }
    }`,
    ),
  )

  it(
    'if-else statement',
    transpileAndSnapshotTest(
      `
    function main(x) {
      if (x > 0) {
        return "positive";
      } else {
        return "non-positive";
      }
    }`,
    ),
  )

  it(
    'if statement with multiple branches',
    transpileAndSnapshotTest(
      `
    function main(x) {
      if (x > 0) {
        return "positive";
      } else if (x === 0) {
        return "zero";
      } else {
        return "negative";
      }
    }`,
    ),
  )

  it(
    'if with a non-block statement',
    transpileAndSnapshotTest(
      `
    function main(x) {
      if (x > 0)
        return "positive";
      else
        return "non-positive";
    }`,
    ),
  )

  it(
    'if with an empty body',
    transpileAndSnapshotTest(
      `
    function main(x) {
      let isPositive = true;
      if (x > 0) {} else { isPositive = false; }
    }`,
    ),
  )
})

describe('Switch statement', () => {
  it(
    'switch statement',
    transpileAndSnapshotTest(
      `
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
    }`,
    ),
  )

  it(
    'switch statement as the last statement in a block',
    transpileAndSnapshotTest(
      `
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
    }`,
    ),
  )

  it(
    'switch statement as a last statement in a nested block',
    transpileAndSnapshotTest(
      `
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
    }`,
    ),
  )

  it(
    'fall-through',
    transpileAndSnapshotTest(
      `
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
    }`,
    ),
  )

  it(
    'fall-through as the last case',
    transpileAndSnapshotTest(
      `
    function main(person: string): string {
      let royal: boolean = false;

      switch (person) {
        case "Bean":
          royal = true;

        case "Sorcerio":
        default:
      }

      return royal;
    }`,
    ),
  )
})

describe('Return statement', () => {
  it(
    'return statement without a value',
    transpileAndSnapshotTest(`function main() { return; }`),
  )

  it(
    'return a literal value',
    transpileAndSnapshotTest(`function main() { return "OK"; }`),
  )

  it(
    'return an expression',
    transpileAndSnapshotTest(`function addOne(x) { return x + 1; }`),
  )

  it(
    'return a map',
    transpileAndSnapshotTest(
      `function main() { return { result: "OK", value: 1 }; }`,
    ),
  )

  it(
    'return a list of maps',
    transpileAndSnapshotTest(
      `function main() { return [ { result: "OK", value: 1 } ]; }`,
    ),
  )

  it(
    'return a variable reference inside a map',
    transpileAndSnapshotTest(`function main(x) { return { value: x }; }`),
  )

  it(
    'return a member of a map',
    transpileAndSnapshotTest(`function main() { return {value: 5}.value; }`),
  )
})

describe('Empty statement', () => {
  it(
    'accepts an empty statement in a function',
    transpileAndSnapshotTest(
      `
    function main() {
      ;

      return 1;
    }`,
    ),
  )

  it(
    'accepts empty statements at top level',
    transpileAndSnapshotTest(
      `
    ;

    function main() {
      return 1;
    }

    ;
    `,
    ),
  )
})

describe('Labelled statement', () => {
  it(
    'labels steps',
    transpileAndSnapshotTest(
      `
    function signString(x: int): string {
      if (x > 0) {
        positive: return "x is positive"
      } else {
        nonpositive: return "x is not positive"
      }
    }`,
    ),
  )

  it(
    'takes the first label when combining assignment steps',
    transpileAndSnapshotTest(
      `
    function test() {
      const a = 1
      const b = 2
      setImportantVariable: const c = 3
      setAnotherVariable: const d = 4
    }`,
    ),
  )

  it(
    'temporary variables inside nested parallel steps should have a postfix',
    transpileAndSnapshotTest(
      `
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
    }`,
    ),
  )
})

describe('Debugger statement', () => {
  it(
    'ignores debugger statement',
    transpileAndSnapshotTest(
      `
    function main() {
      const x = 1;

      debugger;

      return x + 1;
    }`,
    ),
  )
})
