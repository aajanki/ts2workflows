import * as R from 'ramda'

export function isRecord(
  object: unknown,
): object is Record<keyof never, unknown> {
  return object instanceof Object && object.constructor === Object
}

/**
 * Like arr.flatMap() but the callback takes two consecutive array elements.
 *
 * During the last execution of the callback, the second argument (which would
 * be element after the last array element) will be undefined.
 */
export function chainPairs<T, U>(
  callback: (val: T, next: T | undefined) => U[],
  arr: readonly T[],
): U[] {
  return R.chain(
    R.apply(callback),
    R.zip(arr, R.append(undefined, R.tail(arr))),
  )
}
