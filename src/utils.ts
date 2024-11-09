export function isRecord(
  object: unknown,
): object is Record<keyof never, unknown> {
  return object instanceof Object && object.constructor === Object
}

/**
 * Apply f to values of obj and return the result
 */
export function mapRecordValues<T, U>(
  obj: Record<string, T>,
  f: (t: T) => U,
): Record<string, U> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))
}
