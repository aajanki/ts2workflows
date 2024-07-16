import { expect } from 'chai'
import { LiteralValueOrLiteralExpression } from '../src/ast/expressions.js'
import { parseExpression } from './testutils.js'
import { transpile } from '../src/transpiler.js'
import * as YAML from 'yaml'

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
    assertExpression('["Y", "Yes", 1, True]', ['Y', 'Yes', 1, true])
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

  it('parses maps', () => {
    assertExpression('{"name": "Merkimer", "race": "pig"}', {
      name: 'Merkimer',
      race: 'pig',
    })
  })

  it('parses maps with identifier as keys', () => {
    const ast = transpile(
      'function test() { const x = {name: "Merkimer", race: "pig"} }',
    )
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - x:
                  name: Merkimer
                  race: pig
    `

    expect(YAML.parse(ast)).to.deep.equal(YAML.parse(expected))
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
})

describe('Expressions', () => {
  it('parses binary operators', () => {
    assertExpression('0', 0)
    assertExpression('1 + 2', '${1 + 2}')
    assertExpression('5 + 1/3', '${5 + (1 / 3)}')
    assertExpression('"Queen" + " Dagmar"', '${"Queen" + " Dagmar"}')
  })

  it('parses unary operators', () => {
    assertExpression('-25', -25)
    assertExpression('-a', '${-a}')
    assertExpression('a - + b', '${a - +b}')
    assertExpression('a * -b', '${a * -b}')
  })

  it('parses logical expressions', () => {
    assertExpression(
      '!(status in ["OK", "success"])',
      '${not (status in ["OK", "success"])}',
    )
    assertExpression('(y >= 0) && !(x >= 0)', '${(y >= 0) and not (x >= 0)}')
  })

  it('parses remaider divisions', () => {
    assertExpression('x % 3', '${x % 3}')
    assertExpression('x % t == 0', '${(x % t) == 0}')
  })

  it('parses variable references', () => {
    assertExpression('a - 1', '${a - 1}')
    assertExpression('100 + 2*x', '${100 + (2 * x)}')
    assertExpression('host.ip_address', '${host.ip_address}')
  })

  it('parses inequality operators', () => {
    assertExpression('value > 100', '${value > 100}')
    assertExpression('status >= 0', '${status >= 0}')
    assertExpression('-1 < 0', '${-1 < 0}')
    assertExpression('x <= 0', '${x <= 0}')
    assertExpression('status != 0', '${status != 0}')
    assertExpression('response != "ERROR"', '${response != "ERROR"}')
    assertExpression('country == "Norway"', '${country == "Norway"}')
  })

  it('parses boolean operators', () => {
    assertExpression('inputOK && receiverReady', '${inputOK and receiverReady}')
    assertExpression('isEven || isPositive', '${isEven or isPositive}')
    assertExpression(
      '(x > 15) && !(x % 3 == 0)',
      '${(x > 15) and not ((x % 3) == 0)}',
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
    assertExpression('2*(3*(4 + x))', '${2 * (3 * (4 + x))}')
    assertExpression(
      '("Status: " + statusMessage)',
      '${"Status: " + statusMessage}',
    )
    assertExpression(
      '(age >= 18) && (age < 100)',
      '${(age >= 18) and (age < 100)}',
    )
    assertExpression(
      '(name in ["Bean", "Derek", "Jasper"]) || (affiliation == "Dreamland")',
      '${(name in ["Bean", "Derek", "Jasper"]) or (affiliation == "Dreamland")}',
    )
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
    const ast = transpile('function test() { const _ = {"name": name} }')
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - _:
                  name: \${name}
    `

    expect(YAML.parse(ast)).to.deep.equal(YAML.parse(expected))
  })

  it('parses expressions as map values 2', () => {
    const ast = transpile(
      'function test() { const _ = {"age": thisYear - birthYear} }',
    )
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - _:
                  age: \${thisYear - birthYear}
    `

    expect(YAML.parse(ast)).to.deep.equal(YAML.parse(expected))
  })

  it('parses expressions as map values 3', () => {
    const ast = transpile(
      'function test() { const _ = {"id": "ID-" + identifiers[2]} }',
    )
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - _:
                  id: \${"ID-" + identifiers[2]}
    `

    expect(YAML.parse(ast)).to.deep.equal(YAML.parse(expected))
  })

  it('parses nested expression in map values', () => {
    const ast = transpile(
      'function test() { const _ = {"success": code in [200, 201]} }',
    )
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - _:
                  success: \${code in [200, 201]}
    `
    expect(YAML.parse(ast)).to.deep.equal(YAML.parse(expected))
  })

  it('parses nested expression in map values 2', () => {
    const ast = transpile(
      'function test() { const _ = {"isKnownLocation": location in {"Dreamland": 1, "Maru": 2}} }',
    )
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - _:
                  isKnownLocation: '\${location in {"Dreamland": 1, "Maru": 2}}'
    `
    expect(YAML.parse(ast)).to.deep.equal(YAML.parse(expected))
  })

  it('parses nested expression in map values 3', () => {
    const ast = transpile(
      'function test() { const _ = {"values": {"next": a + 1}} }',
    )
    const expected = `
    test:
      steps:
        - assign1:
            assign:
              - _:
                  values:
                      next: \${a + 1}
    `
    expect(YAML.parse(ast)).to.deep.equal(YAML.parse(expected))
  })

  it('parses non-alphanumeric keys', () => {
    assertExpression('{"important!key": "value"}', { 'important!key': 'value' })
    assertExpression('myMap["important!key"]', '${myMap["important!key"]}')
  })

  it('parses variable as key in maps', () => {
    assertExpression('myMap[dynamicKey]', '${myMap[dynamicKey]}')
  })

  it('parses function expressions', () => {
    // "default" is a reserved keyword in Javascript. TODO
    //assertExpression('default(value, "")', '${default(value, "")}')
    //assertExpression('default(null, "")', '${default(null, "")}')
    assertExpression('int("5")', '${int("5")}')
    assertExpression('sys.now()', '${sys.now()}')
    assertExpression('time.format(sys.now())', '${time.format(sys.now())}')
    assertExpression(
      'time.format(sys.now()) + " " + text.decode(base64.decode("VGlhYmVhbmll"))',
      '${(time.format(sys.now()) + " ") + text.decode(base64.decode("VGlhYmVhbmll"))}',
    )
  })

  it('parses conditional expressions', () => {
    assertExpression(
      'x > 0 ? "positive" : "not positive"',
      '${if(x > 0, "positive", "not positive")}',
    )
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
    expect(() => parseExpression(block1)).to.throw()

    const block2 = 'results.values.'
    expect(() => parseExpression(block2)).to.throw()
  })

  it('can not have empty components', () => {
    const block1 = 'results..values'
    expect(() => parseExpression(block1)).to.throw()
  })

  it('must not start with subscripts', () => {
    const block1 = '[3]results'
    expect(() => parseExpression(block1)).to.throw()
  })

  it('subscript can not be empty', () => {
    const block = 'results[]'
    expect(() => parseExpression(block)).to.throw()
  })

  it('do not include incompleted subscripts', () => {
    const block1 = 'results[0'
    expect(() => parseExpression(block1)).to.throw()

    const block2 = 'results0]'
    expect(() => parseExpression(block2)).to.throw()
  })
})

function assertExpression(
  expression: string,
  expected: LiteralValueOrLiteralExpression,
): void {
  expect(
    parseExpression(expression).toLiteralValueOrLiteralExpression(),
  ).to.deep.equal(expected)
}
