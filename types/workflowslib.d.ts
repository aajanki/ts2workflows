export {}

// Type annotations for GCP Workflows expression helpers, standard library
// functions and (some) connectors

// An opaque bytes type.
// This should really be defined in the transpiler, not here.
declare const __bytes_tag: unique symbol
export interface bytes {
  readonly [__bytes_tag]: 'bytes'
}

// GCP Workflows data types
export type WorkflowsValue =
  | boolean
  | number
  | string
  | bytes
  | WorkflowsValue[]
  | { [key: string]: WorkflowsValue }
  | null

type BooleanNumberStringListOrDict =
  | boolean
  | number
  | string
  | BooleanNumberStringListOrDict[]
  | { [key: string]: BooleanNumberStringListOrDict }

type HTTPQuery = Record<
  string,
  string | number | boolean | (string | number | boolean)[]
>

// GCP Workflows expression helpers

export declare function double(x: string | number): number
export declare function int(x: string | number): number
export declare function string(x: string | number | boolean): string
export declare function keys<T extends object>(map: T): (keyof T)[]
export declare function len(
  value: unknown[] | Record<string, unknown> | string,
): number
export declare function get_type(
  value: unknown,
):
  | 'boolean'
  | 'bytes'
  | 'double'
  | 'integer'
  | 'list'
  | 'map'
  | 'string'
  | 'null'

// GCP Workflows standard library functions
// https://cloud.google.com/workflows/docs/reference/stdlib/overview

export declare namespace base64 {
  function decode(data: bytes, padding?: boolean): string
  function encode(data: string, padding?: boolean): bytes
}

