import { describe, expect, it } from 'vitest'
import { ChaingraphClient } from '../src/index.js'

describe('test the ChaingraphClient helperFunctions', () => {
  const chaingraphUrl = "https://gql.chaingraph.pat.mn/v1/graphql"
  const chaingraphClient = new ChaingraphClient(chaingraphUrl)

  it.todo('should test the getUtxosForAddress function', async () => {
    // test the getUtxosForAddress function
  })

  it.todo('should test the getUtxosForLockingBytecode function', async () => {
    // test the getUtxosForLockingBytecode function
  })

  it.todo('should test the sendRawTransaction function', async () => {
    // test the sendRawTransaction function
  })

  it('should test the getRawTransaction function', async () => {
    // test the getRawTransaction function
    const transactionId = "4db095f34d632a4daf942142c291f1f2abb5ba2e1ccac919d85bdc2f671fb251"
    const rawTransaction = await chaingraphClient.getRawTransaction(transactionId)

    expect(rawTransaction).toEqual(expect.any(String))
  })

  it('should test the getLatestBlockheight function', async () => {
    // test the getLatestBlockheight function
    const blockHeight = await chaingraphClient.getBlockHeight()

    expect(blockHeight).toEqual(expect.any(Number))
  })
})