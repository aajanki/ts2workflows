// An opaque bytes type.
// This should really be defined in the transpiler, not here.
export class bytes {}

// GCP Workflows expression helpers

export declare function double(x: string | number): number
export declare function int(x: string | number): number
export declare function string(x: string | number | boolean): string
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
    | bytes
    | undefined,
): string

// GCP Workflows standard library functions

export declare namespace base64 {
  function decode(data: bytes, padding?: boolean): string
  function encode(data: string, padding?: boolean): bytes
}

export declare namespace events {
  function await_callback(
    callback: {
      url: string
    },
    timeout?: number,
  ): object
  function create_callback_endpoint(http_callback_method: string): {
    url: string
  }
}

export declare const http: {
  default_retry: (exception: unknown) => void
  default_retry_non_idempotent: (exception: unknown) => void
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

export declare namespace json {
  function decode(data: bytes | string): object
  function encode(
    data: string | number | boolean | unknown[] | Record<string, unknown>,
    indent?:
      | boolean
      | {
          prefix?: string
          indent?: string
        },
  ): bytes
  function encode_to_string(
    data: string | number | boolean | unknown[] | Record<string, unknown>,
    indent?:
      | boolean
      | {
          prefix?: string
          indent?: string
        },
  ): string
}

export declare namespace list {
  function concat<T>(objs: T[], val: T): T[]
  function prepend<T>(objs: T[], val: T): T[]
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

export declare namespace math {
  function abs(x: number): number
  function max(x: number, y: number): number
  function min(x: number, y: number): number
}

export declare namespace retry {
  function always(exception: unknown): void
  const default_backoff: {
    initial_delay: number
    max_delay: number
    multiplier: number
  }
  function never(exception: unknown): void
}

export declare namespace sys {
  function get_env(name: string, default_value?: string): string | undefined
  function log(
    data?: number | boolean | string | unknown[] | object,
    severity?: string,
    text?: number | boolean | string | unknown[] | object,
    json?: object,
    timeout?: number,
  ): void
  function now(): number
  function sleep(seconds: number): void
  function sleep_until(time: string): void
}

export declare namespace text {
  function decode(data: bytes, charset?: string): string
  function encode(text: string, charset?: string): bytes
  function find_all(source: string, substr: string): number[]
  function find_all_regex(
    source: string,
    regexp: string,
  ): {
    index: number
    match: string
  }[]
  function match_regexp(source: string, regexp: string): boolean
  function replace_all(source: string, substr: string, repl: string): string
  function replace_all_regex(
    source: string,
    substr: string,
    repl: string,
  ): string
  function split(source: string, separator: string): string[]
  function substring(source: string, start: number, end: number): string
  function to_lower(source: string): string
  function to_upper(source: string): string
  function url_decode(source: string): string
  function url_encode(source: string): string
  function url_encode_plus(source: string): string
}

export declare namespace time {
  function format(seconds: number, timezone?: string): string
  function parse(value: string): number
}

export declare namespace uuid {
  function generate(): string
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

export declare function retry_policy(
  params:
    | {
        policy: (exception: unknown) => void
      }
    | {
        predicate: (exception: unknown) => boolean
        max_retries: number
        backoff: {
          initial_delay: number
          max_delay: number
          multiplier: number
        }
      },
): void
