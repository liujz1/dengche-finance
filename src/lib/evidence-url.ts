export function getEvidencePublicUrl(r2Key: string, version?: string): string {
  const url = `/api/evidence/${encodeURIComponent(r2Key)}`;

  if (!version) {
    return url;
  }

  return `${url}?v=${encodeURIComponent(version)}`;
}
