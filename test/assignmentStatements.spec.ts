import { expect } from 'chai'
import { transpileText } from '../src/transpiler/index.js'
import { transpileAndSnapshotTest } from './testutils.js'

describe('Assignment statement', () => {
  it(
    'transpiles a const assignment',
    transpileAndSnapshotTest('function main() { const a = 1; }'),
  )

  it(
    'transpiles a let assignment',
    transpileAndSnapshotTest('function main() { let a = 1; }'),
  )

  it('var declaration is not supported', () => {
    const code = `function main() { var a = 1; }`

    expect(() => transpileText(code)).to.throw()
  })

  it('using declaration is not supported', () => {
    const code = `function main() { using r = getResource(); }`

    expect(() => transpileText(code)).to.throw()
  })

  it('await using declaration is not supported', () => {
    const code = `function main() { await using db = getConnection(); }`

    expect(() => transpileText(code)).to.throw()
  })

  it(
    'allows variables to be re-declared',
    // This is invalid as a Typescript program, but valid as a ts2workflows/GCP Workflows program
    transpileAndSnapshotTest(`function main() {
      let x = 5;
      let x = 6;
    }`),
  )

  it(
    'transpiles a sequence of const assignments',
    transpileAndSnapshotTest('function main() { const a = 1, b=2, c=3; }'),
  )

  it(
    'transpiles an assignment expression',
    transpileAndSnapshotTest('function main() { let a; a = 1; }'),
  )

  it(
    'property assignment',
    transpileAndSnapshotTest('function main() { person.name = "Bean"; }'),
  )

  it(
    'member expression with map literal body',
    transpileAndSnapshotTest(`function main() {
      return { "value": 111 }.value;
    }`),
  )

  it(
    'deep member expression with map literal body',
    transpileAndSnapshotTest(`function main() {
      return { temperature: { value: 18, unit: "Celsius" } }.temperature.value;
    }`),
  )

  it(
    'member expression with function call body',
    transpileAndSnapshotTest(
      `function main() { const res = get_object().value; }`,
    ),
  )

  it(
    'map literal in an assignment step',
    transpileAndSnapshotTest(`function main() {
      const a = ({code: 56} as {code: number}).code
    }`),
  )

  it(
    'map literal as function argument',
    transpileAndSnapshotTest(`function main() {
      return get_friends({"name": "Bean"});
    }`),
  )

  it(
    'nested map literal and functions',
    transpileAndSnapshotTest(`function main() {
      const data = {friends: get_friends({name: "Bean"})};
    }`),
  )

  it(
    'nested map literal and functions 2',
    transpileAndSnapshotTest(`function main() {
      const data = {
        characters: [
          get_character({name: "Bean"}),
          get_character({name: "Elfo"}),
        ]
      };
    }`),
  )

  it(
    'nested map literal and functions 3',
    transpileAndSnapshotTest(`function main() {
      const data = [
        {
          name: get_name({personId: 1})
        }
      ];
    }`),
  )

  it(
    'deeply nested map literal and functions',
    transpileAndSnapshotTest(`function main() {
      const data = {
        friends: get_friends({name: get_name({personId: 1})})
      };
    }`),
  )

  it(
    'deeply nested map literal and functions 2',
    transpileAndSnapshotTest(`function main() {
      const data = {
        friends: get_friends([
          {name: get_name({personId: 1})},
          {name: get_name({personId: 2})}
        ])
      };
    }`),
  )

  it(
    'map literal in complex expression',
    transpileAndSnapshotTest(`function complex() {
      const codes = { success: "OK" }
      try {
        if (2*({value: 5}.value + 10) > 0) {
          return codes[{status: "success"}.status]
        }
      } catch {
        return "error"
      }
    }`),
  )

  it(
    'multiple map literals in an assignment statement',
    transpileAndSnapshotTest(`
    function main() {
      values[{a: [1, 2]}.a[0]] = values[{a: [3, 4]}.a[1]] + 1;
    }`),
  )

  it(
    'multiple map literals in a call statement',
    transpileAndSnapshotTest(`function main() {
      return get_friends({"name": "Bean"}, {"filter": {"age": "> 40"}});
    }`),
  )

  it(
    'extracts nested map only on one branches of combined assing step',
    transpileAndSnapshotTest(`function main() {
      const data = {friends: get_friends({name: "Bean"})};
      const data2 = {person: {name: "Bean"}}
    }`),
  )

  it(
    'indexed assignment',
    transpileAndSnapshotTest('function main() { values[3] = 10; }'),
  )

  it(
    'indexed assignment with a computed expression',
    transpileAndSnapshotTest(`function main() {
      const i = 10;
      values[i + 1] = 10;
    }`),
  )

  it(
    'indexed assignment with a function call expression as the index',
    transpileAndSnapshotTest(`function main() {
      values[getIndex()] = 10;
    }

    function getIndex() {
      return 5;
    }`),
  )

  it(
    'indexed assignment with a member expression as the index',
    transpileAndSnapshotTest(`function main() {
      const indexes = { first: 0 };
      values[indexes.first] = 10;
    }`),
  )

  it(
    'indexed assignment with a map literal in the index',
    transpileAndSnapshotTest(`function main() {
      values[{ i: 0 }.i] = 10;
    }`),
  )

  it(
    'object property assignment with a variable as a key',
    transpileAndSnapshotTest(`function main() {
      const key = "name";
      data[key] = "Bean";
    }`),
  )

  it(
    'object property assignment with a computed expression',
    transpileAndSnapshotTest(`function main() {
      data["na" + "me"] = "Bean";
    }`),
  )

  it(
    'object property assignment with a computed expression with variables',
    transpileAndSnapshotTest(`function main() {
      const prefix = "na";
      const postfix = "me";
      data[prefix + postfix] = "Bean";
    }`),
  )

  it(
    'assignment to a member expression',
    transpileAndSnapshotTest(`function main() {
      people[3].age = 38;
    }`),
  )

  it(
    'assignment to a member expression with a variable index',
    transpileAndSnapshotTest(`function main() {
      const i = 10;
      people[i].age = 38;
    }`),
  )

  it(
    'addition assignment',
    transpileAndSnapshotTest(`
    function main() {
      let x = 0;
      x += 5;
    }`),
  )

  it(
    'addition assignment to a member expression',
    transpileAndSnapshotTest(`
    function main() {
      people[4].age += 1;
    }`),
  )

  it(
    'addition assignment to a member expression with a computed expression',
    transpileAndSnapshotTest(`
    function main() {
      const i = 2;
      people[4 + i].age += 1;
    }`),
  )

  it(
    'compound assignment with a unary expression on LHS',
    transpileAndSnapshotTest(`
    function main() {
      values[-getIndex()] -= 1;
    }

    function getIndex() {
      return 1;
    }`),
  )

  it(
    'compound assignment with a list and map expressions on LHS',
    transpileAndSnapshotTest(`
    function main() {
      values[{"value": [1, 2, 3]}.value[0]] -= 1;
    }`),
  )

  it(
    'compound assignment to a member expression with side-effects',
    transpileAndSnapshotTest(`
    function main() {
      values[getIndex() + 4] -= 1;
    }

    function getIndex() {
      return 1;
    }`),
  )

  it(
    'compound assignment to a member expression with many side-effects',
    transpileAndSnapshotTest(`
    function main() {
      data.objects[objectIndex()].values[valueIndex()] /= 2;
    }

    function objectIndex() {
      return 2;
    }

    function valueIndex() {
      return 1;
    }`),
  )

  it(
    'call step in a compound assignment',
    transpileAndSnapshotTest(`
    function main(x) {
      x %= call_step(sum, {a: 10, b: 11});
    }

    function sum(a, b) {
      return a + b;
    }`),
  )

  it(
    'addition assignment with a complex expression',
    transpileAndSnapshotTest(`
    function main() {
      x += 2 * y + 10;
    }`),
  )

  it(
    'substraction assignment',
    transpileAndSnapshotTest(`
    function main() {
      let x = 0;
      x -= 5;
    }`),
  )

  it(
    'multiplication assignment',
    transpileAndSnapshotTest(`
    function main() {
      let x = 1;
      x *= 2;
    }`),
  )

  it(
    'division assignment',
    transpileAndSnapshotTest(`
    function main() {
      let x = 10;
      x /= 2;
    }`),
  )

  it(
    'logical and assignment',
    transpileAndSnapshotTest(`
    function main() {
      let x = false;
      x &&= true;
    }`),
  )

  it(
    'logical or assignment',
    transpileAndSnapshotTest(`
    function main() {
      let x = false;
      x ||= true;
    }`),
  )

  it('throws on unsupported compound operator', () => {
    const code = `
    function main() {
      let x = 1;
      x >>= 4;
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('throws if the left-hand side of an assignment is a complex expression', () => {
    const code = `
    function main() {
      2 * x = 4
    }
    `

    expect(() => transpileText(code)).to.throw()
  })

  it('throws if the left-hand side of an compound assignment is a complex expression', () => {
    const code = `
    function main() {
      2 * x += 4
    }
    `

    expect(() => transpileText(code)).to.throw()
  })

  it(
    'merges consequtive assignments into a single step',
    transpileAndSnapshotTest(`
    function main() {
      const a = {};
      const b = 'test';
      const c = 12;
      const d = c + 1;
      a.id = '1';
    }`),
  )

  it(
    'merges consequtive assignments into a single step in a nested scope',
    transpileAndSnapshotTest(`
    function main() {
      if (2 > 1) {
        const a = {};
        const b = 'test';
        const c = 12;
        const d = c + 1;
        a.id = '1';
      }
    }`),
  )

  it(
    'variable definition without initial value is treated as a null assignment',
    transpileAndSnapshotTest(`function main() {
      let a;
    }`),
  )

  it(
    'definite assignment is treated as a null assignment',
    transpileAndSnapshotTest(`function main() {
      let a!: number
      a = 5
    }`),
  )
})
