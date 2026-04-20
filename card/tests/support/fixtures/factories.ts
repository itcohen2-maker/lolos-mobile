type Player = { id: string; name: string; locale: 'en' | 'he' };
type RoomCode = string;

let counter = 0;
const next = () => `${Date.now()}-${++counter}`;

export const playerFactory = (overrides: Partial<Player> = {}): Player => ({
  id: `p-${next()}`,
  name: `Player-${next()}`,
  locale: 'en',
  ...overrides,
});

export const roomCodeFactory = (): RoomCode =>
  Math.random().toString(36).slice(2, 6).toUpperCase();
