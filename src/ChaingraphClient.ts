import {
  Client,
  cacheExchange,
  fetchExchange,
  subscriptionExchange,
  type AnyVariables,
  type DocumentInput,
  type OperationContext,
  type OperationResult,
  type OperationResultSource
} from '@urql/core';
import { createClient as createWSClient } from 'graphql-ws';
import {
  getLatestBlockheight,
  getRawTransaction,
  getUtxosForAddress,
  getUtxosForLockingBytecode,
  sendRawTransaction
} from './chaingraphHelpers.js';
import { ChaingraphNodeResolutionError } from './errors.js';
import { queryChaingraphNodes } from './queries.js';
import { runQuery } from './runQuery.js';

export type ChaingraphNetwork = 'mainnet' | 'chipnet' | 'testnet' | 'regtest';

export interface ChaingraphNode {
  name: string;
  /** Used by send_transaction to pick which node broadcasts. */
  internalId?: number;
}

export interface ChaingraphClientOptions {
  /** Picks the indexed node by name, on instances that index more than one network. */
  network?: ChaingraphNetwork;
  /** Exact node name, for instances whose names do not contain the network. */
  nodeName?: string;
  /** Filter out replaced and orphaned transactions. Defaults to true. */
  filterReplaced?: boolean;
}

export class ChaingraphClient {
  client: Client;
  options: ChaingraphClientOptions;

  private resolvedNode?: Promise<ChaingraphNode | undefined>;

  constructor(
    chaingraphUrl: string,
    options: ChaingraphClientOptions = {}
  ) {
    this.options = options;
    const wsClient = createWSClient({ url: chaingraphUrl });

    // create Urql client with subscriptionExchange
    this.client = new Client({
      url: chaingraphUrl,
      exchanges: [
        cacheExchange,
        fetchExchange,
        subscriptionExchange({
          forwardSubscription(request) {
            const input = { ...request, query: request.query || '' };
            return {
              subscribe(sink) {
                const unsubscribe = wsClient.subscribe(input, sink);
                return { unsubscribe };
              },
            };
          },
        }),
      ],
      // disable urql cache
      requestPolicy: "network-only",
      // Force POST for all operations, as Hasura uses POST endpoints
      preferGetMethod: false
    });
  }

  // Expose the query method as a class method
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<Data = any, Variables extends AnyVariables = AnyVariables>(
    query: DocumentInput<Data, Variables>,
    variables: Variables,
    context?: Partial<OperationContext>
  ): OperationResultSource<OperationResult<Data, Variables>> {
    return this.client.query(query, variables, context);
  }

  // Expose the subscribe method as a class method
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscribe<Data = any, Variables extends AnyVariables = AnyVariables>(
    query: DocumentInput<Data, Variables>,
    variables: Variables,
    context?: Partial<OperationContext>
  ): OperationResultSource<OperationResult<Data, Variables>> {
    return this.client.subscription(query, variables, context);
  }

  /**
   * The node queries are scoped to, looked up once and then cached.
   *
   * Returns undefined when the instance does not expose its nodes, so callers can fall back to
   * unfiltered queries. Throws when the instance indexes several networks and none was picked.
   */
  async resolveNode(): Promise<ChaingraphNode | undefined> {
    this.resolvedNode ??= this.lookUpNode();
    return await this.resolvedNode;
  }

  private async lookUpNode(): Promise<ChaingraphNode | undefined> {
    const { network, nodeName } = this.options;

    let nodes: { name: string; internal_id: number }[];
    try {
      nodes = (await runQuery(this.client, queryChaingraphNodes, {})).node;
    } catch {
      // The instance does not expose its nodes; callers fall back to unfiltered queries.
      return nodeName ? { name: nodeName } : undefined;
    }
    const names = nodes.map(node => node.name);
    const toNode = (name: string): ChaingraphNode => ({
      name,
      internalId: nodes.find(node => node.name === name)?.internal_id
    });

    if (nodeName) {
      if (!names.includes(nodeName)) {
        throw new ChaingraphNodeResolutionError(
          `Chaingraph instance has no node named '${nodeName}', it indexes: ${names.join(', ')}`,
          names
        );
      }
      return toNode(nodeName);
    }

    if (network) {
      const matches = names.filter(name => name.includes(network));
      if (matches.length === 1) return toNode(matches[0]);
      if (matches.length === 0) {
        throw new ChaingraphNodeResolutionError(
          `Chaingraph instance indexes no '${network}' node, it indexes: ${names.join(', ')}`,
          names
        );
      }
      throw new ChaingraphNodeResolutionError(
        `Several nodes match network '${network}' (${matches.join(', ')}), pass 'nodeName' instead`,
        names
      );
    }

    if (names.length === 1) return toNode(names[0]);
    if (names.length === 0) return undefined;
    throw new ChaingraphNodeResolutionError(
      `Chaingraph instance indexes several networks (${names.join(', ')}), ` +
      `pass 'network' or 'nodeName' to the ChaingraphClient so results are not mixed`,
      names
    );
  }

  async sendRawTransaction(rawTransactionHex: string){
    return await sendRawTransaction.call(this, rawTransactionHex)
  }

  async getRawTransaction(txid: string) {
    const { encoded_hex } = await getRawTransaction.call(this, txid);
    return encoded_hex
  }

  async getBlockHeight(){
    const { height } = await getLatestBlockheight.call(this);
    return Number(height);
  }

  async getUtxosForAddress(address: string){
    return await getUtxosForAddress.call(this, address)
  }

  async getUtxosForLockingBytecode(lockingBytecode: string){
    return await getUtxosForLockingBytecode.call(this, lockingBytecode)
  }
}
