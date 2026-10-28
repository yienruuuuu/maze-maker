// SVG is shared by the toolbar preview and canvas artwork.
export function portalColor(group: string): string {
  let hash = 0;
  for (const ch of group) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${(hash * 137.508) % 360} 95% 70%)`;
}
export function portalSvg(group: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="#101523" fill-opacity=".85" stroke="${portalColor(group)}" stroke-width="2"/><g fill="none" stroke="${portalColor(group)}" stroke-width="3" stroke-linejoin="round"><path d="M32 8 53 44H11Z M32 56 11 20H53Z"/><circle cx="32" cy="32" r="7"/></g></svg>`;
}
export const portalUrl = (group: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(portalSvg(group));
