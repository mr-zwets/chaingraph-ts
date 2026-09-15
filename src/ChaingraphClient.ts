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
import { retryExchange, type RetryExchangeOptions } from '@urql/exchange-retry';
import {
  createClient as createWSClient,
  type Client as WSClient,
  type ClientOptions
} from 'graphql-ws';
import {
  getLatestBlockheight,
  getRawTransaction,
  getUtxosForAddress,
  getUtxosForLockingBytecode,
  sendRawTransaction,
  type UtxoQueryOptions
} from './chaingraphHelpers.js';
import { ChaingraphNodeResolutionError, ChaingraphSubscriptionError } from './errors.js';
import { queryChaingraphNodes } from './queries.js';
import { documentName, runQuery } from './runQuery.js';

// Urql has no timeout of its own, so one is applied by wrapping fetch.
function timeoutFetch(timeoutMs?: number) {
  if (timeoutMs === undefined) return undefined;
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
    return fetch(input, { ...init, signal });
  };
}

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
  /** Extra request headers, for instances behind authentication. */
  headers?: Record<string, string>;
  /** Aborts a request after this many milliseconds. Unset means no timeout. */
  timeoutMs?: number;
  /** Retry options, or false to send every operation once. Defaults to two attempts. */
  retry?: Partial<RetryExchangeOptions> | false;
  /** Passed to the graphql-ws client used for subscriptions. */
  wsOptions?: Partial<ClientOptions>;
}

// Only network errors are retried; a GraphQL error is deterministic and retrying it just waits.
// maxNumberAttempts counts attempts, not retries: 2 means one retry.
const defaultRetryOptions: Partial<RetryExchangeOptions> = {
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  maxNumberAttempts: 2,
  retryIf: error => Boolean(error?.networkError)
};

export class ChaingraphClient {
  client: Client;
  options: ChaingraphClientOptions;

  private wsClient: WSClient;
  private resolvedNode?: Promise<ChaingraphNode | undefined>;

  constructor(
    chaingraphUrl: string,
    options: ChaingraphClientOptions = {}
  ) {
    this.options = options;
    const wsClient = createWSClient({ url: chaingraphUrl, ...options.wsOptions });
    this.wsClient = wsClient;

    const exchanges = [cacheExchange];
    if (options.retry !== false) {
      // Order matters: retryExchange has to come before fetchExchange
      exchanges.push(retryExchange({ ...defaultRetryOptions, ...options.retry }));
    }
    exchanges.push(fetchExchange);
    exchanges.push(subscriptionExchange({
      forwardSubscription(request) {
        const input = { ...request, query: request.query || '' };
        return {
          subscribe(sink) {
            const unsubscribe = wsClient.subscribe(input, sink);
            return { unsubscribe };
          },
        };
      },
    }));

    // create Urql client with subscriptionExchange
    this.client = new Client({
      url: chaingraphUrl,
      exchanges,
      fetchOptions: { headers: options.headers },
      fetch: timeoutFetch(options.timeoutMs),
      // disable urql cache
      requestPolicy: "network-only",
      // Force POST for all operations, as Hasura uses POST endpoints
      preferGetMethod: false
    });
  }

  /** Closes the websocket, so a script that subscribed can exit. */
  async close() {
    await this.wsClient.dispose();
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

  // Wonka is stream based rather than promise based, so an error thrown by the callback would
  // otherwise surface as an unhandled rejection.
  subscribeWithCallback<Data, Variables extends AnyVariables>(
    query: DocumentInput<Data, Variables>,
    variables: Variables,
    callback: (data: Data) => void | Promise<void>,
    onError?: (error: unknown) => void
    // annotated because the inferred wonka Subscription type is not portable
  ): { unsubscribe: () => void } {
    return this.client.subscription(query, variables).subscribe(async result => {
      const name = documentName(query);
      try {
        if (result.error) throw new ChaingraphSubscriptionError(name, result.error);
        if (!result.data) {
          throw new ChaingraphSubscriptionError(name, new Error('no data returned'));
        }
        await callback(result.data);
      } catch (error) {
        if (onError) {
          onError(error);
          return;
        }
        console.error(error);
      }
    });
  }

  /**
   * The node queries are scoped to, looked up once and then cached.
   *
   * Returns undefined when the instance does not expose its nodes, so callers can fall back to
   * unfiltered queries. Throws when the instance indexes several networks and none was picked.
   */
  async resolveNode() {
    this.resolvedNode ??= this.lookUpNode();
    try {
      return await this.resolvedNode;
    } catch (error) {
      if (error instanceof ChaingraphNodeResolutionError) throw error;
      // The lookup failed rather than answering, so it is not cached: a temporary outage
      // should not leave this client unfiltered for the rest of its life.
      this.resolvedNode = undefined;
      const { nodeName } = this.options;
      return nodeName ? { name: nodeName } : undefined;
    }
  }

  private async lookUpNode() {
    const { network, nodeName } = this.options;

    const nodes = (await runQuery(this.client, queryChaingraphNodes, {})).node;
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

  /** Returns undefined when the instance has never seen the transaction. */
  async getRawTransaction(txid: string) {
    return await getRawTransaction.call(this, txid);
  }

  async getBlockHeight() {
    const block = await getLatestBlockheight.call(this);
    return block ? Number(block.height) : undefined;
  }

  async getUtxosForAddress(address: string, options?: UtxoQueryOptions){
    return await getUtxosForAddress.call(this, address, options)
  }

  async getUtxosForLockingBytecode(lockingBytecode: string, options?: UtxoQueryOptions){
    return await getUtxosForLockingBytecode.call(this, lockingBytecode, options)
  }
}
