import { transpileAndSnapshotTest } from './testutils.js'

describe('Variable scope', () => {
  it(
    'variable can be accessed in sub-blocks',
    transpileAndSnapshotTest(
      `
    function test() {
      let x = 5;

      {
        x += 1;
      }

      return x;
    }`,
    ),
  )

  it(
    'variable can be accessed in if-blocks',
    transpileAndSnapshotTest(
      `
    function test() {
      let x = 5;

      if (2 > 1) {
        x += 1;
      }

      return x;
    }`,
    ),
  )

  it(
    'const and let variables have function scope (unlike TypeScript)',
    transpileAndSnapshotTest(
      // This is not valid as a Typescript program, but is valid ts2workflows/GCP Workflows program
      `
    function test(x: number) {
      if (x > 0) {
        const res = 'positive';
      } else {
        const res = 'non-positive';
      }

      return res;
    }`,
    ),
  )

  it(
    'uninitialized variables are set to null',
    transpileAndSnapshotTest(
      // This is not valid as a Typescript program, but is valid ts2workflows/GCP Workflows program
      `
    function test() {
      let x: number | null;
      return x;
    }`,
    ),
  )

  it(
    'variable read before it is assigned',
    transpileAndSnapshotTest(
      // This will fail on run-time, but the transpiler accepts it anyway.
      // TODO: The transpilers should be changed to detect read-before-assigned
      // cases and to throw an error.
      `
    function test() {
      const y = x + 1;
      const x = 1;
    }`,
    ),
  )
})
