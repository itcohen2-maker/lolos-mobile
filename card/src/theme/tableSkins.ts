export type TableSkinId = 'poker_red' | 'poker_gold' | 'poker_blue';

export interface TableSkin {
  id: TableSkinId;
  name_he: string;
  name_en: string;
  price: number;
  // PNG with transparent background — golden poker table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  image: any;
}

export const TABLE_SKINS: Record<TableSkinId, TableSkin> = {
  poker_red: {
    id: 'poker_red',
    name_he: 'שולחן אדום',
    name_en: 'Red Table',
    price: 40,
    image: require('../../assets/table_royal_nobg.png'),
  },
  poker_gold: {
    id: 'poker_gold',
    name_he: 'שולחן זהב',
    name_en: 'Gold Table',
    price: 40,
    image: require('../../assets/table_golden_nobg.png'),
  },
  poker_blue: {
    id: 'poker_blue',
    name_he: 'שולחן כחול',
    name_en: 'Blue Table',
    price: 40,
    image: require('../../assets/table_ocean_nobg.png'),
  },
};

export const TABLE_SKIN_IDS: TableSkinId[] = ['poker_red', 'poker_gold', 'poker_blue'];
export const DEFAULT_TABLE_SKIN_ID: TableSkinId = 'poker_red';
