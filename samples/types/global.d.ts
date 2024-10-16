export {}

/// <reference no-default-lib="true"/>

declare global {
  // Minimal definition of Symbol.iterator required by the for-of statement
  interface SymbolConstructor {
    readonly iterator: unique symbol
  }

  var Symbol: SymbolConstructor

  interface Iterator<T> {}

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

  type Record<K extends keyof any, T> = {
    [P in K]: T
  }
}
