import { getFirstNumber, getSecondNumber } from './numbers'

export function compute() {
  const x = getFirstNumber()
  const y = getSecondNumber()
  return average(x, y)
}

export function max(x: number, y: number): number {
  return x > y ? x : y
}

function average(x: number, y: number): number {
  return (x + y) / 2
}
