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
export function flatMapPair<T, U>(
  arr: T[],
  callback: (val: T, next: T | undefined) => U[],
): U[] {
  if (arr.length <= 0) {
    return []
  }

  const mapped: U[] = []
  for (let i = 0; i < arr.length - 1; i++) {
    mapped.push(...callback(arr[i], arr[i + 1]))
  }

  mapped.push(...callback(arr[arr.length - 1], undefined))

  return mapped
}
