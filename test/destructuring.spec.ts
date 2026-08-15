import { expect } from 'chai'
import { transpileText } from '../src/transpiler/index.js'
import { transpileAndSnapshotTest } from './testutils.js'
import { WorkflowSyntaxError } from '../src/errors.js'

describe('Destructing', () => {
  it(
    'destructures array elements',
    transpileAndSnapshotTest(`
    function main() {
      const [a, b] = getValues();
    }`),
  )

  it(
    'destructuring the head of array',
    transpileAndSnapshotTest(`
    function main() {
      const [head] = getValues();
    }`),
  )

  it(
    'destructures array from call_step()',
    transpileAndSnapshotTest(`
    function main() {
      const [head] = call_step(test_array, {id: 1});
    }
      
    function test_array(id) {
      return [id]
    }`),
  )

  it(
    'destructures array in a nested property',
    transpileAndSnapshotTest(`
    function main(data) {
      const [a, b] = data.arr;
    }`),
  )

  it(
    'array destructuring overwriting itself',
    transpileAndSnapshotTest(`
    function main() {
      const arr = [1, 2, 3];
      [arr[1], arr[0]] = arr;
    }`),
  )

  it(
    'array destructuring with skipped elements',
    transpileAndSnapshotTest(`
    function main() {
      const arr = [1, 2, 3, 4];
      const [, a, , b] = arr;
    }`),
  )

  it(
    'variable swap trick',
    transpileAndSnapshotTest(`
    function main() {
      let a = 1;
      let b = 2;
      [a, b] = [b, a];
    }`),
  )

  it(
    'array elements swap trick',
    transpileAndSnapshotTest(`
    function main() {
      const arr = [1, 2, 3];
      [arr[2], arr[1]] = [arr[1], arr[2]];
    }`),
  )

  it(
    'destructures nested arrays',
    transpileAndSnapshotTest(`
    function main(data) {
      const [[a], [b]] = data;
    }`),
  )

  it(
    'default values in array destructuring',
    transpileAndSnapshotTest(`
    function main(arr: number[]) {
      const [a, b = 99] = arr;
    }`),
  )

  it('default values are not supported in nested array destructuring', () => {
    const code = `
    function main(arr: number[][]) {
      const [[a] = [99]] = arr;
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it('default values are not supported in nested object pattern in array destructuring', () => {
    const code = `
    function main(arr: {val: number}[]) {
      const [{ val } = {val: 99}] = arr;
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it(
    'rest element in array destructuring',
    transpileAndSnapshotTest(`
    function main() {
      const [a, b, ...rest] = getValues();
    }`),
  )

  it(
    'rest element as the only pattern',
    transpileAndSnapshotTest(`
    function main() {
      const [...values] = getValues();
    }`),
  )

  it(
    'rest element and holes in array destructuring',
    transpileAndSnapshotTest(`
    function main() {
      const [a, , , b, , ...rest] = getValues();
    }`),
  )

  it('throws if undefined is used as array pattern element', () => {
    const code = `
    function main(data) {
      const [a, undefined, b] = data;
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it(
    'rest element in nested array patterns',
    transpileAndSnapshotTest(`
    function main(data) {
      const [[a], [b, ...rest2], ...otherValues] = data;
    }`),
  )

  it(
    'empty array pattern',
    transpileAndSnapshotTest(`
    function main() {
      const arr = [1, 2, 3];
      let [] = arr;
    }`),
  )

  it(
    'array pattern with only holes',
    transpileAndSnapshotTest(`
    function main() {
      const arr = [1, 2, 3];
      let [ , , ] = arr;
    }`),
  )

  it(
    'destructures object patterns nested in an array pattern',
    transpileAndSnapshotTest(`
    function main(data: {name: string}[]) {
      const [ {name} ] = data;
    }`),
  )

  it(
    'destructures a nested rest element object pattern in an array pattern',
    transpileAndSnapshotTest(`
    function main(arr: {name: string, age: number}[]) {
      const [{ name, ...rest }] = arr;
    }`),
  )

  it('throws if the rest element is not the last element in array destructuring pattern', () => {
    const code = `
    function main(arr: number[]) {
      const [a, b, ...rest, c] = arr;
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('throws if the rest element is not the last element in object destructuring pattern', () => {
    const code = `
    function main(data) {
      const {a, ...other, b} = data;
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('throws if there are multiple rest elements in array destructuring', () => {
    const code = `
    function main(arr: number[]) {
      const [a, b, ...rest, ...anotherRest] = arr;
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('throws if there are multiple rest elements in object destructuring', () => {
    const code = `
    function main(data) {
      const {a, ...rest, ...anotherRest} = data;
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('throws if the rest element is an object', () => {
    const code = `
    function main(arr: number[]) {
      const [a, b, ...{ push, pop }] = arr;
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it('throws if the rest element is an array', () => {
    const code = `
    function main(arr: number[]) {
      const [a, b, ...[firstOfRest]] = arr;
    }`

    expect(() => transpileText(code)).to.throw()
  })

  it(
    'destructures objects',
    transpileAndSnapshotTest(`
    function main() {
      const { name, age, address } = getPerson();
    }`),
  )

  it(
    'destructures object variables',
    transpileAndSnapshotTest(`
    function main() {
      const person = { name: "Bean", hairColor: "white" }
      const { name, hairColor } = person;
    }`),
  )

  it(
    'destructures objects in a nested property',
    transpileAndSnapshotTest(`
    function main(data) {
      const { name, age } = data.person;
    }`),
  )

  it(
    'destructures objects in a non-pure nested property',
    transpileAndSnapshotTest(`
    function main() {
      const { name, age } = getData().person;
    }`),
  )

  it(
    'destructures deep objects',
    transpileAndSnapshotTest(`
    function main() {
      const { name, address: { country: { name: countryName, code } } } = getPerson();
    }`),
  )

  it(
    'destructures object from call_step()',
    transpileAndSnapshotTest(`
    function main() {
      const { name } = call_step(test_object, {id: 1});
    }
      
    function test_object(id) {
      return {
        name: "Bean"
      }
    }
    `),
  )

  it(
    'destructures objects with assigned variables',
    transpileAndSnapshotTest(`
    function main() {
      const { name: myName, address: { city: myCity } } = getPerson();
    }`),
  )

  it(
    'destructures objects in arrays',
    transpileAndSnapshotTest(`
    function main() {
      const [ { name: name1, age: age1 }, { name: name2, age: age2 } ] = getPersons();
    }`),
  )

  it(
    'destructures arrays in objects',
    transpileAndSnapshotTest(`
    function main() {
      const {
        names: [first, middle, last],
        professions: [firstProfession]
      } = getPerson();
    }`),
  )

  it(
    'destructures arrays in nested objects',
    transpileAndSnapshotTest(`
    function main(data) {
      const [ { values: [a, b] } ] = data;
    }`),
  )

  it(
    'destructures a mixture of arrays and objects',
    transpileAndSnapshotTest(`
    function main(data) {
      const {
        persons: [ { address: { street: streetAddress, city } } ],
        timestamp,
        source: { database: sourceDb, references: [ ref ] },
      } = data;
    }`),
  )

  it(
    'destructures objects in an assignment expression',
    transpileAndSnapshotTest(`
    function main() {
      const data = { value: 5 };
      let value = 0;
      ({ value } = data);
    }`),
  )

  it(
    'empty object pattern',
    transpileAndSnapshotTest(`
    function main() {
      const data = { name: "Bean" };
      let {} = data;
    }`),
  )

  it(
    'default values in object destructuring',
    transpileAndSnapshotTest(`
    function main(data) {
      const {name, parameters = {type: "simple"}, timestamp} = data;
    }`),
  )

  it(
    'rest element in object destructuring',
    transpileAndSnapshotTest(`
    function main(data) {
      const {name, country: {code}, ...other} = data;
    }`),
  )

  it('nested object pattern rest element in object destructuring is not supported', () => {
    const code = `
    function main(data) {
      let n;
      let c;

      ({ name: n, ...{ country: c } } = data)
    }`

    expect(() => transpileText(code)).to.throw(WorkflowSyntaxError)
  })

  it(
    'rest element in a nested object in object destructuring',
    transpileAndSnapshotTest(`
    function main(data) {
      const {name, country: {code, ...otherCountryProperties}} = data;
    }`),
  )

  it(
    'rest element as the only pattern in object destructuring',
    transpileAndSnapshotTest(`
    function main(data) {
      const {...properties} = data;
    }`),
  )
})
