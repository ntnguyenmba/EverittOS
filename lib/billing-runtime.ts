export function billingRuntimeDiagnostics() {
  const commitSha =
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.GIT_COMMIT_SHA?.trim() ||
    null;

  return {
    runtimeAt: new Date().toISOString(),
    commitSha,
    commitShaPreview: commitSha ? `${commitSha.slice(0, 7)}` : null,
    vercelEnv: process.env.VERCEL_ENV?.trim() || null,
    nodeEnv: process.env.NODE_ENV?.trim() || null
  };
}
