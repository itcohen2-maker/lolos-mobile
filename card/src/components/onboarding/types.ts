export type RibbonTileKind = 'target' | 'operator' | 'flexible';

export interface RibbonTile {
  id: string;
  kind: RibbonTileKind;
  value?: number | '+' | '-';
  label?: string;
}
