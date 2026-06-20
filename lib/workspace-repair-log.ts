const LOG_SCOPE = 'workspace-repair';

export type WorkspaceRepairLogTag =
  | 'workspace:diagnose'
  | 'workspace:repair_attempt'
  | 'workspace:repair_completed'
  | 'workspace:repair_failed'
  | 'workspace:missing_record';

export function logWorkspaceRepair(
  tag: WorkspaceRepairLogTag,
  data: Record<string, unknown> = {},
  level: 'log' | 'warn' | 'error' = 'log'
) {
  const payload = {
    scope: LOG_SCOPE,
    tag,
    at: new Date().toISOString(),
    ...data
  };
  const line = JSON.stringify(payload);
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  if (level === 'error') {
    console.error(line);
    return;
  }
  console.log(line);
}
