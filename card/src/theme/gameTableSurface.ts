type ActiveTableSkinLike = {
  image?: unknown;
} | null | undefined;

export type ResolvedGameTableSurface = {
  source: unknown;
  resizeMode: 'cover' | 'contain' | 'stretch';
};

export function resolveGameTableSurface(
  activeTableSkin: ActiveTableSkinLike,
  fallbackTableImage: unknown,
  options: { platform?: string } = {},
): ResolvedGameTableSurface {
  const source = activeTableSkin?.image ?? fallbackTableImage;
  const resizeMode =
    activeTableSkin?.image != null ? 'cover'
    : options.platform === 'web' ? 'contain'
    : 'stretch';

  return {
    source,
    resizeMode,
  };
}
