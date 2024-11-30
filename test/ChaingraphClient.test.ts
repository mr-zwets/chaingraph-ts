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

  it('should test the subscribe wrapper', async () => {
    const newBlockSubscription = graphql(`subscription MonitorNewBlocks {
      block(order_by: { height: desc }, limit: 1) {
        height
        timestamp
      }
    }`);

    let blockHeight = 0
    async function waitForFirstSubscription() {
      return new Promise<void>((resolve, reject) => {
        chaingraphClient.subscribe(newBlockSubscription, {}).subscribe(async result => {
          if (result.data?.block?.[0]) {
            const { height, timestamp } = result.data.block[0];
            await handleNewBlock(Number(height), timestamp);
            resolve(); // Resolve the promise when the first result is received
          } else if (result.error) {
            console.error("New block subscription error:", result.error);
            reject(result.error); // Reject the promise if there's an error
          }
        });
      });
    }

    async function handleNewBlock(newBlockHeight: number, timestamp: string) {
      if (newBlockHeight <= blockHeight) return; // Ignore duplicate or older blocks

      console.log(`Processing new block at height ${newBlockHeight}, timestamp: ${timestamp}`);
      blockHeight = newBlockHeight;
    }

    await waitForFirstSubscription();
    expect(blockHeight).toEqual(expect.any(Number))
  })
})