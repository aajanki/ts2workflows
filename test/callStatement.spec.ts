import { expect } from 'chai'
import { transpileText } from '../src/transpiler/index.js'
import { transpileAndSnapshotTest } from './testutils.js'
import { WorkflowSyntaxError } from '../src/errors.js'

describe('Function invocation statement', () => {
  it(
    'assignment of a function call result',
    transpileAndSnapshotTest('function main() { const name = getName(); }'),
  )

  it(
    'assignment of a function call result with anonymous parameters',
    transpileAndSnapshotTest('function main() { const three = add(1, 2); }'),
  )

  it(
    'assignment of a scoped function call result',
    transpileAndSnapshotTest(`function main() {
      const projectId = sys.get_env("GOOGLE_CLOUD_PROJECT_ID");
    }`),
  )

  it(
    'side effecting function call',
    transpileAndSnapshotTest(
      'function main() { writeLog("Everything going OK!"); }',
    ),
  )

  it(
    'transpiles blocking functions as call steps',
    transpileAndSnapshotTest(`function main() {
      sys.log(undefined, "ERROR", "Something bad happened");
    }`),
  )

  it(
    'assigns the return value of a blocking function call (variable declaration)',
    transpileAndSnapshotTest(`function main() {
      const response = http.get("https://visit.dreamland.test/");
    }`),
  )

  it(
    'assigns the return value of a blocking function call (assignment)',
    transpileAndSnapshotTest(`function main() {
      let response;
      response = http.get("https://visit.dreamland.test/");
    }`),
  )

  it(
    'a blocking function call and a map literal in the same expression',
    transpileAndSnapshotTest(`function main() {
      const response = combine(http.get("https://visit.dreamland.test/"), {values: [1, 2]}.values[0]);
    }`),
  )

  it(
    'assigns the return value of a blocking function call to a complex variable',
    transpileAndSnapshotTest(`function main() {
      const results = {};
      results.response = http.get("https://visit.dreamland.test/");
    }`),
  )

  it(
    'creates call steps for blocking calls in a condition',
    transpileAndSnapshotTest(`function check_post_result() {
      if (http.post("https://visit.dreamland.test/").code === 200) {
        return "ok"
      } else {
        return "error"
      }
    }`),
  )

  it(
    'creates call steps for blocking calls in a nested scopes',
    transpileAndSnapshotTest(`function scopes() {
      result = {}
      result.outer = http.get("https://visit.dreamland.test/outer.html")
      if (result.outer.code === 200) {
        try {
          return http.get("https://visit.dreamland.test/inner.html")
        } catch (e) {
          return "exception"
        }
      } else {
        return "error"
      }
    }`),
  )

  it(
    'creates call steps for blocking calls in for loops',
    transpileAndSnapshotTest(`function check_post_result() {
      for (const i of [1, 2, 3]) {
        const res = http.get(\`https://visit.dreamland.test/page-\${i}.html\`)
      }
    }`),
  )

  it(
    'creates call steps for blocking calls in return expressions',
    transpileAndSnapshotTest(`function download() {
      return http.get("https://visit.dreamland.test/")
    }`),
  )

  it(
    'creates call steps for blocking calls in complex expressions',
    transpileAndSnapshotTest(`function location() {
      return "response:" + \
        map.get(http.get("https://visit.dreamland.test/elfo.html"), "body") + \
        http.get("https://visit.dreamland.test/luci.html").body
    }`),
  )

  it(
    'generates assign and call steps in correct order in expressions',
    transpileAndSnapshotTest(`function main() {
      const url = "https://visit.dreamland.test/elfo.html";
      const message = "response:" + http.get(url).body;
      return message;
    }`),
  )

  it(
    'regression: parameter assignments and blocking call in correct order when the call result is type cast',
    transpileAndSnapshotTest(`
    function main() {
      const parent = 'projects/test/databases/(default)/documents';
      const collectionId = 'chatrooms';
      const result = googleapis.firestore.v1.projects.databases.documents.list(
        collectionId,
        parent,
      ) as unknown;

      return result;
    }
    `),
  )

  it(
    'does not output undefined arguments in blocking calls',
    transpileAndSnapshotTest(`function main() {
      const docname =
        'projects/test/databases/(default)/documents/tvshows/disenchantment';
      const updated = googleapis.firestore.v1.projects.databases.documents.patch(
        docname,
        undefined,
        undefined,
        { fieldPaths: ['rating'] },
        { fields: { rating: { doubleValue: 9.0 } } },
      );

      return updated;
    }`),
  )

  it(
    'does not output undefined arguments in blocking calls in expressions',
    transpileAndSnapshotTest(`function main() {
      const docname =
        'projects/test/databases/(default)/documents/tvshows/disenchantment';
      const updated = googleapis.firestore.v1.projects.databases.documents.patch(
        docname,
        undefined,
        undefined,
        { fieldPaths: ['rating'] },
        { fields: { rating: { doubleValue: 9.0 } } },
      ).updateTime;

      return updated;
    }`),
  )

  it(
    'creates call steps for nested blocking calls',
    transpileAndSnapshotTest(`function nested() {
      return http.get(http.get(http.get("https://example.com/redirected.json").body).body)
    }`),
  )

  it(
    'creates call steps for a nested blocking nested in non-blocking calls',
    transpileAndSnapshotTest(`function nested() {
      return map.get(map.get(http.get("https://example.com/redirected.json"), "body"), "value")
    }`),
  )

  it(
    'ignores extra arguments in a blocking function call',
    transpileAndSnapshotTest(`function main() {
      sys.sleep(1000, 2000, 3000)
    }`),
  )

  it(
    'ignores extra arguments in a blocking function call in a nested expression',
    transpileAndSnapshotTest(`function main(callbackobj) {
      handle(events.await_callback(callbackobj, 1000, 'a', null, 89))
    }`),
  )

  it(
    'call_step() outputs a call step',
    transpileAndSnapshotTest(`function main() {
      call_step(sys.log, {
        json: {"message": "Meow. That's what cats say, right?"},
        severity: "DEBUG"
      })
    }`),
  )

  it(
    'call_step() outputs a call step 2',
    transpileAndSnapshotTest(`function main() {
      call_step(sys.log, {
        json: {data: {name: "Oona", occupations: ["queen", "pirate"]}},
        severity: "INFO"
      })
    }`),
  )

  it(
    'call_step() with a return value',
    transpileAndSnapshotTest(`function main() {
      const response = call_step(http.post, {
        url: "https://visit.dreamland.test/",
        body: {
          "user": "bean"
        }
      })
    }`),
  )

  it(
    'call_step() with a return value assigned to a member variable',
    transpileAndSnapshotTest(`function main() {
      const data = {}
      data.response = call_step(http.post, {
        url: "https://visit.dreamland.test/",
        body: {
          "user": "bean"
        }
      })
    }`),
  )

  it(
    'call_step() without function arguments',
    transpileAndSnapshotTest(`function main() {
      const timestamp = call_step(sys.now)
    }`),
  )

  it('call_step() requires at least a function to be called', () => {
    const code = `function main() {
      const res = call_step()
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects call_step() called with a non-function as the first argument', () => {
    const code = `function main() {
      call_step(5)
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects call_step() called with a non map literal as the second argument', () => {
    const code = `function main() {
      call_step(http.get, 5);
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('complex computed properties are not supported in call_step()', () => {
    const code = `function main() {
      call_step(sys[get_name()]);
    }

    function get_name() {
      return "now"
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('call_step() as part of a complex expression is not yet supported', () => {
    const code = `function main() {
      return call_step(http.get, { url: "https://visit.dreamland.test/" }).data
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('spread syntax is not supported as function call arguments', () => {
    const code = 'function main(values: number[]) { return sum(...values) }'

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects immediately invoked function expression', () => {
    const code = `
    function test() {
      return (() => { return 5 })();
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects a call of a returned function', () => {
    const code = `
    function test() {
      wrapped()();
    }

    function wrapped() {
      return () => 1;
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects a call of a returned function in expression', () => {
    const code = `
    function test() {
      return wrapped()();
    }

    function wrapped() {
      return () => 1;
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects function calls at top level', () => {
    const code = `
    function main() {
      return 1;
    }

    main();
    `

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })
})
