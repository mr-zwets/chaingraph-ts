import { describe, expect, it } from 'vitest'
import { ChaingraphClient } from '../../src/index.js'

// The resolution logic itself is covered offline in test/nodeResolution.test.ts; this checks it
// against a real instance, including that internal_id comes back for send_transaction.
const chaingraphUrl = "https://gql.chaingraph.pat.mn/v1/graphql"

describe('node resolution against a live instance', () => {
  it('resolves the only node the instance indexes', async () => {
    const node = await new ChaingraphClient(chaingraphUrl).resolveNode()

    expect(node?.name).toEqual('graph-mainnet')
    expect(typeof node?.internalId).toEqual('number')
  }, 30000)

  it('matches that node by network', async () => {
    const chaingraphClient = new ChaingraphClient(chaingraphUrl, { network: 'mainnet' })

    expect((await chaingraphClient.resolveNode())?.name).toEqual('graph-mainnet')
  }, 30000)

  it('throws for a network the instance does not index', async () => {
    const chaingraphClient = new ChaingraphClient(chaingraphUrl, { network: 'chipnet' })

    await expect(chaingraphClient.resolveNode()).rejects.toThrow(/indexes no 'chipnet'/)
  }, 30000)
})
