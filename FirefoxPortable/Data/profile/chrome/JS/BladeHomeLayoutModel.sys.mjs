export function validateLayout(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  for (const key of ['clock', 'tiles']) {
    const point = value[key];
    if (point == null) { out[key] = null; continue; }
    if (![point.x, point.y, point.s].every(Number.isFinite) ||
        point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1 || point.s < .5 || point.s > 1.5) return null;
    out[key] = {x:point.x, y:point.y, s:point.s};
  }
  return out;
}
export function fitLayout(base, point, viewport) {
  const scale = Math.min(point?.s || 1, Math.max(.1, (viewport.width - 16) / base.width), Math.max(.1, (viewport.height - 16) / base.height));
  const width = base.width * scale, height = base.height * scale;
  const clamp = (value, extent, size) => Math.max(size / 2 + 8, Math.min(extent - size / 2 - 8, value));
  const x = point ? clamp(point.x * viewport.width, viewport.width, width) : base.x;
  const y = point ? clamp(point.y * viewport.height, viewport.height, height) : base.y;
  return {x, y, width, height, s:scale};
}
