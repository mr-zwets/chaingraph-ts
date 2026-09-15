# When you need Chaingraph

Chaingraph is not the only way to read the chain, and it is the more expensive one to depend on:
it is hard to self-host and there is no public instance with an uptime guarantee. Electrum
servers (Fulcrum) are cheap and plentiful. Knowing which questions actually require Chaingraph
keeps that dependency where it earns its place.

## What each one indexes

**Electrum / Fulcrum** indexes by address: the UTXOs and transaction history of a scripthash.
It cannot filter by token category, transaction shape or block range, and it has no notion of
"which transaction spent this output" beyond walking history.

**Chaingraph** indexes the whole transaction graph: inputs, outputs, `spent_by`, token
categories, NFT commitments and capabilities, block heights, authchains, and which node
validated or accepted what. It answers historical and aggregate questions in one filtered query.

## The questions that need Chaingraph

- **Token-indexed lookups.** Every holder of a token category, the current owner of a specific
  NFT, all minting UTXOs of a category. Fulcrum is keyed by address, so unless you already know
  every holder's address there is no path to the answer. This is a hard wall, not a slow path.
- **Authchain and metadata resolution.** Walking an authchain to its authhead is a graph query.
- **Protocol-wide history.** Everything that ever happened to a contract, all transactions of a
  given shape, activity over a block range. Fulcrum can only hand you a per-address transaction
  list to filter client-side, which does not scale past a handful of addresses.
- **Live filtered subscriptions.** Chaingraph subscriptions push the rows matching a `where`
  clause; Electrum notifies you that an address changed.

## The questions that do not

Anything anchored on a user's own addresses (their balance, their UTXOs, their token holdings,
their transaction history) is exactly what Fulcrum indexes, and is served faster and more
cheaply there. A wallet that reaches for Chaingraph to list the connected user's UTXOs has taken
on an infrastructure dependency for data an Electrum server already has.

The rule of thumb: a user-facing wallet runs on Electrum, a token explorer or protocol dashboard
needs Chaingraph, and an app that is both should be honest about which half is which.
