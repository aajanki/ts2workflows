export function compute() {
  timesTwo(number1)
}

function timesTwo(fn: () => number) {
  return 2 * fn()
}

function number1(): number {
  return 1
}
