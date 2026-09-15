import type { CombinedError } from '@urql/core';

// The urql CombinedError is kept as 'cause' so callers can tell a network error from a bad query.
export class ChaingraphQueryError extends Error {
  declare cause: Error | CombinedError;

  constructor(operationName: string, cause: Error | CombinedError) {
    super(`Chaingraph query '${operationName}' failed: ${cause.message}`, { cause });
    this.name = 'ChaingraphQueryError';
  }
}

export class ChaingraphSubscriptionError extends Error {
  declare cause: Error | CombinedError;

  constructor(operationName: string, cause: Error | CombinedError) {
    super(`Chaingraph subscription '${operationName}' failed: ${cause.message}`, { cause });
    this.name = 'ChaingraphSubscriptionError';
  }
}

// Thrown when the node to scope queries to is ambiguous, so results would silently mix networks.
export class ChaingraphNodeResolutionError extends Error {
  readonly availableNodes: string[];

  constructor(message: string, availableNodes: string[]) {
    super(message);
    this.name = 'ChaingraphNodeResolutionError';
    this.availableNodes = availableNodes;
  }
}
