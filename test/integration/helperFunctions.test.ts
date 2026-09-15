import { describe, expect, it } from 'vitest'
import { lockingBytecodeToCashAddress, hexToBin } from '@bitauth/libauth'
import { ChaingraphClient } from '../../src/index.js'

const chaingraphUrl = "https://gql.chaingraph.pat.mn/v1/graphql"
const chaingraphClient = new ChaingraphClient(chaingraphUrl)

// A mainnet P2PKH address holding a mix of plain and token UTXOs.
const lockingBytecode = "76a9143fe055ae1ea27a26fa9eb52beeea22b50b68628a88ac"

describe('test the ChaingraphClient helperFunctions', () => {
  it('should test the getUtxosForLockingBytecode function', async () => {
    const utxos = await chaingraphClient.getUtxosForLockingBytecode(lockingBytecode)

    expect(utxos.length).toBeGreaterThan(0)
    const utxo = utxos[0]
    // results are returned as plain hex, without the bytea '\x' prefix
    expect(utxo.transaction_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(utxo.locking_bytecode).toEqual(lockingBytecode)
    expect(Number(utxo.value_satoshis)).toBeGreaterThan(0)
  }, 30000)

  it('should test the getUtxosForAddress function', async () => {
    const decoded = lockingBytecodeToCashAddress({ bytecode: hexToBin(lockingBytecode) })
    if (typeof decoded === 'string') throw new Error(decoded)

    const utxos = await chaingraphClient.getUtxosForAddress(decoded.address)
    const utxosForBytecode = await chaingraphClient.getUtxosForLockingBytecode(lockingBytecode)

    expect(utxos).toEqual(utxosForBytecode)
  }, 30000)

  it('should return the same or more utxos without the replaced-transaction filter', async () => {
    const filtered = await chaingraphClient.getUtxosForLockingBytecode(lockingBytecode)
    const unfiltered = await chaingraphClient.getUtxosForLockingBytecode(
      lockingBytecode, { filterReplaced: false }
    )

    expect(unfiltered.length).toBeGreaterThanOrEqual(filtered.length)
  }, 30000)

  it('should test the getRawTransaction function', async () => {
    const txid = "4db095f34d632a4daf942142c291f1f2abb5ba2e1ccac919d85bdc2f671fb251"
    const rawTransaction = await chaingraphClient.getRawTransaction(txid)

    expect(rawTransaction).toMatch(/^[0-9a-f]+$/)
  }, 30000)

  it('should return undefined for an unknown transaction', async () => {
    const rawTransaction = await chaingraphClient.getRawTransaction("00".repeat(32))

    expect(rawTransaction).toBeUndefined()
  }, 30000)

  it('should test the getBlockHeight function', async () => {
    const blockHeight = await chaingraphClient.getBlockHeight()

    expect(blockHeight).toBeGreaterThan(900_000)
  }, 30000)
})
