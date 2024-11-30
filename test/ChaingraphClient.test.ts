import { describe, expect, it } from 'vitest'
import { ChaingraphClient, graphql } from '../src/index.js'

describe('test the ChaingraphClient wrapper functions', () => {
  const chaingraphUrl = "https://gql.chaingraph.pat.mn/v1/graphql"
  const chaingraphClient = new ChaingraphClient(chaingraphUrl)

  it('should test the query wrapper', async () => {
    const queryReqAuthHead = graphql(`query authHeadTransactionId(
      $tokenId: bytea!
    ){
      transaction(
        where: {
          hash: { _eq: $tokenId }
        }
      ) {
        authchains {
          authhead {
            hash
          }
        }
      }
    }`);
    const tokenId = "8473d94f604de351cdee3030f6c354d36b257861ad8e95bbc0a06fbab2a2f9cf";
    const variables = {
      tokenId: `\\x${tokenId}`
    }
    const resultQueryAuthHead = await chaingraphClient.query(queryReqAuthHead, variables)
    const authHeadTxId = resultQueryAuthHead.data?.transaction?.[0].authchains?.[0].authhead?.hash

    expect(authHeadTxId).toEqual(expect.any(String))
  })
})