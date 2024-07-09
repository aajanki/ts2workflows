import { sys, time, or_else } from 'workflowslib'

function main() {
  const workflow_id: string = or_else(
    sys.get_env('GOOGLE_CLOUD_WORKFLOW_ID'),
    'unknown',
  )
  const timestamp: string = time.format(sys.now())

  sys.log(timestamp + ': ' + workflow_id)
}
