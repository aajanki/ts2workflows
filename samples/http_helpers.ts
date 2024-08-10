import { http, retry_policy, sys } from 'workflowslib'

export function get_url(url: string) {
  try {
    return http.get(url)
  } catch (err) {
    if ((err as { code: number }).code === 404) {
      sys.log('Page not found', 'ERROR')
    }
    return { body: {} }
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
