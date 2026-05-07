export function getEvidencePublicUrl(r2Key: string): string {
  const base64Key =
    typeof Buffer === "undefined"
      ? btoa(unescape(encodeURIComponent(r2Key)))
      : Buffer.from(r2Key, "utf8").toString("base64");

  return `/api/evidence/${encodeURIComponent(base64Key)}`;
}
