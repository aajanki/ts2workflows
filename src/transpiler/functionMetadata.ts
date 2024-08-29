// Blocking calls and their argument names. Blocking call must be run from a
// call step (not inside an expression)
//
// TODO: Can this be generated from types/workflowslib.d.ts?
export const blockingFunctions = new Map([
  ['events.await_callback', ['callback', 'timeout']],
  [
    'http.delete',
    [
      'url',
      'timeout',
      'body',
      'headers',
      'query',
      'auth',
      'private_service_name',
      'ca_certificate',
    ],
  ],
  [
    'http.get',
    [
      'url',
      'timeout',
      'headers',
      'query',
      'auth',
      'private_service_name',
      'ca_certificate',
    ],
  ],
  [
    'http.patch',
    [
      'url',
      'timeout',
      'body',
      'headers',
      'query',
      'auth',
      'private_service_name',
      'ca_certificate',
    ],
  ],
  [
    'http.post',
    [
      'url',
      'timeout',
      'body',
      'headers',
      'query',
      'auth',
      'private_service_name',
      'ca_certificate',
    ],
  ],
  [
    'http.put',
    [
      'url',
      'timeout',
      'body',
      'headers',
      'query',
      'auth',
      'private_service_name',
      'ca_certificate',
    ],
  ],
  [
    'http.request',
    [
      'method',
      'url',
      'timeout',
      'body',
      'headers',
      'query',
      'auth',
      'private_service_name',
      'ca_certificate',
    ],
  ],
  ['sys.log', ['data', 'severity', 'text', 'json', 'timeout']],
  ['sys.sleep', ['seconds']],
  ['sys.sleep_until', ['time']],
])
