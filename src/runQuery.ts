import type { AnyVariables, Client, TypedDocumentNode } from '@urql/core';
import type { DocumentNode } from 'graphql';
import { ChaingraphQueryError } from './errors.js';

export function operationName(document: DocumentNode) {
  for (const definition of document.definitions) {
    if (definition.kind === 'OperationDefinition' && definition.name) return definition.name.value;
  }
  return 'anonymous';
}

// Urql reports failures on the result instead of rejecting, so reading only 'data' turns a
// network error into an empty response. These wrappers throw instead.
export async function runQuery<Data, Variables extends AnyVariables>(
  client: Client,
  document: TypedDocumentNode<Data, Variables>,
  variables: Variables
) {
  const result = await client.query(document, variables).toPromise();
  if (result.error) throw new ChaingraphQueryError(operationName(document), result.error);
  if (!result.data) {
    throw new ChaingraphQueryError(operationName(document), new Error('no data returned'));
  }
  return result.data;
}

export async function runMutation<Data, Variables extends AnyVariables>(
  client: Client,
  document: TypedDocumentNode<Data, Variables>,
  variables: Variables
) {
  const result = await client.mutation(document, variables).toPromise();
  if (result.error) throw new ChaingraphQueryError(operationName(document), result.error);
  if (!result.data) {
    throw new ChaingraphQueryError(operationName(document), new Error('no data returned'));
  }
  return result.data;
}
