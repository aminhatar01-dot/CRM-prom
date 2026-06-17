const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkIntegrationRateLimit(organizationId: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(organizationId);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(organizationId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function resetIntegrationRateLimit() {
  buckets.clear();
}
