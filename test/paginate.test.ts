import { describe, expect, it, vi } from 'vitest'
import { paginate } from '../src/paginate.js'

const rows = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `${from + index}` }))

describe('paginate', () => {
  it('stops on the first short page', async () => {
    const fetchPage = vi.fn(async (limit: number, offset: number) => rows(offset, Math.min(limit, 7)))

    const result = await paginate(fetchPage, row => row.id, 10)

    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(7)
  })

  it('keeps paging while pages come back full', async () => {
    const pages = [rows(0, 10), rows(10, 10), rows(20, 3)]
    const fetchPage = vi.fn(async (_limit: number, offset: number) => pages[offset / 10])

    const result = await paginate(fetchPage, row => row.id, 10)

    expect(fetchPage).toHaveBeenCalledTimes(3)
    expect(result).toHaveLength(23)
    expect(result[22].id).toEqual('22')
  })

  it('stops when a full page is the last one', async () => {
    const pages = [rows(0, 10), []]
    const fetchPage = vi.fn(async (_limit: number, offset: number) => pages[offset / 10])

    const result = await paginate(fetchPage, row => row.id, 10)

    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(result).toHaveLength(10)
  })

  it('drops rows that shift across a page boundary', async () => {
    // a row already seen on page one reappears on page two because new rows landed in between
    const pages = [rows(0, 10), [{ id: '9' }, ...rows(10, 2)]]
    const fetchPage = vi.fn(async (_limit: number, offset: number) => pages[offset / 10])

    const result = await paginate(fetchPage, row => row.id, 10)

    expect(result).toHaveLength(12)
    expect(result.filter(row => row.id === '9')).toHaveLength(1)
  })
})
