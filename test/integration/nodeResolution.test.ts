import { describe, expect, it } from 'vitest'
import { ChaingraphClient } from '../../src/index.js'
const PAT = "https://gql.chaingraph.pat.mn/v1/graphql"
const DEMO = "https://demo.chaingraph.cash/v1/graphql"

describe('node resolution', () => {
  it('single-node instance needs no config', async () => {
    const node = await new ChaingraphClient(PAT).resolveNode()
    expect(node?.name).toBe('graph-mainnet')
    expect(typeof node?.internalId).toBe('number')
  }, 30000)
  it('matches by network on a differently named node', async () => {
    expect((await new ChaingraphClient(PAT, { network: 'mainnet' }).resolveNode())?.name).toBe('graph-mainnet')
  }, 30000)
  it('throws for a network the instance does not index', async () => {
    await expect(new ChaingraphClient(PAT, { network: 'chipnet' }).resolveNode()).rejects.toThrow(/indexes no 'chipnet'/)
  }, 30000)
  it('throws on a multi-network instance with no network picked', async () => {
    await expect(new ChaingraphClient(DEMO).resolveNode()).rejects.toThrow(/several networks/)
  }, 30000)
  it('picks the chipnet node on a multi-network instance', async () => {
    const node = await new ChaingraphClient(DEMO, { network: 'chipnet' }).resolveNode()
    expect(node?.name).toBe('bchn-chipnet')
  }, 30000)
  it('rejects an unknown explicit node name', async () => {
    await expect(new ChaingraphClient(PAT, { nodeName: 'bchn-mainnet' }).resolveNode()).rejects.toThrow(/no node named/)
  }, 30000)
})
