# Chaingraph-ts

Chaingraph-ts is a TypeScript library that simplifies using [Chaingraph](https://chaingraph.cash/) by providing type-safe GraphQL interactions and helper functions.

## Features

Type-Safe Interactions: Fully typed `graphql` function through `gql-tada` for custom GraphQL operations.

Prebuilt Helper Functions: Includes ready-to-use functions for common tasks, such as:
- `getRawTransaction`: Retrieve raw transaction hex by transaction ID.
- `sendRawTransaction`: Broadcast a raw transaction to the network.
- `getUtxosForAddress`: Fetch UTXOs for a given address.
- `getBlockHeight`: Read the tip height of the indexed node.

Correct by Default: UTXO queries use Chaingraph's indexed `search_output`, exclude replaced and orphaned transactions, and are scoped to a single indexed node, so results do not mix networks. See [docs/querying-chaingraph.md](./docs/querying-chaingraph.md).

No Setup Required: Start quickly without the need to configure the generated types and the graphQl client configuartion manually.

## Details

Chaingraph-ts is built on top of:

- [Urql](https://commerce.nearform.com/open-source/urql/docs/): A lightweight GraphQL client for handling queries and subscriptions.
- [gql-tada](https://gql-tada.0no.co/): Ensures type-safe GraphQL operations using your schema.

By wrapping these tools with Chaingraph's schema, Chaingraph-ts delivers end-to-end type safety and an easy-to-use API, making it the ideal starting point for Chaingraph integrations.

The library is meant as an easy starting point, there's a straight path to moving to `Urql` with `gql-tada` directly when users want to do the setup and configuration.

To test GraphQL queries and explore the schema interactively, visit [try.chaingraph.cash](https://try.chaingraph.cash/). This tool provides an easy way to experiment with queries and understand Chaingraph's capabilities.

## Documentation

- [Querying Chaingraph](./docs/querying-chaingraph.md): the `bytea` hex convention, scoping queries to a node, double spends, `search_output`, and pagination.
- [When to use Chaingraph](./docs/when-to-use-chaingraph.md): which questions need an indexer and which an Electrum server already answers.
- [Migrating to v0.3.0](./docs/migration-v0.3.0.md): breaking changes in this release.

## Install

Install Chaingraph-ts from NPM with:

```bash
pnpm install chaingraph-ts
```

## Example Usage

Here’s an example of how to use Chaingraph-ts to fetch a raw transaction using the helperFunction:

```ts
import { ChaingraphClient } from "chaingraph-ts"

// 1. Define your Chaingraph GraphQL URL
const chaingraphUrl = "https://gql.chaingraph.pat.mn/v1/graphql"

// 2. Create a new Chaingraph client
const chaingraphClient = new ChaingraphClient(chaingraphUrl)

// 3. Query a raw transaction by its ID
const transactionId = "4db095f34d632a4daf942142c291f1f2abb5ba2e1ccac919d85bdc2f671fb251"
const rawTransaction = await chaingraphClient.getRawTransaction(transactionId)

// 4. Output the raw transaction hex, or undefined if the instance has never seen it
console.log(rawTransaction);
```

## Client Options

```ts
const chaingraphClient = new ChaingraphClient(chaingraphUrl, {
  network: "mainnet",       // required on instances indexing several networks
  nodeName: "graph-mainnet",// alternative to network, when names do not contain it
  filterReplaced: true,     // exclude replaced and orphaned transactions, the default
  headers: { authorization: "..." },
  timeoutMs: 20_000,        // urql has no timeout of its own
  retry: false,             // network errors are retried twice by default
})
```

Instances that index several networks throw `ChaingraphNodeResolutionError` until `network` or
`nodeName` picks one, so results are never a silent mix of chains.

## Custom Query Example

This example demonstrates how to use a custom query with the `graphql` function.
The query fetches the AuthHead transaction hash of a token from the blockchain, which is useful for managing token metadata authority.

```ts
import { ChaingraphClient, graphql, hexToBytea, byteaToHex } from "chaingraph-ts"

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

// 4. Create the query variables, hexToBytea adds the prefix the 'bytea' type needs
const tokenId = "8473d94f604de351cdee3030f6c354d36b257861ad8e95bbc0a06fbab2a2f9cf";
const variables = {
  tokenId: hexToBytea(tokenId)
}

// 5. Use your custom query through the 'chaingraphClient'
const resultQueryAuthHead = await chaingraphClient.query(queryReqAuthHead, variables)

// 6. Check and output the result
if (!resultQueryAuthHead.data) {
  throw new Error("No data returned from Chaingraph query");
}
const authHeadTxId = resultQueryAuthHead.data.transaction?.[0].authchains?.[0].authhead?.hash
// results carry the '\x' prefix, byteaToHex strips it again
console.log("Auth Head Transaction Hash:", byteaToHex(authHeadTxId));
```

## Custom Subscription Example

```ts
import { ChaingraphClient, graphql } from "chaingraph-ts";

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
const newBlockSubscription$ = chaingraphClient.subscribeWithCallback(
  newBlockSubscription,
  {},
  async data => {
    const { height, timestamp } = data.block[0];
    await handleNewBlock(Number(height), timestamp);
  },
  error => console.error("New block subscription error:", error)
);

// 5. Handle new block events
let blockHeight = 0
async function handleNewBlock(newBlockHeight: number, timestamp: string) {
  if (newBlockHeight <= blockHeight) return; // Ignore duplicate or older blocks

  console.log(`Processing new block at height ${newBlockHeight}, timestamp: ${timestamp}`);
  blockHeight = newBlockHeight;

  // Add custom logic here (e.g., fetch transactions or notify users)
}

// 6. Unsubscribe and close the websocket when the program is done
// newBlockSubscription$.unsubscribe();
// await chaingraphClient.close();
```

`subscribeWithCallback` sends subscription errors and anything the callback throws to the error
handler. `subscribe` still returns the urql result source if you would rather handle the stream
yourself.

## Build the library

To build the library locally, use:

```bash
pnpm run build
```

## Run the tests

```bash
pnpm run test:unit         # offline
pnpm run test:integration  # hits live Chaingraph instances
pnpm run check             # typecheck and lint
```