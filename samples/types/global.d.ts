export {}

declare global {
  interface Array<T> {
    isArray(arg: any): arg is any[]
  }
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
