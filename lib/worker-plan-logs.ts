const LOG_SCOPE = 'worker-plan';

export type WorkerPlanLogTag =
  | 'worker_save:check'
  | 'worker_save:blocked'
  | 'worker_save:allowed';

export function logWorkerPlan(tag: WorkerPlanLogTag, data: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      scope: LOG_SCOPE,
      tag,
      at: new Date().toISOString(),
      ...data
    })
  );
}
