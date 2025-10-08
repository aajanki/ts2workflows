import { compute } from './computation'

function main() {
  return call_twice(compute)
}

function call_twice(fn: () => void) {
  fn()
  fn()
}

main()
