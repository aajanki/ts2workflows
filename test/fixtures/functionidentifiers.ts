// max is imported but not used on purpose. The unit test should not pick max.
import { compute, max } from './computation'

function main() {
  return call_twice(compute)
}

function call_twice(fn: () => void) {
  fn()
  fn()
}

main()
