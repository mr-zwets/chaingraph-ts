import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './generated/graphql-env.d.ts';

// Not technically an interface, but an export for using chaingraph GraphQL queries in a type-safe way 
// initGraphQLTada allows to provide types for custom scalars
export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    _text: string
    bigint: string
    bytea: string
    enum_nonfungible_token_capability: "none" | "mutable" | "minting"
    timestamp: string
  };
}>();