export {}

// Type annotations for GCP Workflows expression helpers, standard library
// functions and (some) connectors

// An opaque bytes type.
// This should really be defined in the transpiler, not here.
declare const __bytes_tag: unique symbol
export interface bytes {
  readonly [__bytes_tag]: 'bytes'
}

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
  function await_callback<ResponseType = unknown>(
    callback: {
      url: string
    },
    timeout?: number,
  ): {
    http_request: {
      body: ResponseType | null
      headers: Record<string, string>
      method: string
      query: Record<string, string>
      url: string
    }
    received_time: string
    type: string
  }
  function create_callback_endpoint(http_callback_method: string): {
    url: string
  }
}

export declare namespace hash {
  export function compute_checksum(data: bytes, algorithm: string): bytes
  export function compute_hmac(
    key: bytes,
    data: bytes,
    algorithm: string,
  ): bytes
}

export declare namespace http {
  export function default_retry(errormap: Record<string, any>): void
  export function default_retry_non_idempotent(
    errormap: Record<string, any>,
  ): void
  export function default_retry_predicate(
    errormap: Record<string, any>,
  ): boolean
  export function default_retry_predicate_non_idempotent(
    errormap: Record<string, any>,
  ): boolean
  function _delete<ResponseType = unknown>(
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
  ): {
    body: ResponseType
    code: number
    headers: Record<string, string>
  }
  export function get<ResponseType = unknown>(
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
  ): {
    body: ResponseType
    code: number
    headers: Record<string, string>
  }
  export function patch<ResponseType = unknown>(
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
  ): {
    body: ResponseType
    code: number
    headers: Record<string, string>
  }
  export function post<ResponseType = unknown>(
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
  ): {
    body: ResponseType
    code: number
    headers: Record<string, string>
  }
  export function put<ResponseType = unknown>(
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
  ): {
    body: ResponseType
    code: number
    headers: Record<string, string>
  }
  export function request<ResponseType = unknown>(
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
  ): {
    body: ResponseType
    code: number
    headers: Record<string, string>
  }
  export { _delete as delete }
}

export declare namespace json {
  function decode(data: bytes | string): unknown
  function encode(
    data:
      | string
      | number
      | boolean
      | unknown[]
      | Record<string, unknown>
      | null
      | undefined,
    indent?:
      | boolean
      | {
          prefix?: string
          indent?: string
        },
  ): bytes
  function encode_to_string(
    data:
      | string
      | number
      | boolean
      | unknown[]
      | Record<string, unknown>
      | null
      | undefined,
    indent?:
      | boolean
      | {
          prefix?: string
          indent?: string
        },
  ): string
}

export declare namespace list {
  function concat<T, U>(objs: T[], val: U): (T | U)[]
  function prepend<T, U>(objs: T[], val: U): (T | U)[]
}

