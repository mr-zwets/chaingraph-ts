import { Client, cacheExchange, fetchExchange, subscriptionExchange } from '@urql/core';
import { type ClientOptions, createClient as createWSClient } from 'graphql-ws';
import WebSocket from 'ws'
import { getUtxosForAddress, getUtxosForLockingBytecode } from './helperQueries.js';

export class chaingraphClient {
  client: Client;

  constructor(
    chaingraphUrl: string
  ) {
    // create options object for createWSClient
    const wsClientOptions: ClientOptions = { url: chaingraphUrl }
    // provide custom webSocketImpl option when using Node as runtime
    if(typeof process === 'object') wsClientOptions.webSocketImpl = WebSocket
    const wsClient = createWSClient(wsClientOptions);

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
    });
  }

  // Expose the query method as a class method
  query(query: string, variables?: Record<string, any>) {
    return this.client.query(query, variables);
  }

  // Expose the subscribe method as a class method
  subscribe(subscription: string, variables?: Record<string, any>) {
    return this.client.subscription(subscription, variables);
  }

  async getUtxosForAddress(address: string){
    return await getUtxosForAddress.call(this, address)
  }

  async getUtxosForLockingBytecode(lockingBytecode: string){
    return await getUtxosForLockingBytecode.call(this, lockingBytecode)
  }
}