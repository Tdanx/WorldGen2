// Shared ID generator — prevents ChronicleEntry ID collisions across engines.
// Each prefix gets its own counter, e.g. 'conflict-0', 'religion-0', 'god-0'.

const counters = new Map<string, number>();

export function makeEntryId(prefix: string): string {
  const n = counters.get(prefix) ?? 0;
  counters.set(prefix, n + 1);
  return `${prefix}-${n}`;
}

/** Reset all counters — call between worlds in tests. */
export function resetIdGen(): void {
  counters.clear();
}
