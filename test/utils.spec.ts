/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */

import { expect } from 'chai'
import { chainPairs } from '../src/utils'

describe('Utils', () => {
  it('chainPairs empty array', () => {
    const chained = chainPairs((x: number) => [x], [])
    expect(chained).to.deep.eq([])
  })

  it('chainPairs single element', () => {
    const chained: string[] = chainPairs(
      (x: string, y?: string) => [x, y ?? ''],
      ['a'],
    )
    expect(chained).to.deep.eq(['a', ''])
  })

  it('chainPairs multiple elements', () => {
    const chained = chainPairs(
      (x: string, y?: string) => [[x, y]],
      ['a', 'b', 'c'],
    )
    expect(chained).to.deep.equal([
      ['a', 'b'],
      ['b', 'c'],
      ['c', undefined],
    ])
  })
})
