# Sound Assets

Place your sound files here or in `card/assets/` as used by the app:

- `shake.mp3` — dice rattling in hand
- `roll.mp3` — dice tumbling across surface
- `land.mp3` — single die landing thud

**צליל הטלת קוביות:** יושמע בלחיצה על כפתור ההטלה.
- כדי שיישמע: שים קובץ צליל בשם `dice_sound.mov` בתיקייה `card/assets/` (אפשר להעתיק מ־Dice.MOV).
- אם הקובץ חסר או לא נתמך — יושמע צליל גיבוי (צליל כניסה למסך השחקן).
- באנדרואיד: אם .mov לא עובד, נסה להמיר ל־MP3 ולשמור כ־`dice_sound.mp3`, ואז לעדכן בקוד את require ל־`dice_sound.mp3`.

The app works silently without these files.
