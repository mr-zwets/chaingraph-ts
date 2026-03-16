# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
pnpm run build        # Clean build: removes dist/, compiles TS, copies generated types
pnpm test             # Run all tests with vitest (hits live Chaingraph server)
pnpm test -- --run    # Run tests once without watch mode
pnpm tsc --noEmit     # Type-check without emitting
```

## Architecture

Chaingraph-ts is a TypeScript library wrapping [Urql](https://nearform.com/open-source/urql/) and [gql.tada](https://gql-tada.0no.co/) to provide type-safe GraphQL interactions with [Chaingraph](https://chaingraph.cash/) (a Bitcoin Cash indexer).

**Public API** (exported from `src/index.ts`):
- `ChaingraphClient` — main class wrapping Urql's Client with `query()`, `subscribe()`, and helper methods
- `graphql` — gql.tada tagged template function for compile-time type-safe GraphQL operations

**Key files:**
- `src/ChaingraphClient.ts` — Client class. Initializes Urql with fetchExchange + subscriptionExchange (via graphql-ws). Cache is disabled (`requestPolicy: "network-only"`). Uses native WebSocket (requires Node.js >=22).
- `src/chaingraphHelpers.ts` — Standalone functions bound to ChaingraphClient via `this` context (`getRawTransaction`, `sendRawTransaction`, `getUtxosForAddress`, `getUtxosForLockingBytecode`, `getLatestBlockheight`). Exposed as class methods on ChaingraphClient.
- `src/graphql.ts` — gql.tada setup with Chaingraph schema introspection and custom scalar mappings (bytea→string, bigint→string, etc.)
- `src/generated/graphql-env.d.ts` — Auto-generated introspection types from the Chaingraph schema. Copied to `dist/generated/` during build.

**Conventions:**
- All hex values for GraphQL `bytea` type must be prefixed with `\\x` (e.g., `` `\\x${txid}` ``)
- Tests hit a live Chaingraph endpoint — failures may be network-related, not code bugs
- ES modules throughout (`"type": "module"`, `.js` extensions in imports)
