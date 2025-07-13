export function compute() {
  const x = getFirstNumber()
  const y = getSecondNumber()
  return average(x, y)
}

function average(x: number, y: number): number {
  return (x + y) / 2
}

function getFirstNumber(): number {
  return 1
}

function getSecondNumber(): number {
  return 2
}