export declare namespace map {
  function _delete<T>(map: Record<string, T>, key: string): Record<string, T>
  export function get<T, K extends string | string[]>(
    map: Record<string, T>,
    keys: K,
  ): K extends string ? T | null : unknown
  export function merge<T, U>(
    first: Record<string, T>,
    second: Record<string, U>,
  ): Record<string, T | U>
  export function merge_nested<T, U>(
    first: Record<string, T>,
    second: Record<string, U>,
  ): Record<string, T | U>
  export { _delete as delete }
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
  function get_env(name: string): string | null
  function get_env(name: string, default_value: string): string
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
  function match_regex(source: string, regexp: string): boolean
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

// Connectors

// Cloud Firestore API Connector
// https://cloud.google.com/workflows/docs/reference/googleapis/firestore/Overview
export declare namespace googleapis {
  namespace firestore {
    namespace v1 {
      interface ArrayValue {
        values: Value[]
      }
      interface BatchGetDocumentsRequest {
        documents: string[]
        mask?: DocumentMask
        newTransaction?: TransactionOptions
        readTime?: string
        transaction?: string
      }
      interface BatchGetDocumentsResponse {
        found?: Document
        missing?: string
        readTime: string
        transaction?: string
      }
      interface BatchWriteRequest {
        labels: Record<string, string>
        writes: Write[]
      }
      interface BatchWriteResponse {
        status: Status[]
        writeResults: WriteResult[]
      }
      interface BeginTransactionRequest {
        options?: TransactionOptions
      }
      interface BeginTransactionResponse {
        transaction: string
      }
      interface CollectionSelector {
        allDescendants: boolean
        collectionId?: string
      }
      interface CommitRequest {
        transaction: string
        writes: Write[]
      }
      interface CommitResponse {
        commitTime: string
        writeResults: WriteResult[]
      }
      interface CompositeFilter {
        filters: Filter[]
        op: 'OPERATOR_UNSPECIFIED' | 'AND'
      }
      interface Cursor {
        before: boolean
        values: Value[]
      }
      interface Document {
        createTime: string
        fields: Record<string, Value>
        name?: string
        updateTime: string
      }
      interface DocumentMask {
        fieldPaths: string[]
      }
      interface DocumentTransform {
        document: string
        fieldTransforms: FieldTransform[]
      }
      interface FieldReference {
        fieldPath: string
      }
      interface Filter {
        compositeFilter?: CompositeFilter
        fieldFilter?: FieldFilter
        unaryFilter?: UnaryFilter
      }
      interface FieldFilter {
        field: FieldReference
        op:
          | 'OPERATOR_UNSPECIFIED'
          | 'LESS_THAN'
          | 'LESS_THAN_OR_EQUAL'
          | 'GREATER_THAN'
          | 'GREATER_THAN_OR_EQUAL'
          | 'EQUAL'
          | 'NOT_EQUAL'
          | 'ARRAY_CONTAINS'
          | 'IN'
          | 'ARRAY_CONTAINS_ANY'
          | 'NOT_IN'
        value: Value
      }
      interface FieldTransform {
        appendMissingElements?: ArrayValue[]
        fieldPath: string
        increment?: Value
        maximum?: Value
        minimum?: Value
        removeAllFromArray?: ArrayValue
        setToServerValue?: 'SERVER_VALUE_UNSPECIFIED' | 'REQUEST_TIME'
      }
      interface GoogleFirestoreAdminV1ExportDocumentsRequest {
        collectionIds?: string[]
        outputUriPrefix: string
      }
      interface GoogleFirestoreAdminV1Field {
        indexConfig: GoogleFirestoreAdminV1IndexConfig
        name: string
      }
      interface GoogleFirestoreAdminV1ImportDocumentsRequest {
        collectionIds?: string[]
        inputUriPrefix: string
      }
      interface GoogleFirestoreAdminV1Index {
        fields: GoogleFirestoreAdminV1IndexField[]
        name?: string
        queryScope:
          | 'QUERY_SCOPE_UNSPECIFIED'
          | 'COLLECTION'
          | 'COLLECTION_GROUP'
        state?: 'STATE_UNSPECIFIED' | 'CREATING' | 'READY' | 'NEEDS_REPAIR'
      }
      interface GoogleFirestoreAdminV1IndexConfig {
        ancestorField?: string
        indexes: GoogleFirestoreAdminV1Index[]
        reverting?: boolean
        usesAncestorConfig?: boolean
      }
      interface GoogleFirestoreAdminV1IndexField {
        arrayConfig: 'ARRAY_CONFIG_UNSPECIFIED' | 'CONTAINS'
        fieldPath: string
        order: 'ORDER_UNSPECIFIED' | 'ASCENDING' | 'DESCENDING'
      }
      interface GoogleFirestoreAdminV1ListFieldsResponse {
        fields: GoogleFirestoreAdminV1Field[]
        nextPageToken?: string
      }
      interface GoogleFirestoreAdminV1ListIndexesResponse {
        indexes: GoogleFirestoreAdminV1Index[]
        nextPageToken?: string
      }
      interface GoogleLongrunningOperation {
        done: boolean
        error?: Status
        metadata?: Record<string, unknown>
        name: string
        response: Record<string, unknown>
      }
      interface GoogleLongrunningListOperationsResponse {
        nextPageToken?: string
        operations: GoogleLongrunningOperation[]
      }
      interface LatLng {
        latitude: number
        longitude: number
      }
      interface ListLocationsResponse {
        locations: Location[]
        nextPageToken: string
      }
      interface Location {
        displayName: string
        labels: Record<string, string>
        locationId: string
        metadata?: Record<string, unknown>
        name: string
      }
      interface ListCollectionIdsRequest {
        pageSize: number
        pageToken: string
      }
      interface ListCollectionIdsResponse {
        collectionIds: string[]
        nextPageToken: string
      }
      interface ListDocumentsResponse {
        documents: Document[]
        nextPageToken: string
      }
      interface MapValue {
        fields: Record<string, Value>
      }
      interface Order {
        direction: 'DIRECTION_UNSPECIFIED' | 'ASCENDING' | 'DESCENDING'
        field: FieldReference
      }
      interface PartitionQueryRequest {
        pageSize: number
        pageToken: string
        partitionCount: string
        structuredQuery: StructuredQuery
      }
      interface PartitionQueryResponse {
        nextPageToken: string
        partitions: Cursor[]
      }
      interface Precondition {
        exists: boolean
        updateTime?: string
      }
      interface Projection {
        fields: FieldReference[]
      }
      interface ReadOnly {
        readTime: string
      }
      interface ReadWrite {
        retryTransaction: string
      }
      interface RollbackRequest {
        transaction: string
      }
      interface RunQueryRequest {
        newTransaction?: TransactionOptions
        readTime?: string
        structuredQuery: StructuredQuery
        transaction?: string
      }
      interface RunQueryResponse {
        document: Document
        readTime: string
        skippedResults: number
        transaction?: string
      }
      interface Status {
        code: number
        details: Record<string, unknown>[]
        message: string
      }
      interface StructuredQuery {
        endAt?: Cursor
        from?: CollectionSelector[]
        limit?: number
        offset?: number
        orderBy?: Order[]
        select?: Projection
        startAt?: Cursor
        where?: Filter
      }
      interface TransactionOptions {
        readOnly?: ReadOnly
        readWrite?: ReadWrite
      }
      interface UnaryFilter {
        field: FieldReference
        op:
          | 'OPERATOR_UNSPECIFIED'
          | 'IS_NAN'
          | 'IS_NULL'
          | 'IS_NOT_NAN'
          | 'IS_NOT_NULL'
      }
      interface Value {
        arrayValue?: ArrayValue
        booleanValue?: boolean
        bytesValue?: string
        doubleValue?: number
        geoPointValue?: LatLng
        integerValue?: string
        mapValue?: MapValue
        nullValue?: 'NULL_VALUE'
        referenceValue?: string
        stringValue?: string
        timestampValue?: string
      }
      interface Write {
        currentDocument?: Precondition
        delete?: string
        transform?: DocumentTransform
        update?: Pick<Document, 'fields' | 'name'>
        updateMask?: DocumentMask
        updateTransforms?: FieldTransform[]
      }
      interface WriteResult {
        transformResults?: Value[]
        updateTime: string
      }
      namespace projects {
        namespace databases {
          export function exportDocuments(
            name: string,
            body: GoogleFirestoreAdminV1ExportDocumentsRequest,
          ): GoogleLongrunningOperation
          export function importDocuments(
            name: string,
            body: GoogleFirestoreAdminV1ImportDocumentsRequest,
          ): GoogleLongrunningOperation
          namespace collectionGroups {
            namespace fields {
              export function get(name: string): GoogleFirestoreAdminV1Field
              export function list(
                parent: string,
                filter?: string,
                pageSize?: number,
                pageToken?: string,
              ): GoogleFirestoreAdminV1ListFieldsResponse
              export function patch(
                name: string,
                updateMask: string,
                body: GoogleFirestoreAdminV1Field,
              ): GoogleLongrunningOperation
            }
            namespace indexes {
              export function create(
                parent: string,
                body: GoogleFirestoreAdminV1Index,
              ): GoogleLongrunningOperation
              function _delete(name: string): void
              export function get(name: string): GoogleFirestoreAdminV1Index
              export function list(
                parent: string,
                filter?: string,
                pageSize?: number,
                pageToken?: string,
              ): GoogleFirestoreAdminV1ListIndexesResponse
              export { _delete as delete }
            }
          }
          namespace documents {
            export function batchGet(
              database: string,
              body: BatchGetDocumentsRequest,
            ): BatchGetDocumentsResponse
            export function batchWrite(
              database: string,
              body: BatchWriteRequest,
            ): BatchWriteResponse
            export function beginTransaction(
              database: string,
              body: BeginTransactionRequest,
            ): BeginTransactionResponse
            export function commit(
              database: string,
              body: CommitRequest,
            ): CommitResponse
            export function createDocument(
              collectionId: string,
              parent: string,
              body: Pick<Document, 'fields' | 'name'>,
              documentId?: string,
              mask?: DocumentMask,
            ): Document
            function _delete(name: string, currentDocument?: Precondition): void
            export function get(
              name: string,
              mask?: DocumentMask,
              readTime?: string,
              transaction?: string,
            ): Document
            export function list(
              collectionId: string,
              parent: string,
              mask?: DocumentMask,
              orderBy?: string,
              pageSize?: number,
              pageToken?: string,
              readTime?: string,
              showMissing?: boolean,
              transaction?: string,
            ): ListDocumentsResponse
            export function listCollectionIds(
              parent: string,
              body: ListCollectionIdsRequest,
            ): ListCollectionIdsResponse
            export function partitionQuery(
              parent: string,
              body: PartitionQueryRequest,
            ): PartitionQueryResponse
            export function patch(
              name: string,
              currentDocument: Precondition,
              mask: DocumentMask,
              updateMask: DocumentMask,
              body: Pick<Document, 'fields' | 'name'>,
            ): Document
            export function rollback(
              database: string,
              body: RollbackRequest,
            ): void
            export function runQuery(
              parent: string,
              body: RunQueryRequest,
            ): RunQueryResponse
            export { _delete as delete }
          }
          namespace operations {
            export function cancel(name: string): void
            function _delete(name: string): void
            export function get(name: string): GoogleLongrunningOperation
            export function list(
              name: string,
              filter?: string,
              pageSize?: number,
              pageToken?: string,
            ): GoogleLongrunningListOperationsResponse
            export { _delete as delete }
          }
        }
        namespace locations {
          export function get(name: string): Location
          export function list(
            name: string,
            filter: string,
            pageSize?: number,
            pageToken?: string,
          ): ListLocationsResponse
        }
      }
    }
  }
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
    | ((errormap: Record<string, any>) => void)
    | {
        predicate?: (errormap: Record<string, any>) => boolean
        max_retries?: number | string | null
        backoff: {
          initial_delay?: number | string | null
          max_delay?: number | string | null
          multiplier?: number | string | null
        }
      },
): void

export declare function call_step<T, A extends any[]>(
  func: (...args: A) => T,
  arguments: Record<string, unknown>,
): T
