/**
 * Pure helpers for consolidating duplicate worker identity rows.
 * Used by repair scripts/tests — does not talk to the database.
 */

export type WorkerIdentityCandidate = {
  id: string;
  organizationId: string | null;
  email: string | null;
  authUserId: string | null;
  active: boolean;
  name: string | null;
  assignedJobCount: number;
  assignmentCount: number;
  laborCount: number;
  laborTotal: number;
  createdAt: string | null;
};

export type CanonicalWorkerChoice = {
  organizationId: string;
  canonicalId: string;
  duplicateIds: string[];
  score: number;
};

export function normalizeWorkerEmail(email: string | null | undefined): string {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/** Higher score wins as the survivor worker row for an organization. */
export function scoreWorkerCandidate(
  worker: WorkerIdentityCandidate,
  preferredAuthUserId?: string | null
): number {
  // History dominates: login linkage is remapped onto the survivor.
  const history =
    worker.assignedJobCount * 1_000 +
    worker.assignmentCount * 800 +
    worker.laborCount * 600 +
    Math.min(Math.max(worker.laborTotal, 0), 100_000);
  const authMatch = preferredAuthUserId && worker.authUserId === preferredAuthUserId ? 100 : 0;
  const hasAuth = worker.authUserId ? 50 : 0;
  const activeBonus = worker.active ? 25 : 0;
  const createdBonus = worker.createdAt ? 1 / Math.max(Date.parse(worker.createdAt) || 1, 1) : 0;
  return history + authMatch + hasAuth + activeBonus + createdBonus;
}

/**
 * Group candidates by organization and pick one canonical worker per org.
 * Duplicates are every other worker in that org group.
 */
export function chooseCanonicalWorkers(
  workers: WorkerIdentityCandidate[],
  preferredAuthUserId?: string | null
): CanonicalWorkerChoice[] {
  const byOrg = new Map<string, WorkerIdentityCandidate[]>();
  for (const worker of workers) {
    const orgId = worker.organizationId || '';
    if (!orgId) continue;
    const list = byOrg.get(orgId) || [];
    list.push(worker);
    byOrg.set(orgId, list);
  }

  const choices: CanonicalWorkerChoice[] = [];
  for (const [organizationId, list] of Array.from(byOrg.entries())) {
    const ranked = [...list].sort((a, b) => {
      const scoreDiff = scoreWorkerCandidate(b, preferredAuthUserId) - scoreWorkerCandidate(a, preferredAuthUserId);
      if (scoreDiff !== 0) return scoreDiff;
      return a.id.localeCompare(b.id);
    });
    const canonical = ranked[0];
    if (!canonical) continue;
    choices.push({
      organizationId,
      canonicalId: canonical.id,
      duplicateIds: ranked.slice(1).map((row) => row.id),
      score: scoreWorkerCandidate(canonical, preferredAuthUserId)
    });
  }
  return choices;
}

export function workerEmailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeWorkerEmail(a);
  const right = normalizeWorkerEmail(b);
  return Boolean(left && right && left === right);
}
