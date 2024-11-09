export {}

/// <reference no-default-lib="true"/>

declare global {
  // Minimal definition of Symbol.iterator required by the for-of statement
  interface SymbolConstructor {
    readonly iterator: unique symbol
  }

  var Symbol: SymbolConstructor

  /**
   * Iterator types copied from lib.es2015.iterable.d.ts
   */
  interface Iterator<T, TReturn = any, TNext = undefined> {
    // NOTE: 'next' is defined using a tuple to ensure we report the correct assignability errors in all places.
    next(...args: [] | [TNext]): IteratorResult<T, TReturn>
    return?(value?: TReturn): IteratorResult<T, TReturn>
    throw?(e?: any): IteratorResult<T, TReturn>
  }

  interface Iterable<T> {
    [Symbol.iterator](): Iterator<T>
  }

  interface IterableIterator<T> extends Iterator<T> {
    [Symbol.iterator](): IterableIterator<T>
  }

  interface Array<T> {
    // Array member access
    [n: number]: T

    // Arrays can be iterated by the for-of statement
    [Symbol.iterator](): IterableIterator<T>
  }

  interface ArrayConstructor {
    isArray(arg: any): arg is any[]
  }

  var Array: ArrayConstructor

  interface Boolean {}
  interface CallableFunction {}
  interface Function {}
  interface IArguments {}
  interface NewableFunction {}
  interface Number {}
  interface Object {}
  interface RegExp {}
  interface String {}

  /**
   * Utility types
   * Copied from lib.es5.d.ts
   */

  /**
   * Make all properties in T optional
   */
  type Partial<T> = {
    [P in keyof T]?: T[P]
  }

  /**
   * Make all properties in T required
   */
  type Required<T> = {
    [P in keyof T]-?: T[P]
  }

  /**
   * Make all properties in T readonly
   */
  type Readonly<T> = {
    readonly [P in keyof T]: T[P]
  }

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Pick<T, K extends keyof T> = {
    [P in K]: T[P]
  }

  /**
   * Construct a type with a set of properties K of type T
   */

  type Record<K extends keyof any, T> = {
    [P in K]: T
  }

  /**
   * Obtain the return type of a function type
   */
  type ReturnType<T extends (...args: any) => any> = T extends (
    ...args: any
  ) => infer R
    ? R
    : any

  /**
   * Exclude from T those types that are assignable to U
   */
  type Exclude<T, U> = T extends U ? never : T

  /**
   * Extract from T those types that are assignable to U
   */
  type Extract<T, U> = T extends U ? T : never

  /**
   * Construct a type with the properties of T except for those in type K.
   */
  type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>

  /**
   * Exclude null and undefined from T
   */
  type NonNullable<T> = T & {}
}
