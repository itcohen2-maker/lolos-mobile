/** מקור אחד למספר קלפים בפתיחה — לקוח ראשי ושרת מקוון */
export const CARDS_PER_PLAYER = 7;

/** אחרי כמה סיומי תור (roundsPlayed) להסתיר את שורת הרמז ליד הטיימרים הקטנים במסך המשחק ובמעבר התור */
export const TURN_TIMER_HINT_UNTIL_ROUNDS_PLAYED = 2;

/** כמה קלפי פרא בחפיסה — פחות בטווח צר או בלי שברים (מיושר ל־generateDeck בלקוח ובשרת). */
export function wildDeckCount(maxNumber: number, includeFractions: boolean): number {
  if (maxNumber <= 12 || !includeFractions) return 3;
  return 4;
}
