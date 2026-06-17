export function isCronAuthorized({
  authorization,
  cronSecret,
  headerSecret
}: {
  authorization: string | null;
  cronSecret?: string;
  headerSecret?: string | null;
}) {
  if (!cronSecret) return false;
  if (authorization === `Bearer ${cronSecret}`) return true;
  return headerSecret === cronSecret;
}
