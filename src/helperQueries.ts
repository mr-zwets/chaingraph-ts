import type { chaingraphClient } from "./chaingraphClient.js";
import { graphql } from "./graphql.js";
import { binToHex, cashAddressToLockingBytecode } from "@bitauth/libauth";

export async function getUtxosForAddress(
  this: chaingraphClient,
  address: string
) {
  const resultDecodeCashAddress = cashAddressToLockingBytecode(address)
  if(typeof resultDecodeCashAddress === 'string'){
    throw new Error(resultDecodeCashAddress)
  }
  
  return await getUtxosForLockingBytecode.call(this, binToHex(resultDecodeCashAddress.bytecode))
}

export async function getUtxosForLockingBytecode(
  this: chaingraphClient,
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
  return (await this.client.query(query, variables)).data
}
