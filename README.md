# Chaingraph-ts

Chaingraph-ts is a TypeScript library that simplifies using [Chaingraph](https://chaingraph.cash/) by providing type-safe GraphQL interactions and helper functions.

## Features

Type-Safe Interactions: Fully typed `graphql` function through `gql-tada` for custom GraphQL operations.

Prebuilt Helper Functions: Includes ready-to-use functions for common tasks, such as:
- `getRawTransaction`: Retrieve raw transaction hex by transaction ID.
- `sendRawTransaction`: Broadcast a raw transaction to the network.
- `getUtxosForAddress`: Fetch UTXOs for a given address.

No Setup Required: Start quickly without the need to configure the generated types and the graphQl client configuartion manually.

## Details

Chaingraph-ts is built on top of:

- [Urql](https://commerce.nearform.com/open-source/urql/docs/): A lightweight GraphQL client for handling queries and subscriptions.
- [gql-tada](https://gql-tada.0no.co/): Ensures type-safe GraphQL operations using your schema.

By wrapping these tools with Chaingraph's schema, Chaingraph-ts delivers end-to-end type safety and an easy-to-use API, making it the ideal starting point for Chaingraph integrations.

The library is meant as an easy starting point, there's a straight path to moving to `Urql` with `gql-tada` directly when users want to do the setup and configuration.

To test GraphQL queries and explore the schema interactively, visit [try.chaingraph.cash](https://try.chaingraph.cash/). This tool provides an easy way to experiment with queries and understand Chaingraph's capabilities.

## Install

Install Chaingraph-ts from NPM with:

```bash
npm install @mr-zwets/chaingraph-ts
```

## Example Usage

Here’s an example of how to use Chaingraph-ts to fetch a raw transaction using the helperFunction:

```ts
import { ChaingraphClient } from "@mr-zwets/chaingraph-ts"

// 1. Define your Chaingraph GraphQL URL
const chaingraphUrl = "https://gql.chaingraph.pat.mn/v1/graphql"

// 2. Create a new Chaingraph client
const chaingraphClient = new ChaingraphClient(chaingraphUrl)

// 3. Query a raw transaction by its ID
const transactionId = "4db095f34d632a4daf942142c291f1f2abb5ba2e1ccac919d85bdc2f671fb251"
const rawTransaction = await chaingraphClient.getRawTransaction(transactionId)

// 4. Output the raw transaction hex
console.log(rawTransaction);
```

## Custom Query Example

This example demonstrates how to use a custom query with the `graphql` function.
The query fetches the AuthHead transaction hash of a token from the blockchain, which is useful for managing token metadata authority.

```ts
import { ChaingraphClient, graphql } from "@mr-zwets/chaingraph-ts"

// 1. Define your Chaingraph GraphQL URL
const chaingraphUrl = "https://gql.chaingraph.pat.mn/v1/graphql"

// 2. Create a new Chaingraph client
const chaingraphClient = new ChaingraphClient(chaingraphUrl)

// 3. Write your custom query with 'graphql()'
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

// 4. Create the query variables, we prefix with \\x for the 'bytea' type
const tokenId = "8473d94f604de351cdee3030f6c354d36b257861ad8e95bbc0a06fbab2a2f9cf";
const variables = {
  tokenId: `\\x${tokenId}`
}

// 5. Use your custom query through the 'chaingraphClient'
const resultQueryAuthHead = await chaingraphClient.query(queryReqAuthHead, variables)

// 6. Check and output the result
if (!resultQueryAuthHead.data) {
  throw new Error("No data returned from Chaingraph query");
}
const authHeadTxId = resultQueryAuthHead.data.transaction?.[0].authchains?.[0].authhead?.hash
console.log("Auth Head Transaction Hash:", authHeadTxId);
```

## Custom Subscription Example

```ts
import { ChaingraphClient, graphql } from "@mr-zwets/chaingraph-ts";

// 1. Define your Chaingraph GraphQL URL
const chaingraphUrl = "https://gql.chaingraph.pat.mn/v1/graphql";

// 2. Create a new Chaingraph client
const chaingraphClient = new ChaingraphClient(chaingraphUrl);

// 3. Define your subscription query using `graphql()`
const newBlockSubscription = graphql(`subscription MonitorNewBlocks {
  block(order_by: { height: desc }, limit: 1) {
    height
    timestamp
  }
}`);


// 4. Subscribe to new blocks
const newBlockUnsubscribe = chaingraphClient.subscribe(newBlockSubscription, {}).subscribe(async result => {
  if (result.data?.block?.[0]) {
    const { height, timestamp } = result.data.block[0];
    await handleNewBlock(Number(height), timestamp);
  } else if (result.error) {
    console.error("New block subscription error:", result.error);
  }
});

// 5. Handle new block events
async function handleNewBlock(newBlockHeight: number, timestamp: string) {
  if (newBlockHeight <= blockHeight) return; // Ignore duplicate or older blocks

  console.log(`Processing new block at height ${newBlockHeight}, timestamp: ${timestamp}`);
  blockHeight = newBlockHeight;

  // Add custom logic here (e.g., fetch transactions or notify users)
}

// 6. Unsubscribe when prgram is done (optional)
// newBlockUnsubscribe.unsubscribe();
```