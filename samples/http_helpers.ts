// Change the path to 'ts2workflows/types/workflowslib'
// in projects that use ts2workflows module as a dependency.
import { http, retry_policy, sys } from '../types/workflowslib'

export function get_url(url: string) {
  try {
    return http.get<string>(url)
  } catch (err) {
    if ((err as { code: number }).code === 404) {
      sys.log('Page not found', 'ERROR')
    }
    return { body: '' }
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
}
