import { graphql } from './graphql.js';

// Node names are instance-specific, so queries take the name as a variable.
// 'internal_id' is what send_transaction broadcasts through.
export const queryChaingraphNodes = graphql(`query ChaingraphNodes {
  node {
    name
    internal_id
  }
}`);

// Spendable outputs according to one node: both the output's own transaction and any spender
// must be validated or mined by that node, so replaced and orphaned transactions drop out.
// See docs/querying-chaingraph.md for why this uses search_output and names the node.
export const queryUtxosFilteredByNode = graphql(`query UtxosFilteredByNode(
  $lockingBytecodeHexes: _text
  $node: String!
  $limit: Int
  $offset: Int
) {
  search_output(
    args: { locking_bytecode_hex: $lockingBytecodeHexes }
    where: {
      transaction: { _or: [
        { node_validations: { node: { name: { _eq: $node } } } }
        { block_inclusions: { block: { accepted_by: { node: { name: { _eq: $node } } } } } }
      ] }
      _not: { spent_by: { transaction: { _or: [
        { node_validations: { node: { name: { _eq: $node } } } }
        { block_inclusions: { block: { accepted_by: { node: { name: { _eq: $node } } } } } }
      ] } } }
    }
    order_by: [{ transaction_hash: asc }, { output_index: asc }]
    limit: $limit
    offset: $offset
  ) {
    transaction_hash
    output_index
    value_satoshis
    locking_bytecode
    token_category
    fungible_token_amount
    nonfungible_token_commitment
    nonfungible_token_capability
  }
}`);

// Fallback for instances where no node can be resolved: keeps pre-v0.3.0 semantics.
export const queryUtxosUnfiltered = graphql(`query UtxosUnfiltered(
  $lockingBytecodeHexes: _text
  $limit: Int
  $offset: Int
) {
  search_output(
    args: { locking_bytecode_hex: $lockingBytecodeHexes }
    where: { _not: { spent_by: {} } }
    order_by: [{ transaction_hash: asc }, { output_index: asc }]
    limit: $limit
    offset: $offset
  ) {
    transaction_hash
    output_index
    value_satoshis
    locking_bytecode
    token_category
    fungible_token_amount
    nonfungible_token_commitment
    nonfungible_token_capability
  }
}`);

export const queryRawTransaction = graphql(`query RawTransaction($txHash: bytea!) {
  transaction(where: { hash: { _eq: $txHash } }, limit: 1) {
    encoded_hex
  }
}`);

// Scoped to one node so a multi-network instance does not report another chain's tip.
export const queryLatestBlockForNode = graphql(`query LatestBlockForNode($node: String!) {
  block(
    where: { accepted_by: { node: { name: { _eq: $node } } } }
    order_by: { height: desc }
    limit: 1
  ) {
    hash
    height
    timestamp
  }
}`);

export const queryLatestBlock = graphql(`query LatestBlock {
  block(order_by: { height: desc }, limit: 1) {
    hash
    height
    timestamp
  }
}`);

export const mutationSendRawTransaction = graphql(`mutation SendRawTransaction(
  $rawTransactionHex: String!
  $nodeInternalId: Int!
) {
  send_transaction(
    request: { node_internal_id: $nodeInternalId, encoded_hex: $rawTransactionHex }
  ) {
    transaction_hash
    validation_error_message
    validation_success
    transmission_error_message
    transmission_success
  }
}`);
