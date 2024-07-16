import { http, sys, time, retry_policy } from 'workflowslib'

function main() {
  const workflow_id: string =
    sys.get_env('GOOGLE_CLOUD_WORKFLOW_ID') ?? 'unknown'
  const timestamp: string = time.format(sys.now())

  let response
  try {
    response = http.get('https://visit.dreamland.test/')
  } catch (err) {
    sys.log(
      'Error in HTTP request at ' + timestamp + ', workflow_id ' + workflow_id,
      'ERROR',
    )
    response = { body: {} }
  }
  retry_policy({
    predicate: http.default_retry_predicate,
    max_retries: 3,
    backoff: {
      initial_delay: 0.5,
      max_delay: 60,
      multiplier: 2,
    },
  })

  sys.log(response.body as object)
}
