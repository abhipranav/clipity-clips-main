export function buildArtifactUrl(ref: string): string {
  return `/artifacts/${encodeURIComponent(ref)}`;
}
