// Change the path to 'ts2workflows/types/workflowslib'
// in projects that use ts2workflows module as a dependency.
import { http, sys, retry_policy, WorkflowsValue } from '../types/workflowslib'

export function get_url(url: string) {
  try {
    // retry_policy() is a compiler intrinsic that marks that this retry block
    // is retried on failure
    retry_policy({
      predicate: http.default_retry_predicate,
      max_retries: 3,
      backoff: {
        initial_delay: 0.5,
        max_delay: 60,
        multiplier: 2,
      },
    })

    return http.get<string>(url)
  } catch (err) {
    if ((err as { code: number }).code === 404) {
      sys.log('Page not found', 'ERROR')
    }

    return { body: '' }
  }
}

export function post_url(url: string, payload: WorkflowsValue): WorkflowsValue {
  return http.post(url, 1000, payload)
}
