import { describe, expect, it, vi } from 'vitest'
import { ChaingraphClient, type ChaingraphClientOptions } from '../src/index.js'

// Node resolution is tested offline: it decides which network's results a caller gets, and a
// live multi-network instance is not something to depend on for that.
function clientWithNodes(
  names: string[],
  options?: ChaingraphClientOptions,
  behaviour: 'ok' | 'fail' = 'ok'
) {
  const chaingraphClient = new ChaingraphClient("https://example.invalid/v1/graphql", options)
  const node = names.map((name, index) => ({ name, internal_id: index + 1 }))
  const query = vi.fn(() => ({
    toPromise: async () => {
      if (behaviour === 'fail') return { error: new Error('instance unreachable') }
      return { data: { node } }
    }
  }))
  chaingraphClient.client.query = query as never
  return { chaingraphClient, query }
}

describe('node resolution', () => {
  it('uses the only node an instance indexes', async () => {
    const { chaingraphClient } = clientWithNodes(['graph-mainnet'])

    expect(await chaingraphClient.resolveNode()).toEqual({ name: 'graph-mainnet', internalId: 1 })
  })

  it('matches a differently named node by network', async () => {
    const { chaingraphClient } = clientWithNodes(
      ['graph-mainnet', 'graph-chipnet'], { network: 'mainnet' }
    )

    expect((await chaingraphClient.resolveNode())?.name).toEqual('graph-mainnet')
  })

  it('throws when several networks are indexed and none was picked', async () => {
    const { chaingraphClient } = clientWithNodes(['bchn-mainnet', 'bchn-testnet', 'bchn-chipnet'])

    await expect(chaingraphClient.resolveNode()).rejects.toThrow(/several networks/)
  })

  it('names the available nodes when the requested network is absent', async () => {
    const { chaingraphClient } = clientWithNodes(['bchn-mainnet'], { network: 'chipnet' })

    await expect(chaingraphClient.resolveNode()).rejects.toThrow(
      /indexes no 'chipnet' node, it indexes: bchn-mainnet/
    )
  })

  it('rejects an explicit node name the instance does not have', async () => {
    const { chaingraphClient } = clientWithNodes(
      ['graph-mainnet'], { nodeName: 'bchn-mainnet' }
    )

    await expect(chaingraphClient.resolveNode()).rejects.toThrow(/no node named 'bchn-mainnet'/)
  })

  it('looks the nodes up once and caches the answer', async () => {
    const { chaingraphClient, query } = clientWithNodes(['graph-mainnet'])

    await chaingraphClient.resolveNode()
    await chaingraphClient.resolveNode()

    expect(query).toHaveBeenCalledTimes(1)
  })

  it('raises a failed lookup rather than degrading to unscoped queries', async () => {
    const { chaingraphClient } = clientWithNodes(['graph-mainnet'], {}, 'fail')

    await expect(chaingraphClient.resolveNode()).rejects.toThrow(/instance unreachable/)
  })

  it('does not cache a lookup that failed', async () => {
    const { chaingraphClient, query } = clientWithNodes(['graph-mainnet'], {}, 'fail')

    await expect(chaingraphClient.resolveNode()).rejects.toThrow()
    await expect(chaingraphClient.resolveNode()).rejects.toThrow()

    expect(query).toHaveBeenCalledTimes(2)
  })

  it('falls back to a configured node name when the lookup fails', async () => {
    const { chaingraphClient } = clientWithNodes(
      ['graph-mainnet'], { nodeName: 'graph-mainnet' }, 'fail'
    )

    expect(await chaingraphClient.resolveNode()).toEqual({ name: 'graph-mainnet' })
  })

  it('resolves to undefined only when the instance indexes no nodes', async () => {
    const { chaingraphClient } = clientWithNodes([])

    expect(await chaingraphClient.resolveNode()).toBeUndefined()
  })
})
