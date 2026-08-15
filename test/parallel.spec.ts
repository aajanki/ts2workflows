import { expect } from 'chai'
import { transpileText } from '../src/transpiler/index.js'
import { transpileAndSnapshotTest } from './testutils.js'
import { WorkflowSyntaxError } from '../src/errors.js'

describe('Parallel statement', () => {
  it(
    'outputs parallel steps',
    transpileAndSnapshotTest(`
    function main() {
      parallel([
        () => {
          log("Hello from branch 1");
        },
        () => {
          log("Hello from branch 2");
        },
        () => {
          log("Hello from branch 3");
        },
      ]);
    }`),
  )

  it(
    'calls subworkflows by name',
    transpileAndSnapshotTest(`
    function main() {
      parallel([branch1, branch2]);
    }

    function branch1() {
      return "A";
    }

    function branch2() {
      return "B";
    }`),
  )

  it(
    'handles optional shared variables parameter',
    transpileAndSnapshotTest(`
    function main() {
      const results = {};

      parallel([
        () => {
          results.branch1 = "hello from branch 1";
        },
        () => {
          results.branch2 = "hello from branch 2";
        },
      ],
      { shared: ["results"] });
    }`),
  )

  it(
    'handles optional shared variables, exception policy and concurrency limit',
    transpileAndSnapshotTest(`
    function main() {
      const results = {};

      parallel([
        () => {
          results.branch1 = "hello from branch 1";
        },
        () => {
          results.branch2 = "hello from branch 2";
        },
      ], {
        shared: ["results"],
        exception_policy: "continueAll",
        concurrency_limit: 2
      });
    }`),
  )

  it('rejects non-number concurrency_limit', () => {
    const code = `
    function main() {
      parallel([branch1, branch2], {
        concurrency_limit: true
      });
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects non-list shared', () => {
    const code = `
    function main() {
      const results = {};

      parallel([
        () => {
          results.branch1 = "hello from branch 1";
        },
        () => {
          results.branch2 = "hello from branch 2";
        },
      ], {
        shared: "results",
        exception_policy: "continueAll",
        concurrency_limit: 2
      });
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects a list of non-strings in shared', () => {
    const code = `
    function main() {
      const results = {};

      parallel([
        () => {
          results.branch1 = "hello from branch 1";
        },
        () => {
          results.branch2 = "hello from branch 2";
        },
      ], {
        shared: [1],
        exception_policy: "continueAll",
        concurrency_limit: 2
      });
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects non-string exception_policy', () => {
    const code = `
    function main() {
      const results = {};

      parallel([
        () => {
          results.branch1 = "hello from branch 1";
        },
        () => {
          results.branch2 = "hello from branch 2";
        },
      ], {
        shared: ["results"],
        exception_policy: 999,
        concurrency_limit: 2
      });
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it(
    'outputs parallel iteration if called with a for..of loop in an arrow function',
    transpileAndSnapshotTest(
      `function main() {
      const total = 0;

      parallel(
        () => {
          for (const accountId of ['11', '22', '33', '44']) {
            total += getBalance(acccountId);
          }
        },
        { shared: ["total"] }
      );
    }`,
    ),
  )

  it('throws if an arrow function contains something else in addition to a for loop', () => {
    const code = `
    function main() {
      let total = 0;

      parallel(
        () => {
          for (const accountId of ['11', '22', '33', '44']) {
            total += getBalance(acccountId);
          }

          total += 1000
        },
        { shared: ["total"] }
      );
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('throws if a plain arrow function contains something else besides a for loop', () => {
    const code = `
    function main() {
      let total = 0;

      parallel(
        () => { total = 1 },
        { shared: ["total"] }
      );
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it("the return value of parallel() can't be assigned to a variable", () => {
    const code = `
      function main() {
          const result = parallel([
          () => {
            return "branch 1";
          },
          () => {
            return "branch 2";
          },
        ]);
      }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it("parallel() can't be used in expression", () => {
    const code = `
      function main() {
        const result = "result: " + parallel([
          () => {
            return "branch 1";
          },
          () => {
            return "branch 2";
          },
        ]);
      }
    `

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it("parallel() can't be used in expression 2", () => {
    const code = `
      function main() {
        return {
          result: parallel([
            () => {
              return "branch 1";
            },
            () => {
              return "branch 2";
            },
          ])
        };
      }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it("parallel() can't be used in an compound assignment expression", () => {
    const code = `
      function main(x) {
        x += parallel([
          () => {
            return "branch 1";
          },
          () => {
            return "branch 2";
          },
        ]);
      }
    `

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('throws if parallel is called with an expression as arrow function body', () => {
    const code = `
    function main() {
      parallel(() => 1);
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('throws if parallel is called with an expression as arrow function body 2', () => {
    const code = `
    function main() {
      parallel([() => 1, () => 2]);
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('throws if arrow function in parallel has arguments', () => {
    const code = `
    function main() {
      parallel((x) => { return x + 1 });
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('throws if arrow function in parallel has arguments 2', () => {
    const code = `
    function main() {
      let total = 0;

      parallel(
        [ (x) => { total += x } ],
        { shared: ["total"] }
      );
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('throws if parallel is called without arguments', () => {
    const code = `
    function main() {
      parallel();
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('throws if parallel is called with one non-function argument', () => {
    const code = `
    function main() {
      parallel(1);
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('throws if parallel is called with many non-function arguments', () => {
    const code = `
    function main() {
      parallel(1, 2, 3);
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('throws if parallel is called with an array of non-function arguments', () => {
    const code = `
    function main() {
      parallel([1, 2, 3]);
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })
})
