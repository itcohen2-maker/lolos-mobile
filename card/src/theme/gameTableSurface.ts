export function resolveGameTableSurface(
  activeTableSkinImage: unknown,
  fallbackTableImage: unknown,
): unknown {
  return activeTableSkinImage ?? fallbackTableImage;
}
