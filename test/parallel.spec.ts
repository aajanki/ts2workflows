import { expect } from 'chai'
import { transpile } from '../src/transpiler/index.js'
import { assertTranspiled } from './testutils.js'

describe('Parallel statement', () => {
  it('outputs parallel steps', () => {
    const code = `
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
    }`

    const expected = `
    main:
      steps:
        - parallel1:
            parallel:
              branches:
                - branch1:
                    steps:
                      - assign1:
                          assign:
                            - __temp_parallel1: \${log("Hello from branch 1")}
                - branch2:
                    steps:
                      - assign2:
                          assign:
                            - __temp_parallel1: \${log("Hello from branch 2")}
                - branch3:
                    steps:
                      - assign3:
                          assign:
                            - __temp_parallel1: \${log("Hello from branch 3")}
    `

    assertTranspiled(code, expected)
  })

  it('calls subworkflows by name', () => {
    const code = `
    function main() {
      parallel([branch1, branch2]);
    }

    function branch1() {
      return "A";
    }

    function branch2() {
      return "B";
    }`

    const expected = `
    main:
      steps:
        - parallel1:
            parallel:
              branches:
                - branch1:
                    steps:
                      - call_branch1_1:
                          call: branch1
                - branch2:
                    steps:
                      - call_branch2_1:
                          call: branch2

    branch1:
      steps:
        - return1:
            return: "A"

    branch2:
      steps:
        - return1:
            return: "B"
    `

    assertTranspiled(code, expected)
  })

  it('handles optional shared variables parameter', () => {
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
      ],
      { shared: ["results"] });
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - results: {}
        - parallel1:
            parallel:
              shared:
                - results
              branches:
                - branch1:
                    steps:
                      - assign2:
                          assign:
                            - results.branch1: hello from branch 1
                - branch2:
                    steps:
                      - assign3:
                          assign:
                            - results.branch2: hello from branch 2
    `

    assertTranspiled(code, expected)
  })

  it('handles optional shared variables, exception policy and concurrency limit', () => {
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
        exception_policy: "continueAll",
        concurrency_limit: 2
      });
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - results: {}
        - parallel1:
            parallel:
              shared:
                - results
              concurrency_limit: 2
              exception_policy: continueAll
              branches:
                - branch1:
                    steps:
                      - assign2:
                          assign:
                            - results.branch1: hello from branch 1
                - branch2:
                    steps:
                      - assign3:
                          assign:
                            - results.branch2: hello from branch 2
    `

    assertTranspiled(code, expected)
  })

  it('rejects invalid types in optional parameters', () => {
    const code = `
    function main() {
      parallel([branch1, branch2], {
        concurrency_limit: true
      });
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('outputs parallel iteration if called with a for..of loop in an arrow function', () => {
    const code = `
    function main() {
      const total = 0;

      parallel(
        () => {
          for (const accountId of ['11', '22', '33', '44']) {
            total += getBalance(acccountId);
          }
        },
        { shared: ["total"] }
      );
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - total: 0
        - parallel1:
            parallel:
              shared:
                - total
              for:
                value: accountId
                in:
                  - "11"
                  - "22"
                  - "33"
                  - "44"
                steps:
                  - assign2:
                      assign:
                        - total: \${total + getBalance(acccountId)}
    `

    assertTranspiled(code, expected)
  })

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

    expect(() => transpile(code)).to.throw()
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

    expect(() => transpile(code)).to.throw()
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

    expect(() => transpile(code)).to.throw()
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

    expect(() => transpile(code)).to.throw()
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

    expect(() => transpile(code)).to.throw()
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

    expect(() => transpile(code)).to.throw()
  })

  it('throws if parallel is called with an expression as arrow function body', () => {
    const code = `
    function main() {
      parallel(() => 1);
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('throws if parallel is called with an expression as arrow function body 2', () => {
    const code = `
    function main() {
      parallel([() => 1, () => 2]);
    }`

    expect(() => transpile(code)).to.throw()
  })

  it('throws if arrow function in parallel has arguments', () => {
    const code = `
    function main() {
      parallel((x) => { return x + 1 });
    }`

    expect(() => transpile(code)).to.throw()
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

    expect(() => transpile(code)).to.throw()
  })

  it('throws if parallel is called without arguments', () => {
    const code = `
    function main() {
      parallel();
    }`

    expect(() => transpile(code)).to.throw()
  })
})
