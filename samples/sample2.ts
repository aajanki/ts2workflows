// Change the path to 'ts2workflows/types/workflowslib'
// in projects that use ts2workflows module as a dependency.
import { sys, time } from '../types/workflowslib'
import { get_url } from './http_helpers'

function main() {
  // Calling GCP Workflows standard library functions
  const timestamp: string = time.format(sys.now())
  const workflow_id: string =
    sys.get_env('GOOGLE_CLOUD_WORKFLOW_ID') ?? 'unknown'

  // Calling a subworkflow defined in another source file
  const response = get_url('https://visit.dreamland.test/')

  sys.log(response.body as object)
}
