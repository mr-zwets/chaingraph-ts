// Hasura takes and returns Postgres 'bytea' values in hex-escape format: a '\x' prefix
// followed by the hex, so both directions need converting.

/** Adds the `\x` prefix a `bytea` query variable needs. */
export function hexToBytea(hex: string): string {
  return hex.startsWith('\\x') ? hex : `\\x${hex}`;
}

/** Strips the `\x` prefix from a `bytea` value returned by Chaingraph. */
export function byteaToHex(bytea: string): string {
  return bytea.startsWith('\\x') ? bytea.slice(2) : bytea;
}

/** Formats hex strings as the Postgres text array `search_output` takes, without prefixes. */
export function hexesToTextArray(hexes: string[]): string {
  return `{${hexes.map(byteaToHex).join(',')}}`;
}
