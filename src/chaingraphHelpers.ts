import type { ChaingraphClient } from "./ChaingraphClient.js";
import { binToHex, cashAddressToLockingBytecode } from "@bitauth/libauth";
import { byteaToHex, hexesToTextArray, hexToBytea } from "./bytea.js";
import {
  mutationSendRawTransaction,
  queryLatestBlock,
  queryLatestBlockForNode,
  queryRawTransaction,
  queryUtxosFilteredByNode,
  queryUtxosUnfiltered
} from "./queries.js";
import { runMutation, runQuery } from "./runQuery.js";

export interface UtxoQueryOptions {
  /** Overrides the client's filterReplaced setting for this call. */
  filterReplaced?: boolean;
}

export interface ChaingraphUtxo {
  transaction_hash: string;
  output_index: string;
  value_satoshis: string;
  locking_bytecode: string;
  token_category: string | null;
  fungible_token_amount: string | null;
  nonfungible_token_commitment: string | null;
  nonfungible_token_capability: 'none' | 'mutable' | 'minting' | null;
}

function byteaToHexOrNull(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  return byteaToHex(value);
}

// Resolves the node to filter by, or undefined when filtering is off or unavailable.
async function nodeToFilterBy(
  client: ChaingraphClient,
  options?: UtxoQueryOptions
) {
  const filterReplaced = options?.filterReplaced ?? client.options.filterReplaced ?? true;
  if (!filterReplaced) return undefined;

  const node = await client.resolveNode();
  if (!node) {
    console.warn(
      'chaingraph-ts: instance exposes no nodes, querying without filtering out replaced ' +
      'and orphaned transactions'
    );
  }
  return node?.name;
}

export async function getUtxosForAddress(
  this: ChaingraphClient,
  address: string,
  options?: UtxoQueryOptions
) {
  const resultDecodeCashAddress = cashAddressToLockingBytecode(address)
  if(typeof resultDecodeCashAddress === 'string'){
    throw new Error(resultDecodeCashAddress)
  }

  return await getUtxosForLockingBytecode.call(
    this, binToHex(resultDecodeCashAddress.bytecode), options
  )
}

export async function getUtxosForLockingBytecode(
  this: ChaingraphClient,
  addressLockingBytecode: string,
  options?: UtxoQueryOptions
) {
  const lockingBytecodeHexes = hexesToTextArray([addressLockingBytecode])
  const node = await nodeToFilterBy(this, options)

  let outputs: ChaingraphUtxo[]
  if (node) {
    const variables = { lockingBytecodeHexes, node, limit: null, offset: null }
    outputs = (await runQuery(this.client, queryUtxosFilteredByNode, variables)).search_output
  } else {
    const variables = { lockingBytecodeHexes, limit: null, offset: null }
    outputs = (await runQuery(this.client, queryUtxosUnfiltered, variables)).search_output
  }

  return outputs.map(output => ({
    ...output,
    transaction_hash: byteaToHex(output.transaction_hash),
    locking_bytecode: byteaToHex(output.locking_bytecode),
    token_category: byteaToHexOrNull(output.token_category),
    nonfungible_token_commitment: byteaToHexOrNull(output.nonfungible_token_commitment)
  }))
}

export async function sendRawTransaction(
  this: ChaingraphClient,
  rawTransactionHex: string
) {
  const node = await this.resolveNode()
  const returnData = await runMutation(this.client, mutationSendRawTransaction, {
    rawTransactionHex,
    // Instances index node 1 unless they serve several networks, where the node decides which.
    nodeInternalId: node?.internalId ?? 1
  })
  const { send_transaction } = returnData
  return {
    ...returnData,
    send_transaction: {
      ...send_transaction,
      transaction_hash: byteaToHexOrNull(send_transaction.transaction_hash)
    }
  }
}

// Returns undefined when the instance has never seen the transaction.
export async function getRawTransaction(
  this: ChaingraphClient,
  txId: string
) {
  const { transaction } = await runQuery(this.client, queryRawTransaction, {
    txHash: hexToBytea(txId)
  })
  return transaction[0]?.encoded_hex ?? undefined
}

export async function getLatestBlockheight(
  this: ChaingraphClient
) {
  const node = await this.resolveNode()

  let blocks
  if (node) {
    blocks = (await runQuery(this.client, queryLatestBlockForNode, { node: node.name })).block
  } else {
    blocks = (await runQuery(this.client, queryLatestBlock, {})).block
  }

  const block = blocks[0]
  if (!block) return undefined
  return { ...block, hash: byteaToHex(block.hash) }
}
