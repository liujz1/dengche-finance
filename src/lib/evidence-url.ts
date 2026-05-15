export function getEvidencePublicUrl(r2Key: string): string {
  return `/api/evidence/${encodeURIComponent(r2Key)}`;
}
