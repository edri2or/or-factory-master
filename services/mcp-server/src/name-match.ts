/**
 * Case-insensitive, null-safe name equality for matching cloud resources by
 * their human-chosen names (Railway services/projects/environments, GitHub
 * rulesets, …). Providers preserve the operator's casing (e.g. Railway names
 * the database service `Postgres`, not `postgres`), so a strict `===` against a
 * lowercase literal produces false "not found" results. Normalize both sides.
 */
export function namesEqualCI(a?: string | null, b?: string | null): boolean {
  return typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
}
