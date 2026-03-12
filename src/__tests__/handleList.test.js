import { describe, it, expect } from 'vitest'
import { getHandleList, addHandle, removeHandle, clearHandleList } from '../utils/handleList'

describe('handleList', () => {
  it('starts empty', () => {
    expect(getHandleList()).toEqual([])
  })

  it('adds handles (normalized lowercase, no @)', () => {
    addHandle('@DJCool')
    addHandle('producer123')
    expect(getHandleList()).toEqual(['djcool', 'producer123'])
  })

  it('prevents duplicate handles', () => {
    addHandle('djcool')
    addHandle('djcool')
    addHandle('DJCool')
    expect(getHandleList()).toEqual(['djcool'])
  })

  it('removes a handle', () => {
    addHandle('artist1')
    addHandle('artist2')
    removeHandle('artist1')
    expect(getHandleList()).toEqual(['artist2'])
  })

  it('removeHandle normalizes input', () => {
    addHandle('djcool')
    removeHandle('@DJCool')
    expect(getHandleList()).toEqual([])
  })

  it('clears all handles', () => {
    addHandle('a')
    addHandle('b')
    clearHandleList()
    expect(getHandleList()).toEqual([])
  })

  it('returns updated list from add/remove/clear', () => {
    const added = addHandle('test')
    expect(added).toEqual(['test'])
    const removed = removeHandle('test')
    expect(removed).toEqual([])
    const cleared = clearHandleList()
    expect(cleared).toEqual([])
  })
})
