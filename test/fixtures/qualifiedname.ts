namespace MyMath {
  export function sin(x: number): number {
    return x // for small values of x
  }
}

function main() {
  return MyMath.sin(0.01)
}

main()
