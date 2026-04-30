export type ThemeId = 'classic' | 'royal' | 'forest' | 'ocean';

export interface TableTheme {
  gradient?: [string, string];
  image?: any;
  imageTint?: string;
}

export interface BackgroundTheme {
  gradient: [string, string, string];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  image?: any;
}

export interface ThemeDef {
  id: ThemeId;
  name_he: string;
  name_en: string;
  price: number;
  table: TableTheme;
  background: BackgroundTheme;
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  classic: {
    id: 'classic',
    name_he: 'קלאסי',
    name_en: 'Classic',
    price: 0,
    table: {
      image: require('../../assets/bg.jpg'),
      imageTint: '#B06820',
    },
    background: {
      gradient: ['#070f1a', '#0f2840', '#153252'],
    },
  },
  royal: {
    id: 'royal',
    name_he: 'מלכותי',
    name_en: 'Royal',
    price: 50,
    table: { gradient: ['#7F1D1D', '#450A0A'] },
    background: { gradient: ['#1C0A00', '#2D1505', '#1A0A00'], image: require('../../assets/bg_royal.jpg') },
  },
  forest: {
    id: 'forest',
    name_he: 'יער',
    name_en: 'Forest',
    price: 50,
    table: { gradient: ['#064E3B', '#022C22'] },
    background: { gradient: ['#0A1A10', '#061209', '#030805'], image: require('../../assets/bg_forest.jpg') },
  },
  ocean: {
    id: 'ocean',
    name_he: 'ים',
    name_en: 'Ocean',
    price: 50,
    table: { gradient: ['#1E3A8A', '#0C1E45'] },
    background: { gradient: ['#060C1A', '#0A1228', '#040810'], image: require('../../assets/bg_ocean.jpg') },
  },
};

export const DEFAULT_THEME_ID: ThemeId = 'classic';
export const THEME_IDS: ThemeId[] = ['classic', 'royal', 'forest', 'ocean'];
