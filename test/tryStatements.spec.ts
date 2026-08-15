import { expect } from 'chai'
import { transpileText } from '../src/transpiler/index.js'
import { transpileAndSnapshotTest } from './testutils.js'
import { InternalTranspilingError, WorkflowSyntaxError } from '../src/errors.js'
import { TSError } from '@typescript-eslint/typescript-estree'

describe('Try-catch-finally statement', () => {
  it(
    'transpiles try-catch statement',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch (err) {
        if (err.code === 404) {
          return "Not found";
        }
      }
    }`,
    ),
  )

  it(
    'transpiles try-catch without an error variable',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
    }`,
    ),
  )

  it(
    'empty try block',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
      } catch {
        log("Error!");
      }
    }`,
    ),
  )

  it(
    'empty catch block',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
        throw 1;
      } catch {}
    }`,
    ),
  )

  it(
    'transpiles try-catch-finally statement',
    transpileAndSnapshotTest(
      `
    function safeWrite(data) {
      try {
        writeData(data);
      } catch (err) {
        sys.log(err);
      } finally {
        closeConnection();
      }
    }`,
    ),
  )

  it(
    'transpiles try-catch-finally statement with a return statement in the try block',
    transpileAndSnapshotTest(
      `
    function safeWrite(data) {
      try {
        writeData(data);
        return "OK";
      } catch (err) {
        sys.log(err);
      } finally {
        closeConnection();
      }
    }`,
    ),
  )

  it(
    'transpiles try-catch-finally statement with a return statement in the catch block',
    transpileAndSnapshotTest(
      `
    function safeWrite(data) {
      try {
        writeData(data);
      } catch (err) {
        sys.log(err);
        return "Error!"
      } finally {
        closeConnection();
      }
    }`,
    ),
  )

  it(
    'transpiles try-catch-finally statement with a return statement in the finally block',
    transpileAndSnapshotTest(
      `
    function safeWrite(data) {
      try {
        writeData(data);
      } catch (err) {
        sys.log(err);
      } finally {
        closeConnection();
        return 0;
      }
    }`,
    ),
  )

  it(
    'transpiles try-catch with an empty finally block',
    transpileAndSnapshotTest(
      `
    function safeWrite(data) {
      try {
        writeData(data);
      } catch (err) {
        sys.log(err);
      } finally {
      }
    }`,
    ),
  )

  it(
    'transpiles try-catch-retry',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
        retry_policy(http.default_retry);

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
    }`,
    ),
  )

  it(
    'transpiles try-catch-retry-finally',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
        retry_policy(http.default_retry);

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      } finally {
        closeConnection();
      }
    }`,
    ),
  )

  it(
    'transpiles try-finally without a catch block',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
        retry_policy(http.default_retry);

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } finally {
        closeConnection();
      }
    }`,
    ),
  )

  it(
    'transpiles nested try statements with a finally block on the inner try',
    transpileAndSnapshotTest(
      `
    function test() {
      try {
        try {
          return 1;
        } catch (err) {
          sys.log("Error");
        } finally {
          cleanup();
        }

        return 2;
      } catch (err) {
        sys.log("Error");
      }
    }`,
    ),
  )

  it(
    'transpiles nested try statements with a finally block on the outer try',
    transpileAndSnapshotTest(
      `
    function test() {
      try {
        try {
          return 1;
        } catch (err) {
          sys.log("Error");
        }

        return 2;
      } catch (err) {
        sys.log("Error");
      } finally {
        cleanup();
      }
    }`,
    ),
  )

  it(
    'transpiles nested try statements with finally blocks on all tries',
    transpileAndSnapshotTest(
      `
    function test() {
      try {
        try {
          return 1;
        } catch (err) {
          sys.log("Error");
        } finally {
          cleanup1();
        }

        return 2;
      } catch (err) {
        sys.log("Error");
      } finally {
        cleanup2();
      }
    }`,
    ),
  )

  it(
    'does retry with a retry predicate and backoff parameters',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
        retry_policy({
          predicate: http.default_retry_predicate,
          max_retries: 3,
          backoff: { initial_delay: 0.5, max_delay: 60, multiplier: 2.5 }
        });

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
    }`,
    ),
  )

  it('throws if retry policy is missing the backoff parameters', () => {
    const code = `
    function main() {
      try {
        retry_policy({
          predicate: http.default_retry_predicate,
          max_retries: 3,
        });

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('throws if retry policy backoff is not an object literal', () => {
    const code = `
    function main() {
      try {
        retry_policy({
          predicate: http.default_retry_predicate,
          max_retries: 3,
          backoff: 'yes, please'
        });

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('throws if retry policy predicate is not an identifier', () => {
    const code = `
    function main() {
      try {
        retry_policy({
          predicate: 'always',
          max_retries: 3,
          backoff: { initial_delay: 0.5, max_delay: 60, multiplier: 2.5 }
        });

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it(
    'retries with a custom predicate',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
        retry_policy({
          predicate: custom_predicate,
          max_retries: 3,
          backoff: { initial_delay: 0.5, max_delay: 60, multiplier: 2.5 }
        })

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
    }

    function custom_predicate(e) {
      return false
    }`,
    ),
  )

  it(
    'retry policy with string values',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
        retry_policy({
          predicate: http.default_retry_predicate,
          max_retries: "5",
          backoff: { initial_delay: "5", max_delay: "60", multiplier: "2" }
        });

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
    }`,
    ),
  )

  it(
    'retry policy with expressions',
    transpileAndSnapshotTest(
      `
    function main() {
      const multiplier = 2;

      try {
        retry_policy({
          predicate: http.default_retry_predicate,
          max_retries: sys.get_env("MAX_RETRIES"),
          backoff: { initial_delay: 0.5, max_delay: 60, multiplier: multiplier }
        });

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
    }`,
    ),
  )

  it(
    'accepts partial custom retry predicate specifications',
    transpileAndSnapshotTest(
      // According to the documentation all parameters are required. However,
      // missing values are actually accepted in my testing (Jan 2025).
      `
    function main() {
      try {
        retry_policy({
          predicate: http.default_retry_predicate,
          max_retries: 3,
          backoff: { max_delay: 60 } // missing initial_delay and multiplier
        });

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
    }`,
    ),
  )

  it(
    'accepts partial custom retry predicate specifications 2',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
        retry_policy({
          // predicate missing
          max_retries: 3,
          backoff: { initial_delay: 0.5, max_delay: 60, multiplier: 3 }
        });

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
    }`,
    ),
  )

  it(
    'applies retry policy only on one try on nested try blocks',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
        retry_policy(http.default_retry);

        const response = http.get("https://visit.dreamland.test/");
        try {
          const a = 1;
        } catch (e) {}
      } catch (e) {
        log("Error!");
      }
    }`,
    ),
  )

  it(
    'applies separate retry policies on nested try blocks',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
        retry_policy(http.default_retry);

        const response = http.get("https://visit.dreamland.test/");
        try {
          retry_policy(custom_retry);

          const a = 1;
        } catch (e) {}
      } catch (e) {
        log("Error!");
      }
    }`,
    ),
  )

  it('throws if retry is called without arguments', () => {
    const code = `
    function main() {
      try {
        retry_policy();

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('throws if retry policy is an unexpected data type', () => {
    const code = `
    function main() {
      try {
        retry_policy(1000);

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it(
    'ignores retry_policy() outside of try block',
    transpileAndSnapshotTest(
      `
    function main() {
      retry_policy(http.default_retry);

      try {
        const response = http.get("https://visit.dreamland.test/");
      } catch {
        log("Error!");
      }
    }`,
    ),
  )

  it(
    'ignores retry_policy() in catch block',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
        const response = http.get("https://visit.dreamland.test/");
      } catch {
        retry_policy(http.default_retry);

        log("Error!");
      }
    }`,
    ),
  )

  it('throws on try without a catch', () => {
    const code = `
    function main() {
      try {
        response = http.get("https://visit.dreamland.test/");
      }
    }`

    expect(() => transpileText(code)).to.throw(TSError)
  })

  it('throws on catch without a try', () => {
    const code = `
    function main() {
      catch (err) {
        if (err.code == 404) {
          return "Not found";
        }
      }
    }`

    expect(() => transpileText(code)).to.throw(TSError)
  })

  it('throws is there are multiple catch blocks', () => {
    const code = `
    function main() {
      try {
        response = http.get("https://visit.dreamland.test/");
      }
      catch (err) {
        throw err;
      }
      catch (err) {
        if (err.code == 404) {
          return "Not found";
        }
      }
    }`

    expect(() => transpileText(code)).to.throw(TSError)
  })

  it('object pattern as an exception variable is not supported', () => {
    const code = `
    function main() {
      try {
        response = http.get("https://visit.dreamland.test/");
      }
      catch ({ code }) {
        if (code == 404) {
          return "Not found";
        }
      }
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it("retry_policy() can't be used in expression", () => {
    const code = `
    function main() {
      try {
        const x = 1 + retry_policy(http.default_retry);

        const response = http.get("https://visit.dreamland.test/");
        return response;
      } catch {
        log("Error!");
      }
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it(
    'transpiles break inside try without a finalizer ',
    transpileAndSnapshotTest(
      `
    function main() {
      try {
        const total = 0;

        for (const i of [1, 2, 3]) {
          if (i % 2 === 0) {
            break;
          }

          total += i;
        }

        return total;
      } catch (err) {
        sys.log(err);
      }
    }`,
    ),
  )

  it('break is not yet supported inside a try if it has a finalizer', () => {
    const code = `
    function safeWrite(blocks) {
      try {
        for (const block of blocks) {
          const x = writeData(block);
          if (x < 0) {
            break;
          }
        }
      } catch (err) {
        sys.log(err);
      } finally {
        closeConnection();
      }
    }`

    expect(() => transpileText(code)).to.throw(InternalTranspilingError)
  })

  it('continue is not yet supported inside a try if it has a finalizer', () => {
    const code = `
    function safeWrite(blocks) {
      try {
        for (const block of blocks) {
          if (len(block) === 0) {
            continue;
          }

          writeData(block);
        }
      } catch (err) {
        sys.log(err);
      } finally {
        closeConnection();
      }
    }`

    expect(() => transpileText(code)).to.throw(InternalTranspilingError)
  })
})

describe('Throw statement', () => {
  it(
    'transpiles a throw with a literal string value',
    transpileAndSnapshotTest(`function main() { throw "Error!"; }`),
  )

  it(
    'transpiles a throw with a literal map value',
    transpileAndSnapshotTest(
      `
    function main() {
      throw {
        code: 98,
        message: "Access denied"
      };
    }`,
    ),
  )

  it(
    'transpiles a throw with a map value that includes a variable reference',
    transpileAndSnapshotTest(
      `
    function main() {
      const errorCode = 98
      throw {
        code: errorCode,
        message: "Access denied"
      };
    }`,
    ),
  )

  it(
    'transpiles a throw with an expression',
    transpileAndSnapshotTest(`function main(exception) { throw exception; }`),
  )
})
