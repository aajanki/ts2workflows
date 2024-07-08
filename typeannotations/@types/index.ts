// GCP Workflows expression helpers

export declare function double(x: string | number): number
export declare function int(x: string | number): number
export declare function string(x: string | number | boolean): string

// Renamed to "default" in the transpiled Workflows code
export declare function or_else<T>(val: T | null | undefined, defaultVal: T): T

// Renamed to "if" in the transpiled Workflows code
export declare function choose<T>(condition: boolean, ifTrue: T, ifFalse: T): T

export declare function keys(map: Record<string, unknown>): string[]
export declare function len(
  value: unknown[] | Record<string, unknown> | string,
): number
export declare function get_type(
  value:
    | boolean
    | number
    | string
    | unknown[]
    | Record<string, unknown>
    | null
    | undefined,
): string

// GCP Workflows standard library functions

export declare const base64: {
  decode: (data: string, padding?: boolean) => string
  encode: (data: string, padding?: boolean) => string
}

export declare const events: {
  await_callback: (
    callback: {
      url: string
    },
    timeout?: number,
  ) => object
  create_callback_endpoint: (http_callback_method: string) => {
    url: string
  }
}

export declare const http: {
  default_retry: () => void
  default_retry_non_idempotent: () => void
  default_retry_predicate: (exception: unknown) => boolean
  default_retry_predicate_non_idempotent: (exception: unknown) => boolean
  delete: (
    url: string,
    timeout?: number,
    body?: unknown,
    headers?: Record<string, string>,
    query?: Record<
      string,
      string | number | boolean | (string | number | boolean)[]
    >,
    auth?: Record<string, string>,
    private_service_name?: string,
    ca_certificate?: string,
  ) => {
    body: unknown
    code: number
    headers: Record<string, string>
  }
  get: (
    url: string,
    timeout?: number,
    headers?: Record<string, string>,
    query?: Record<
      string,
      string | number | boolean | (string | number | boolean)[]
    >,
    auth?: Record<string, string>,
    private_service_name?: string,
    ca_certificate?: string,
  ) => {
    body: unknown
    code: number
    headers: Record<string, string>
  }
  patch: (
    url: string,
    timeout?: number,
    body?: unknown,
    headers?: Record<string, string>,
    query?: Record<
      string,
      string | number | boolean | (string | number | boolean)[]
    >,
    auth?: Record<string, string>,
    private_service_name?: string,
    ca_certificate?: string,
  ) => {
    body: unknown
    code: number
    headers: Record<string, string>
  }
  post: (
    url: string,
    timeout?: number,
    body?: unknown,
    headers?: Record<string, string>,
    query?: Record<
      string,
      string | number | boolean | (string | number | boolean)[]
    >,
    auth?: Record<string, string>,
    private_service_name?: string,
    ca_certificate?: string,
  ) => {
    body: unknown
    code: number
    headers: Record<string, string>
  }
  put: (
    url: string,
    timeout?: number,
    body?: unknown,
    headers?: Record<string, string>,
    query?: Record<
      string,
      string | number | boolean | (string | number | boolean)[]
    >,
    auth?: Record<string, string>,
    private_service_name?: string,
    ca_certificate?: string,
  ) => {
    body: unknown
    code: number
    headers: Record<string, string>
  }
  request: (
    method: string,
    url: string,
    timeout?: number,
    body?: unknown,
    headers?: Record<string, string>,
    query?: Record<
      string,
      string | number | boolean | (string | number | boolean)[]
    >,
    auth?: Record<string, string>,
    private_service_name?: string,
    ca_certificate?: string,
  ) => {
    body: unknown
    code: number
    headers: Record<string, string>
  }
}

export declare const json: {
  decode: (data: string) => object
  encode: (
    data: string | number | boolean | unknown[] | Record<string, unknown>,
    indent?:
      | boolean
      | {
          prefix?: string
          indent?: string
        },
  ) => string
  encode_to_string: (
    data: string | number | boolean | unknown[] | Record<string, unknown>,
    indent?:
      | boolean
      | {
          prefix?: string
          indent?: string
        },
  ) => string
}

export declare const list: {
  concat: <T>(objs: T[], val: T) => T[]
  prepend: <T_1>(objs: T_1[], val: T_1) => T_1[]
}

export declare const map: {
  delete: <T>(map: Record<string, T>, key: string) => Record<string, T>
  get: <T_1>(map: Record<string, T_1>, keys: string | string[]) => T_1
  merge: <S>(
    first: Record<string, S>,
    second: Record<string, S>,
  ) => Record<string, S>
  merge_nested: <S_1>(
    first: Record<string, S_1>,
    second: Record<string, S_1>,
  ) => Record<string, S_1>
}

export declare const math: {
  abs: (x: number) => number
  max: (x: number, y: number) => number
  min: (x: number, y: number) => number
}

export declare const retry: {
  always: () => void
  default_backoff: () => void
  never: () => void
}

export declare const sys: {
  get_env: (name: string, default_value?: string) => string | undefined
  log: (
    data?: number | boolean | string | any[] | object,
    severity?: string,
    text?: number | boolean | string | any[] | object,
    json?: object,
    timeout?: number,
  ) => void
  now: () => number
  sleep: (seconds: number) => void
  sleep_until: (time: string) => void
}

export declare const text: {
  decode: (data: string, charset?: string) => string
  encode: (text: string, charset?: string) => string
  find_all: (source: string, substr: string) => number[]
  find_all_regex: (
    source: string,
    regexp: string,
  ) => {
    index: number
    match: string
  }[]
  match_regexp: (source: string, regexp: string) => boolean
  replace_all: (source: string, substr: string, repl: string) => string
  replace_all_regex: (source: string, substr: string, repl: string) => string
  split: (source: string, separator: string) => string[]
  substring: (source: string, start: number, end: number) => string
  to_lower: (source: string) => string
  to_upper: (source: string) => string
  url_decode: (source: string) => string
  url_encode: (source: string) => string
  url_encode_plus: (source: string) => string
}

export declare const time: {
  format: (seconds: number, timezone?: string) => string
  parse: (value: string) => number
}

export declare const uuid: {
  generate: () => string
}

// Functionality that is not implemented by Typescript keywords

export declare function parallel(
  branches: (() => void)[] | (() => void),
  options?: {
    shared?: string[]
    concurrency_limit?: number
    exception_policy?: string
  },
): void
