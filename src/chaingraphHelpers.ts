import type { ChaingraphClient } from "./ChaingraphClient.js";
import { graphql } from "./graphql.js";
import { binToHex, cashAddressToLockingBytecode } from "@bitauth/libauth";

export async function getUtxosForAddress(
  this: ChaingraphClient,
  address: string
) {
  const resultDecodeCashAddress = cashAddressToLockingBytecode(address)
  if(typeof resultDecodeCashAddress === 'string'){
    throw new Error(resultDecodeCashAddress)
  }
  
  return await getUtxosForLockingBytecode.call(this, binToHex(resultDecodeCashAddress.bytecode))
}

export async function getUtxosForLockingBytecode(
  this: ChaingraphClient,
  addressLockingBytecode: string
) {
  const query = graphql(`query utxosForLockingBytecode (
    $adressLockingBytecode: bytea
  ) {
    output(
      where: {
        locking_bytecode: { _eq: $adressLockingBytecode }
        _not: { spent_by: {} }
      }
    ) {
      transaction_hash
      output_index
      value_satoshis
      token_category
      fungible_token_amount
      nonfungible_token_commitment
    }
  }`);
  const variables = {
    adressLockingBytecode: `\\x${addressLockingBytecode}`
  }
  const queryResult = (await this.client.query(query, variables)).data
  if (!queryResult) throw new Error('Error in ChainGraph query GetTransactionHex');
  return queryResult.output
}

export async function sendRawTransaction(
  this: ChaingraphClient,
  rawTransactionHex: string
) {
  const sendTransaction = graphql(`mutation sendRawTransaction(
    $rawTransactionHex: String!
  ) {
    send_transaction(
      request: {
        node_internal_id: 1
        encoded_hex: $rawTransactionHex
      }
    ) {
      transaction_hash
      validation_error_message
      validation_success
      transmission_error_message
      transmission_success
    }
  }`);
  const variables = {
    rawTransactionHex
  }
  const returnData = (await this.client.query(sendTransaction, variables)).data
  if (!returnData) throw new Error('Error in ChainGraph query sendRawTransaction');
  return returnData
}

export async function getRawTransaction(
  this: ChaingraphClient,
  txId: string
) {
  const query = graphql(`query rawTranswaction(
    $txId: bytea!
  ) {
    transaction(
      where:{
        hash: { _eq: $txId }
      }
    ) {
      encoded_hex
    }
  }`);
  const variables = {
    txId: `\\x${txId}`
  }
  const queryResult = (await this.client.query(query, variables)).data
  if (!queryResult) throw new Error('Error in ChainGraph query GetTransactionHex');
  return queryResult.transaction[0]
}

export async function getLatestBlockheight(
  this: ChaingraphClient
) {
  const query = graphql(`query blockWithHighestHeight {
    block(
      order_by: { height: desc },
      limit: 1
    ) {
      hash
      height
      timestamp
      encoded_hex
    }
  }`);
  const queryResult = (await this.client.query(query, {})).data
  if (!queryResult) throw new Error('Error in ChainGraph query GetTransactionHex');
  return queryResult.block[0]
}