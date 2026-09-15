# Migrating to v0.3.0

v0.3.0 fixes the helper queries, which changes what they return and when they throw.

## Results come back as plain hex

Helpers used to hand back the `\x`-prefixed values Hasura returns. They now strip the prefix, so
a `.slice(2)` in your code should be removed.

```ts
// before
const txid = utxo.transaction_hash.slice(2)
// after
const txid = utxo.transaction_hash
```

`hexToBytea` and `byteaToHex` are exported for the queries you write yourself, which are
unaffected.

## Empty results return undefined instead of throwing

`getRawTransaction` threw `TypeError: Cannot destructure property 'encoded_hex'` for a
transaction the instance had never seen. It now returns `string | undefined`, and
`getBlockHeight` returns `number | undefined`.

## Failures throw ChaingraphQueryError

Urql reports failures on the result object, which the helpers used to read past, so a network
error surfaced as a generic `Error` naming the wrong operation, with the cause discarded.
Failures now throw `ChaingraphQueryError`, whose `cause` is the urql `CombinedError`, so
`networkError` and `graphQLErrors` are available.

## UTXO queries are filtered and scoped to one node

`getUtxosForAddress` and `getUtxosForLockingBytecode` now exclude replaced and orphaned
transactions, exclude OP_RETURN outputs, and are scoped to a single indexed node. Expect fewer
rows than v0.2.x returned on an address touched by a double spend, and more where a spender had
been replaced.

Instances that index several networks now need one to be picked, otherwise the first query
throws `ChaingraphNodeResolutionError`:

```ts
const client = new ChaingraphClient("https://demo.chaingraph.cash/v1/graphql", {
  network: "mainnet"
})
```

Single-node instances need no configuration. `filterReplaced: false` restores the old
unfiltered behaviour, per client or per call.

## Other changes

- Network errors are retried twice by default; pass `retry: false` to send every operation once.
- `close()` disposes the websocket, so a script that subscribed can exit.
- `subscribeWithCallback` routes subscription and callback errors to an `onError` handler.
  `subscribe` is unchanged.
- `graphql` is a peer dependency now, satisfied by graphql 16 or 17. Package managers install
  peers automatically; if yours does not, add `graphql` to your dependencies.
