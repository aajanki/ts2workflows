import { InternalTranspilingError } from '../errors.js'

export function assertType(node: { type: string }, expectedType: string): void {
  if (node?.type !== expectedType) {
    throw new InternalTranspilingError(
      `Expected ${expectedType}, got ${node?.type}`,
    )
  }
}

export function assertOneOfManyTypes(
  node: { type: string },
  expectAnyOfTheseTypes: string[],
): void {
  if (!expectAnyOfTheseTypes.includes(node?.type)) {
    throw new InternalTranspilingError(
      `Expected ${expectAnyOfTheseTypes.join(' or ')}, got ${node?.type}`,
    )
  }
}
