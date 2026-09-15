// Chaingraph instances clamp how many rows a select returns and drop the rest silently, so an
// unbounded query truncates without saying so. Page size must stay at or below that clamp,
// otherwise a clamped page looks like the final short page and paging stops early.
export const CHAINGRAPH_PAGE_SIZE = 1000;

// Offset paging needs the query to order deterministically; rows are deduplicated by key in
// case new rows land between pages.
export async function paginate<Row>(
  fetchPage: (limit: number, offset: number) => Promise<Row[]>,
  rowKey: (row: Row) => string,
  pageSize = CHAINGRAPH_PAGE_SIZE
) {
  const rows: Row[] = [];
  const seenKeys = new Set<string>();

  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchPage(pageSize, offset);
    for (const row of page) {
      const key = rowKey(row);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      rows.push(row);
    }
    if (page.length < pageSize) break;
  }

  return rows;
}
