# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
pnpm run build             # Clean build: removes dist/, compiles TS, copies generated types
pnpm run check             # Type-check src and test, then lint
pnpm run test:unit         # Offline tests
pnpm run test:integration  # Tests that hit live Chaingraph instances
```

## Architecture

Chaingraph-ts wraps [Urql](https://nearform.com/open-source/urql/) and [gql.tada](https://gql-tada.0no.co/) to provide type-safe GraphQL interactions with [Chaingraph](https://chaingraph.cash/) (a Bitcoin Cash indexer).

- `src/ChaingraphClient.ts` — the client: Urql setup, options, and resolving which indexed node queries are scoped to.
- `src/chaingraphHelpers.ts` — helper functions bound to ChaingraphClient via `this`, exposed as its methods.
- `src/queries.ts` — the gql.tada documents the helpers use. gql.tada needs each `where` inlined, so the node-filtered and unfiltered variants are separate documents.
- `src/graphql.ts` + `src/generated/graphql-env.d.ts` — gql.tada setup and the generated schema types, copied to `dist/` during build.

## Conventions

- `bytea` values carry a `\\x` prefix in both directions; use `hexToBytea` / `byteaToHex`. Helper methods take and return plain hex.
- Queries are scoped to one indexed node, because node names are instance-specific and an unscoped query on a multi-network instance mixes chains. See `docs/querying-chaingraph.md`.
- ES modules throughout (`"type": "module"`, `.js` extensions in imports).
- Prefer inferred return types, short comments, and no multi-line ternaries.