export declare namespace events {
  function await_callback<ResponseType = WorkflowsValue>(
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
  function _delete<ResponseType = WorkflowsValue>(
    url: string,
    timeout?: number,
    body?: any,
    headers?: Record<string, string>,
    query?: HTTPQuery,
    auth?: Record<string, string>,
    private_service_name?: string,
    ca_certificate?: string,
  ): {
    body: ResponseType
    code: number
    headers: Record<string, string>
  }
  export function get<ResponseType = WorkflowsValue>(
    url: string,
    timeout?: number,
    headers?: Record<string, string>,
    query?: HTTPQuery,
    auth?: Record<string, string>,
    private_service_name?: string,
    ca_certificate?: string,
  ): {
    body: ResponseType
    code: number
    headers: Record<string, string>
  }
  export function patch<ResponseType = WorkflowsValue>(
    url: string,
    timeout?: number,
    body?: any,
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
  export function post<ResponseType = WorkflowsValue>(
    url: string,
    timeout?: number,
    body?: any,
    headers?: Record<string, string>,
    query?: HTTPQuery,
    auth?: Record<string, string>,
    private_service_name?: string,
    ca_certificate?: string,
  ): {
    body: ResponseType
    code: number
    headers: Record<string, string>
  }
  export function put<ResponseType = WorkflowsValue>(
    url: string,
    timeout?: number,
    body?: any,
    headers?: Record<string, string>,
    query?: HTTPQuery,
    auth?: Record<string, string>,
    private_service_name?: string,
    ca_certificate?: string,
  ): {
    body: ResponseType
    code: number
    headers: Record<string, string>
  }
  export function request<ResponseType = WorkflowsValue>(
    method: string,
    url: string,
    timeout?: number,
    body?: any,
    headers?: Record<string, string>,
    query?: HTTPQuery,
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
  function decode(data: bytes | string): WorkflowsValue
  function encode(
    data: unknown,
    indent?:
      | boolean
      | {
          prefix?: string
          indent?: string
        },
  ): bytes
  function encode_to_string(
    data: unknown,
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

// Typescript `object` is actually too liberal as it includes arrays. Workflows
// will throw an error if the input is an array.
export declare namespace map {
  // If K is a literal key of T, return the exact type.
  // Otherwise the best we can do is to return a Record with
  // any of T property values.
  function _delete<T extends object, K extends string>(
    map: T,
    key: K,
  ): K extends keyof T ? Omit<T, K> : Record<string, T[keyof T]>
  // map.get() with a string key.
  // If K is a literal key of T, this returns the exact type T[K].
  // Otherwise returns less exact union of all T property types or null.
  export function get<T extends object, K extends string>(
    map: T,
    keys: K,
  ): K extends keyof T ? T[K] : T[keyof T] | null
  // map.get() with string[] key, the return type is not inferred
  export function get(map: object, keys: string[]): WorkflowsValue
  export function merge<T extends object, U extends object>(
    first: T,
    second: U,
  ): T & U
  export function merge_nested<T extends object, U extends object>(
    first: T,
    second: U,
  ): T & U
  export { _delete as delete }
}

export declare namespace math {
  function abs(x: number): number
  function max(x: number, y: number): number
  function min(x: number, y: number): number
}

export declare namespace retry {
  function always(exception: any): void
  const default_backoff: {
    initial_delay: number
    max_delay: number
    multiplier: number
  }
  function never(exception: any): void
}

export declare namespace sys {
  function get_env(name: string): string | null
  function get_env(name: string, default_value: string): string
  function log(
    data?: BooleanNumberStringListOrDict,
    severity?: string,
    text?: BooleanNumberStringListOrDict,
    json?: Record<string, any>,
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

export declare namespace googleapis {
  // Cloud Firestore API Connector
  // https://cloud.google.com/workflows/docs/reference/googleapis/firestore/Overview
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
        metadata?: Record<string, any>
        name: string
        response: Record<string, any>
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
        metadata?: Record<string, any>
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
        document?: Document
        readTime: string
        skippedResults?: number
        transaction?: string
      }
      interface Status {
        code: number
        details: Record<string, any>[]
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
              currentDocument: Precondition | undefined,
              mask: DocumentMask | undefined,
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
            ): RunQueryResponse[]
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

  // Cloud Pub/Sub API Connector
  // https://docs.cloud.google.com/workflows/docs/reference/googleapis/pubsub/Overview
  namespace pubsub {
    namespace v1 {
      interface AcknowledgeRequest {
        ackIds: string[]
      }
      interface Binding {
        condition: Expr
        members: string[]
        role: string
      }
      interface CreateSnapshotRequest {
        label?: Record<string, string>
        subscription: string
      }
      interface DeadLetterPolicy {
        deadLetterTopic: string
        maxDeliveryAttempts?: number
      }
      interface Expr {
        description?: string
        expression: string
        location?: string
        title?: string
      }
      interface ExpirationPolicy {
        ttl: string
      }
      interface ListSchemasResponse {
        nextPageToken?: string
        schemas: Schema[]
      }
      interface ListSnapshotsResponse {
        nextPagetoken?: string
        snapshots?: Snapshot[]
      }
      interface ListSubscriptionsResponse {
        nextPageToken?: string
        subscriptions?: Subscription[]
      }
      interface ListTopicsResponse {
        nextPageToken?: string
        topics?: Topic[]
      }
      interface ListTopicSubscriptionsResponse {
        nextPageToken?: string
        subscriptions?: string[]
      }
      interface ListTopicSnapshotsResponse {
        nextPageToken?: string
        snapshots?: string[]
      }
      interface MessageStoragePolicy {
        allowedPersistenceRegions?: string[]
      }
      interface ModifyAckDeadlineRequest {
        ackDeadlineSeconds: number
        ackIds: string[]
      }
      interface ModifyPushConfigRequest {
        pushConfig: PushConfig
      }
      interface OidcToken {
        audience: string
        serviceAccountEmail: string
      }
      interface Policy {
        bindings: Binding[]
        etag: string
        version: number
      }
      interface PublishRequest {
        messages: PubsubMessage[]
      }
      interface PublishResponse {
        messageIds?: string[]
      }
      interface PubsubMessage {
        attributes?: Record<string, string>
        data?: string
        messageId?: string
        orderingKey?: string
        publishTime?: string
      }
      interface PullRequest {
        maxMessages: number
        returnImmediately?: boolean
      }
      interface PullResponse {
        receivedMessages: ReceivedMessage[]
      }
      interface PushConfig {
        attributes: Record<string, string>
        oidcToken: OidcToken
        pushEndpoint: string
      }
      interface ReceivedMessage {
        ackId: string
        deliveryAttempt: number
        message: PubsubMessage
      }
      interface RetryPolicy {
        maximumBackoff?: string
        minimumBackoff?: string
      }
      interface Schema {
        definition: string
        name: string
        type: 'TYPE_UNSPECIFIED' | 'PROTOCOL_BUFFER' | 'AVRO'
      }
      interface SchemaSettings {
        encoding?: 'ENCODING_UNSPECIFIED' | 'JSON' | 'BINARY'
        schema: string
      }
      interface SeekRequest {
        snapshot?: string
        time?: string
      }
      interface SetIamPolicyRequest {
        policy: Policy
      }
      interface Snapshot {
        expireTime?: string
        labels?: Record<string, string>
        name?: string
        topic?: string
      }
      interface Subscription {
        ackDeadlineSeconds?: number
        deadLetterPolicy?: DeadLetterPolicy
        detached?: boolean
        enableMessageOrdering?: boolean
        expirationPolicy?: ExpirationPolicy
        filter?: string
        labels?: Record<string, string>
        messageRetentionDuration?: string
        name: string
        pushConfig?: PushConfig
        retainAckedMessages?: boolean
        retryPolicy?: RetryPolicy
        topic: string
        topicMessageRetentionDuration?: string
      }
      interface TestIamPermissionsRequest {
        permissions: string[]
      }
      interface TestIamPermissionsResponse {
        permissions: string[]
      }
      interface Topic {
        kmsKeyName?: string
        labels?: Map<string, string>
        messageRetentionDuration?: string
        messageStoragePolicy?: MessageStoragePolicy
        name: string
        satisfiesPzs?: boolean
        schemaSettings?: SchemaSettings
      }
      interface UpdateSnapshotRequest {
        snapshot: Snapshot
        updateMask: string
      }
      interface UpdateSubscriptionRequest {
        subscription: Subscription
        updateMask: string
      }
      interface UpdateTopicRequest {
        topic: Topic
        updateMask: string
      }
      interface ValidateMessageRequest {
        encoding: 'ENCODING_UNSPECIFIED' | 'JSON' | 'BINARY'
        message: string
        name?: string
        schema?: Schema
      }
      interface ValidateSchemaRequest {
        object: Schema
      }

      namespace projects {
        namespace schemas {
          export function create(
            parent: string,
            schemaId: string,
            body: Schema,
          ): Schema
          function _delete(name: string): void
          export { _delete as delete }
          export function get(
            name: string,
            view?: 'SCHEMA_VIEW_UNSPECIFIED' | 'BASIC' | 'FULL',
          ): Schema
          export function list(
            parent: string,
            pageSize?: number,
            pageToken?: string,
            view?: 'SCHEMA_VIEW_UNSPECIFIED' | 'BASIC' | 'FULL',
          ): ListSchemasResponse
          export function validate(
            parent: string,
            body: ValidateSchemaRequest,
          ): void
          export function validateMessage(
            parent: string,
            body: ValidateMessageRequest,
          ): void
        }

        namespace snapshots {
          export function create(
            name: string,
            object: CreateSnapshotRequest,
          ): Snapshot
          function _delete(snapshot: string): void
          export { _delete as delete }
          export function getIamPolicy(
            resource: string,
            options: { requestedPolicyVersion: number },
          ): Policy
          export function list(
            project: string,
            pageSize?: number,
            pageToken?: string,
          ): ListSnapshotsResponse
          export function patch(
            name: string,
            body: UpdateSnapshotRequest,
          ): Snapshot
          export function setIamPolicy(
            resource: string,
            body: SetIamPolicyRequest,
          ): Policy
          export function testIamPermissions(
            resource: string,
            body: TestIamPermissionsRequest,
          ): TestIamPermissionsResponse
        }

        namespace subscriptions {
          export function acknowledge(
            subscription: string,
            body: AcknowledgeRequest,
          ): void
          export function create(name: string, body: Subscription): Subscription
          function _delete(subscription: string): void
          export { _delete as delete }
          export function detach(subscription: string): void
          export function get(subscription: string): Subscription
          export function getIamPolicy(
            resource: string,
            options: { requestedPolicyVersion: number },
          ): Policy
          export function list(
            project: string,
            pageSize?: number,
            pageToken?: string,
          ): ListSubscriptionsResponse
          export function modifyAckDeadline(
            subscription: string,
            body: ModifyAckDeadlineRequest,
          ): void
          export function modifyPushConfig(
            subscription: string,
            body: ModifyPushConfigRequest,
          ): void
          export function patch(
            name: string,
            body: UpdateSubscriptionRequest,
          ): Subscription
          export function pull(
            subscription: string,
            body: PullRequest,
          ): PullResponse
          export function seek(subscription: string, body: SeekRequest): void
          export function setIamPolicy(
            resource: string,
            body: SetIamPolicyRequest,
          ): Policy
          export function testIamPermissions(
            resource: string,
            body: TestIamPermissionsRequest,
          ): TestIamPermissionsResponse
        }

        namespace topics {
          export function create(name: string, body: Topic): Topic
          function _delete(topic: string): void
          export { _delete as delete }
          export function get(topic: string): Topic
          export function getIamPolicy(
            resource: string,
            options: { requestedPolicyVersion: number },
          ): Policy
          export function list(
            project: string,
            pageSize?: number,
            pageToken?: string,
          ): ListTopicsResponse
          export function patch(name: string, body: UpdateTopicRequest): Topic
          export function publish(
            topic: string,
            body: PublishRequest,
          ): PublishResponse
          export function setIamPolicy(
            resource: string,
            body: SetIamPolicyRequest,
          ): Policy
          export function testIamPermissions(
            resource: string,
            body: TestIamPermissionsRequest,
          ): TestIamPermissionsResponse

          namespace snapshots {
            export function list(
              topic: string,
              pageSize?: number,
              pageToken?: string,
            ): ListTopicSnapshotsResponse
          }

          namespace subscriptions {
            export function list(
              topic: string,
              pageSize?: number,
              pageToken?: string,
            ): ListTopicSubscriptionsResponse
          }
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
  arguments: Record<string, any>,
): T
