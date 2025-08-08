import { expect } from 'chai'
import {
  LiteralValueOrLiteralExpression,
  expressionToLiteralValueOrLiteralExpression,
} from '../src/ast/expressions.js'
import { assertTranspiled, parseExpression } from './testutils.js'
import { transpileText } from '../src/transpiler/index.js'
import { WorkflowSyntaxError } from '../src/errors.js'
import { TSError } from '@typescript-eslint/typescript-estree'

describe('Literals', () => {
  it('parses null', () => {
    assertExpression('null', null)
  })

  it('parses a number', () => {
    assertExpression('9', 9)
  })

  it('parses a string', () => {
    assertExpression('"Good news, everyone!"', 'Good news, everyone!')
  })

  it('parses escaped quotes correctly', () => {
    assertExpression(
      '"Tiabeanie \\"Bean\\" Mariabeanie de la Rochambeaux Grunkwitz"',
      'Tiabeanie "Bean" Mariabeanie de la Rochambeaux Grunkwitz',
    )
  })

  it('parses escaped tabs correctly', () => {
    assertExpression('"Bean\\tElfo\\tLuci"', 'Bean\tElfo\tLuci')
  })

  it('parses escaped line feeds', () => {
    assertExpression('"Dagmar\\nOona"', 'Dagmar\nOona')
  })

  it('parses escaped backslashes', () => {
    assertExpression('"Mop Girl\\\\Miri"', 'Mop Girl\\Miri')
  })

  it('parses unicode character references', () => {
    assertExpression('"King Z\\u00f8g"', 'King Zøg')
  })

  it('parses strings consiting of digits as strings', () => {
    assertExpression('"123"', '123')
  })

  it('parses strings with JSON-like values correctly', () => {
    assertExpression('"null"', 'null')
    assertExpression('"undefined"', 'undefined')
    assertExpression('"false"', 'false')
    assertExpression(
      '"[\\"this\\", \\"is\\", \\"a\\", \\"string\\"]"',
      '["this", "is", "a", "string"]',
    )
    assertExpression(
      '"{\\"this_is\\":   \\"a string\\"  }"',
      '{"this_is":   "a string"  }',
    )
  })

  it('parses lists', () => {
    assertExpression('[1, 2, 3]', [1, 2, 3])
    assertExpression('["Y", "Yes", 1, true]', ['Y', 'Yes', 1, true])
  })

  it('parses nested lists', () => {
    assertExpression('[["first", 1], ["second", 2], ["null", null]]', [
      ['first', 1],
      ['second', 2],
      ['null', null],
    ])
    assertExpression('[{"name": "Dagmar"}, {"name": "Oona"}]', [
      { name: 'Dagmar' },
      { name: 'Oona' },
    ])
  })

  it('treats holes in lists as nulls', () => {
    assertExpression('[1, , 2]', [1, null, 2])
  })

  it('rejects rest elements in lists', () => {
    const code = 'function test(x) { return [...x] }'

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('parses maps', () => {
    assertExpression('{"name": "Merkimer", "race": "pig"}', {
      name: 'Merkimer',
      race: 'pig',
    })
  })

  it('parses maps with identifier as keys', () => {
    const code = 'function test() { const x = {name: "Merkimer", race: "pig"} }'
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - x:
                  name: Merkimer
                  race: pig
    `

    assertTranspiled(code, expected)
  })

  it('parses maps with special characters in keys', () => {
    const code =
      'function test() { const x = {"special!": 1, "\'quotes\\"in keys": 2, "...": 3} }'
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - x:
                  "special!": 1
                  "'quotes\\"in keys": 2
                  ...: 3
    `

    assertTranspiled(code, expected)
  })

  it('rejects non-string map keys', () => {
    const code = 'function test() { const x = {1: "one", 2: "two"} }'

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects rest elements in maps', () => {
    const code = 'function test(x) { return {...x} }'

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('parses nested maps', () => {
    assertExpression(
      '{"address": {"building": "The Dreamland Castle", "kingdom": "Dreamland"}}',
      { address: { building: 'The Dreamland Castle', kingdom: 'Dreamland' } },
    )
    assertExpression('{"characters": ["Bean", "Elfo", "Luci"]}', {
      characters: ['Bean', 'Elfo', 'Luci'],
    })
  })

  it('template literals', () => {
    assertExpression('``', '')
    assertExpression('`abc`', 'abc')
    assertExpression(
      '`Hello ${name}!`',
      '${"Hello " + default(name, "null") + "!"}',
    )
    assertExpression(
      '`Value of ${name} is ${value}.`',
      '${"Value of " + default(name, "null") + " is " + default(value, "null") + "."}',
    )
    assertExpression(
      '`${a}${b}`',
      '${"" + default(a, "null") + "" + default(b, "null")}',
    )
    assertExpression(
      '`The sum is ${x + y}`',
      '${"The sum is " + default(x + y, "null")}',
    )
    assertExpression(
      '`Logarithm of 4 is ${log(4)}`',
      '${"Logarithm of 4 is " + default(log(4), "null")}',
    )
    assertExpression('`value:\\t${x}`', '${"value:\\t" + default(x, "null")}')
    assertExpression('`${null}`', '${"" + default(null, "null")}')
  })

  it('rejects BigInt literals', () => {
    const code = `function test() { x = 18446744073709552000n }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('rejects RegExp literals', () => {
    const code = `function test() { x = /a.c/ }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })
})

describe('Expressions and operators', () => {
  it('parses binary operators', () => {
    assertExpression('0', 0)
    assertExpression('1 + 2', '${1 + 2}')
    assertExpression('5 + 1/3', '${5 + 1 / 3}')
    assertExpression('"Queen" + " Dagmar"', '${"Queen" + " Dagmar"}')
  })

  it('throws on an unsupported binary operator', () => {
    const code = `function test(x) {
      return x >>> 2;
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('parses unary operators', () => {
    assertExpression('-25', -25)
    assertExpression('+25', 25)
    assertExpression('!0', '${not 0}')
    assertExpression('!true', '${not true}')
    assertExpression('-a', '${-a}')
    assertExpression('+a', '${+a}')
    assertExpression('a - + b', '${a - +b}')
    assertExpression('a * -b', '${a * -b}')
    assertExpression('!a', '${not a}')
  })

  it('throws on an unsupported unary operator', () => {
    const code = `function test(x) {
      return ~x;
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('parses logical expressions', () => {
    assertExpression(
      '!(status in ["OK", "success"])',
      '${not (status in ["OK", "success"])}',
    )
    assertExpression('(y >= 0) && !(x >= 0)', '${y >= 0 and not (x >= 0)}')
  })

  it('parses remaider divisions', () => {
    assertExpression('x % 3', '${x % 3}')
    assertExpression('x % t == 0', '${x % t == 0}')
  })

  it('parses variable references', () => {
    assertExpression('a - 1', '${a - 1}')
    assertExpression('100 + 2*x', '${100 + 2 * x}')
    assertExpression('host.ip_address', '${host.ip_address}')
  })

  it('parses inequality operators', () => {
    assertExpression('value > 100', '${value > 100}')
    assertExpression('status >= 0', '${status >= 0}')
    assertExpression('-1 < 0', '${-1 < 0}')
    assertExpression('x <= 0', '${x <= 0}')
    assertExpression('status != 0', '${status != 0}')
    assertExpression('response != "ERROR"', '${response != "ERROR"}')
    assertExpression('response !== "ERROR"', '${response != "ERROR"}')
    assertExpression('country == "Norway"', '${country == "Norway"}')
    assertExpression('country === "Norway"', '${country == "Norway"}')
  })

  it('parses boolean operators', () => {
    assertExpression('inputOK && receiverReady', '${inputOK and receiverReady}')
    assertExpression('isEven || isPositive', '${isEven or isPositive}')
    assertExpression(
      '(x > 15) && !(x % 3 == 0)',
      '${x > 15 and not (x % 3 == 0)}',
    )
  })

  it('parses membership expressions', () => {
    assertExpression('8 in luckyNumbers', '${8 in luckyNumbers}')
    assertExpression(
      '"Elfo" in ["Luci", "Elfo"]',
      '${"Elfo" in ["Luci", "Elfo"]}',
    )
  })

  it('parses parenthesized expressions', () => {
    assertExpression('(1)', 1)
    assertExpression('2*(x + 5)', '${2 * (x + 5)}')
    assertExpression('2*(3*(4 + x))', '${2 * 3 * (4 + x)}')
    assertExpression(
      '("Status: " + statusMessage)',
      '${"Status: " + statusMessage}',
    )
    assertExpression('(age >= 18) && (age < 100)', '${age >= 18 and age < 100}')
    assertExpression(
      '(name in ["Bean", "Derek", "Jasper"]) || (affiliation == "Dreamland")',
      '${name in ["Bean", "Derek", "Jasper"] or affiliation == "Dreamland"}',
    )
  })

  it('adds parenthesis if operator precedence requires it', () => {
    assertExpression('(4 + (x + 6))', '${4 + x + 6}')
    assertExpression('(4 + (x * 6))', '${4 + x * 6}')
    assertExpression('(4 * (x + 6))', '${4 * (x + 6)}')
    assertExpression('(4 + x) + 6', '${4 + x + 6}')
    assertExpression('(4 * x) + 6', '${4 * x + 6}')
    assertExpression('(4 + x) * 6', '${(4 + x) * 6}')
  })

  it('parses expressions in lists', () => {
    assertExpression('[0, 1+2]', [0, '${1 + 2}'])
    assertExpression('[1+2, 2*(x + 10)]', ['${1 + 2}', '${2 * (x + 10)}'])
  })

  it('parses nested expressions in lists', () => {
    assertExpression('["Bean" in ["Oona", "Bean"]]', [
      '${"Bean" in ["Oona", "Bean"]}',
    ])
    assertExpression('["Bean" in {"Bean": 1}]', ['${"Bean" in {"Bean": 1}}'])
  })

  it('parses expressions as map values', () => {
    // The transpiler fails to parse plain JSON objects with expressions as values. It works
    // only on assignments.
    const code = 'function test() { const _ = {"name": name} }'
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - _:
                  name: \${name}
    `

    assertTranspiled(code, expected)
  })

  it('parses expressions as map values 2', () => {
    const code = 'function test() { const _ = {"age": thisYear - birthYear} }'
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - _:
                  age: \${thisYear - birthYear}
    `

    assertTranspiled(code, expected)
  })

  it('parses expressions as map values 3', () => {
    const code = 'function test() { const _ = {"id": "ID-" + identifiers[2]} }'
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - _:
                  id: \${"ID-" + identifiers[2]}
    `

    assertTranspiled(code, expected)
  })

  it('parses nested expression in map values', () => {
    const code = 'function test() { const _ = {"success": code in [200, 201]} }'
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - _:
                  success: \${code in [200, 201]}
    `
    assertTranspiled(code, expected)
  })

  it('parses nested expression in map values 2', () => {
    const code =
      'function test() { const _ = {"isKnownLocation": location in {"Dreamland": 1, "Maru": 2}} }'
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - __temp0:
                  Dreamland: 1
                  Maru: 2
              - _:
                  isKnownLocation: '\${location in __temp0}'
    `
    assertTranspiled(code, expected)
  })

  it('parses nested expression in map values 3', () => {
    const code = 'function test() { const _ = {"values": {"next": a + 1}} }'
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - _:
                  values:
                      next: \${a + 1}
    `

    assertTranspiled(code, expected)
  })

  it('parses non-alphanumeric keys', () => {
    assertExpression('{"important!key": "value"}', { 'important!key': 'value' })
    assertExpression('myMap["important!key"]', '${myMap["important!key"]}')
  })

  it('parses variable as key in maps', () => {
    assertExpression('myMap[dynamicKey]', '${myMap[dynamicKey]}')
  })

  it('parses function expressions', () => {
    assertExpression('int("5")', '${int("5")}')
    assertExpression('sys.now()', '${sys.now()}')
    assertExpression('time.format(sys.now())', '${time.format(sys.now())}')
    assertExpression(
      'time.format(sys.now()) + " " + text.decode(base64.decode("VGlhYmVhbmll"))',
      '${time.format(sys.now()) + " " + text.decode(base64.decode("VGlhYmVhbmll"))}',
    )
  })

  it('parses conditional expressions', () => {
    assertExpression(
      'x > 0 ? "positive" : "not positive"',
      '${if(x > 0, "positive", "not positive")}',
    )
  })

  it('parses nullish coalescing operator', () => {
    assertExpression('x ?? "default value"', '${default(x, "default value")}')
    assertExpression('null ?? ""', '${default(null, "")}')
  })

  it('parses the "as" expression', () => {
    assertExpression('1 as number', 1)
    assertExpression('error as {code: number}', '${error}')
    assertExpression('(error as {code: number}).number', '${error.number}')
  })

  it('transpiles optional chaining as map.get()', () => {
    const code = `function test(data) {
      return data?.name;
    }`
    const expected = `
    test:
      params:
        - data
      steps:
        - return1:
            return: \${map.get(data, "name")}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles nested optional chains', () => {
    const code = `function test(data) {
      return data.person[3].address?.city?.id;
    }`
    const expected = `
    test:
      params:
        - data
      steps:
        - return1:
            return: \${map.get(data.person[3], ["address", "city", "id"])}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles optional chains with alternativing optional and non-optional elements', () => {
    const code = `function test(data) {
      return data.person?.address.city?.id;
    }`
    const expected = `
    test:
      params:
        - data
      steps:
        - return1:
            return: \${map.get(data, ["person", "address", "city", "id"])}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles (data?.a).b', () => {
    const code = `function test(data) {
      return (data?.a).b;
    }`
    const expected = `
    test:
      params:
        - data
      steps:
        - return1:
            return: \${map.get(data, "a").b}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles (data?.a)?.b', () => {
    const code = `function test(data) {
      return (data?.a)?.b;
    }`
    const expected = `
    test:
      params:
        - data
      steps:
        - return1:
            return: \${map.get(map.get(data, "a"), "b")}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles optional chaining with bracket notation', () => {
    const code = `function test(data) {
      return data?.["na" + "me"];
    }`
    const expected = `
    test:
      params:
        - data
      steps:
        - return1:
            return: \${map.get(data, "na" + "me")}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles type alias in optional chaining', () => {
    const code = `
    interface Person { name?: string };

    function test(data) {
      return (data?.person as Person)?.name;
    }`
    const expected = `
    test:
      params:
        - data
      steps:
        - return1:
            return: \${map.get(map.get(data, "person"), "name")}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles definite operator in optional chaining', () => {
    const code = `function test(data) {
      return data?.person!?.name;
    }`
    const expected = `
    test:
      params:
        - data
      steps:
        - return1:
            return: \${map.get(data, ["person", "name"])}
    `

    assertTranspiled(code, expected)
  })

  it('call expressions are not supported as part of optional chaining', () => {
    const code = `function test(data) {
      return data?.getPerson()?.name;
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('optional call expression is not supported', () => {
    const code = `function test() {
      return sys.now?.();
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('transpiles typeof', () => {
    const code = `function typeof2(x) {
      return typeof x;
    }`

    const expected = `
    typeof2:
      params:
        - x
      steps:
        - return1:
            return: \${text.replace_all_regex(text.replace_all_regex(get_type(x), "^(bytes|list|map|null)$", "object"), "^(double|integer)$", "number")}
    `

    assertTranspiled(code, expected)
  })

  it('transpiles void operator', () => {
    const code = `function main(): void {
      void sideEffect();
    }
      
    function sideEffect(): number {
      return 1;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - __temp: \${sideEffect()}
    sideEffect:
      steps:
        - return1:
            return: 1
    `

    assertTranspiled(code, expected)
  })

  it('ignores satisfies operator', () => {
    const code = `interface TrafficLight {
      color: 'green' | 'yellow' | 'red'
    }

    function main(): void {
      const light = { color: 'green' } satisfies TrafficLight;
      return light.color;
    }`

    const expected = `
    main:
      steps:
        - assign1:
            assign:
              - light:
                  color: "green"
        - return1:
            return: \${light.color}
    `

    assertTranspiled(code, expected)
  })

  it('comma operator is not supported', () => {
    const code = `function test(x: number) {
      return sys.log('Logging in comma operator'), x
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })
})

describe('Variable references', () => {
  it('parses subscript references', () => {
    assertExpression('customers[4]', '${customers[4]}')
    assertExpression('host["ip_address"]', '${host["ip_address"]}')
  })

  it('parses expression as subscript', () => {
    assertExpression('customers[i]', '${customers[i]}')
    assertExpression('customers[2*(a+b)]', '${customers[2 * (a + b)]}')
  })

  it('parses complex variable references', () => {
    const block = 'results["first"].children[1][2].id'
    assertExpression(block, '${results["first"].children[1][2].id}')
  })

  it('must not start or end with a dot', () => {
    const block1 = '.results.values'
    expect(() => parseExpression(block1)).to.throw(TSError)

    const block2 = 'results.values.'
    expect(() => parseExpression(block2)).to.throw(TSError)
  })

  it('can not have empty components', () => {
    const block1 = 'results..values'
    expect(() => parseExpression(block1)).to.throw(TSError)
  })

  it('must not start with subscripts', () => {
    const block1 = '[3]results'
    expect(() => parseExpression(block1)).to.throw(TSError)
  })

  it('subscript can not be empty', () => {
    const block = 'results[]'
    expect(() => parseExpression(block)).to.throw(TSError)
  })

  it('do not include incompleted subscripts', () => {
    const block1 = 'results[0'
    expect(() => parseExpression(block1)).to.throw(TSError)

    const block2 = 'results0]'
    expect(() => parseExpression(block2)).to.throw(TSError)
  })
})

function assertExpression(
  expression: string,
  expected: LiteralValueOrLiteralExpression,
): void {
  expect(
    expressionToLiteralValueOrLiteralExpression(parseExpression(expression)),
  ).to.deep.equal(expected)
}
