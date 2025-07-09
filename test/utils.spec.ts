/* eslint-disable @typescript-eslint/no-unsafe-call */

import { expect } from 'chai'
import { isRecord } from '../src/utils'

describe('isRecord', () => {
  it('returns true on an empty map literal', () => {
    expect(isRecord({})).to.equal(true)
  })

  it('returns true on a map', () => {
    const x = {
      name: 'Bean',
      country: 'Dreamland',
    }
    expect(isRecord(x)).to.equal(true)
  })

  it('returns false on a class instance', () => {
    class TestClz {
      constructor(public color: string) {}
    }

    const instance = new TestClz('green')
    expect(isRecord(instance)).to.equal(false)
  })

  it('returns false on null', () => {
    expect(isRecord(null)).to.equal(false)
  })

  it('returns false on undefined', () => {
    expect(isRecord(undefined)).to.equal(false)
  })

  it('returns false on primitives', () => {
    expect(isRecord(1)).to.equal(false)
    expect(isRecord('A')).to.equal(false)
    expect(isRecord(true)).to.equal(false)
  })

  it('returns false on RegEx', () => {
    expect(isRecord(/abc./)).to.equal(false)
  })
})
