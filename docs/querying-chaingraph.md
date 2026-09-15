# Querying Chaingraph

Things that are easy to get wrong when writing your own Chaingraph queries, and what
chaingraph-ts does about them in its own helpers.

## Hex values are `bytea`

Chaingraph stores binary data in Postgres `bytea` columns, which Hasura takes and returns in
its hex-escape format: a `\x` prefix followed by the hex.

```ts
import { hexToBytea, byteaToHex } from "chaingraph-ts"

const variables = { tokenId: hexToBytea(tokenId) }   // '\x8473d9…'
const txid = byteaToHex(result.transaction[0].hash)  // '8473d9…'
```

The library's helpers take and return plain hex; only raw queries you write yourself need the
conversion.

## Scope queries to one node

A Chaingraph instance indexes one or more nodes, and its `node` table names them. Node names
are instance-specific:

| instance | nodes |
|---|---|
| `gql.chaingraph.pat.mn` | `graph-mainnet` |
| `demo.chaingraph.cash` | `bchn-chipnet`, `bchn-testnet`, `bchn-mainnet` |

A query that does not name a node returns rows from every network the instance indexes, so on a
multi-network instance a "latest block" or "utxos for this address" answer silently mixes
chains. A hardcoded name is no better: `bchn-mainnet` matches nothing on an instance that calls
its node `graph-mainnet`, and returns an empty result rather than an error.

`ChaingraphClient` resolves the node once per client and caches it:

```ts
// single-node instance: nothing to configure
const client = new ChaingraphClient("https://gql.chaingraph.pat.mn/v1/graphql")

// multi-network instance: say which network you mean
const client = new ChaingraphClient("https://demo.chaingraph.cash/v1/graphql", {
  network: "chipnet"
})

// or name the node exactly
const client = new ChaingraphClient(url, { nodeName: "graph-mainnet" })
```

Anything ambiguous throws `ChaingraphNodeResolutionError` listing the instance's nodes, rather
than guessing. `client.resolveNode()` returns the resolved node if you need it in your own
queries.

## Chaingraph serves double spends

Chaingraph stores replaced ("double-spent") and orphaned transactions and serves them like any
other. Two things follow for a UTXO query:

- outputs of a replaced transaction look spendable unless you exclude them;
- an output whose only spender was itself replaced or orphaned looks spent, because
  `_not: { spent_by: {} }` treats any spender as final.

The fix for both is to require that the transaction, and any spender, was either validated by
the node or mined into a block that node accepted:

```graphql
transaction: { _or: [
  { node_validations: { node: { name: { _eq: $node } } } }
  { block_inclusions: { block: { accepted_by: { node: { name: { _eq: $node } } } } } }
] }
_not: { spent_by: { transaction: { _or: [
  { node_validations: { node: { name: { _eq: $node } } } }
  { block_inclusions: { block: { accepted_by: { node: { name: { _eq: $node } } } } } }
] } } }
```

Name the node. The existence-only form, `{ node_validations: {} }`, answers the same question
but is far more expensive: measured against a public instance, 30–38s versus ~200ms for the
same 131 rows.

The helpers apply this filter by default. `filterReplaced: false`, per client or per call, opts
out for instances where no node can be resolved.

## Use `search_output` for locking bytecodes

`output(where: { locking_bytecode: { _eq: $lockingBytecode } })` has no usable index. Measured
with a 1000-row limit it timed out after 45s on one instance and 60s on another. Chaingraph
exposes `search_output` for this, which answers the same query in 100–250ms:

```graphql
search_output(args: { locking_bytecode_hex: $lockingBytecodeHexes }) { … }
```

Its argument is a Postgres text array of plain hex without the `\x` prefix, so
`{76a914…88ac,76a914…88ac}`. Several locking bytecodes can be looked up in one call.

It matches the locking bytecode exactly. The 25-byte prefix index only accelerates the lookup,
so a bytecode that merely shares a prefix is not returned.

Two things follow from how the function is written. It is plpgsql with its own `ORDER BY`, so it
materialises and sorts every match before a `where`, `limit` or `order_by` of yours is applied:
paging bounds the payload, not the work the instance does. And a query that goes on to check the
output's transaction (the replaced-transaction filter above does) costs considerably more than
an output-level question such as a balance, because the transaction is then visited per
candidate row.

## Row counts are clamped

Instances cap how many rows a select returns and drop the rest without reporting it, so an
unbounded query truncates silently. The caps are per instance and per role; one production
instance uses 5,000 on `output`, 1,000 on `input` and 10,000 on `transaction`. Page through with
`limit` and `offset`, and keep the page size at or below the smallest cap you may hit: a clamped
page looks like a final short page and stops paging early.

```ts
import { paginate } from "chaingraph-ts"

const rows = await paginate(
  (limit, offset) => fetchPage(limit, offset),
  row => `${row.transaction_hash}:${row.output_index}`
)
```

Offset paging needs the query to order deterministically (`order_by`), and rows can shift
between pages as new ones land, which is what the key argument deduplicates.

## Subscriptions re-run their query

Hasura live queries poll: for each distinct document and variable pair it re-runs the SQL on a
refetch interval (1s by default), diffs the result and pushes the changes. A subscription is
therefore as expensive as its query, repeated for as long as anyone is subscribed, and a heavy
document is re-executed and re-serialised every tick even when nothing changed. One production
instance measured a 27 MB subscription payload costing 3s per tick.

Subscribe to a change signal rather than to state: a `limit: 1` document ordered by the newest
row is enough to learn that something happened, and the state itself can then be fetched once
with a query. Subscribers sharing a document and variables share one execution, so reusing the
same subscription across a page costs no more than one.

## Avoid `locking_bytecode_pattern` in a `where`

The column is computed by a plpgsql function per candidate row, so filtering on it (to exclude
OP_RETURN outputs, say) costs a function call for every row the rest of the query produces. It
is fine to select, and worth avoiding in a `where` on anything protocol-wide. An exact-bytecode
lookup does not need it at all: `search_output` already matched the script you asked for.

## Exploring the schema

[try.chaingraph.cash](https://try.chaingraph.cash/) runs queries against a live instance and
browses the schema interactively, which is the fastest way to work out a `where` clause before
moving it into `graphql()`.
