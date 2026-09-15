import { describe, expect, it } from 'vitest'
import { ChaingraphClient, graphql } from '../../src/index.js'

const chaingraphUrl = "https://gql.chaingraph.pat.mn/v1/graphql"

const newBlockSubscription = graphql(`subscription MonitorNewBlocks {
  block(order_by: { height: desc }, limit: 1) {
    height
  }
}`)

describe('subscribeWithCallback', () => {
  it('delivers data to the callback and closes cleanly', async () => {
    const chaingraphClient = new ChaingraphClient(chaingraphUrl)
    let blockHeight = 0

    await new Promise<void>((resolve, reject) => {
      const subscription = chaingraphClient.subscribeWithCallback(
        newBlockSubscription,
        {},
        async data => {
          blockHeight = Number(data.block[0].height)
          subscription.unsubscribe()
          resolve()
        },
        reject
      )
    })
    await chaingraphClient.close()

    expect(blockHeight).toBeGreaterThan(900_000)
  }, 30000)

  it('routes a failing callback to onError instead of rejecting unhandled', async () => {
    const chaingraphClient = new ChaingraphClient(chaingraphUrl)

    const error = await new Promise<unknown>(resolve => {
      const subscription = chaingraphClient.subscribeWithCallback(
        newBlockSubscription,
        {},
        async () => { throw new Error('callback blew up') },
        caught => {
          subscription.unsubscribe()
          resolve(caught)
        }
      )
    })
    await chaingraphClient.close()

    expect((error as Error).message).toEqual('callback blew up')
  }, 30000)
})
