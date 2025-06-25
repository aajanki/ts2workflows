export function main() {
  const a = count(10, 0)
  const b = mutualRecursion(5)

  return a + b
}

function count(limit: number, acc: number): number {
  if (acc >= limit) {
    return acc
  } else {
    return count(limit, acc + 1)
  }
}

function mutualRecursion(x: number): number {
  if (x > 0) {
    return mutualRecursion2(x - 1)
  } else {
    return 0
  }
}

function mutualRecursion2(y: number): number {
  return mutualRecursion(y / 2)
}

main()
