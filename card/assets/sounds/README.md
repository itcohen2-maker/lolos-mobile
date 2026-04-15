# Sound Assets

**UI SFX (preview / `playSfx`):** Regenerate crisp WAVs anytime:

```bash
node scripts/generate-ui-sfx.mjs
```

Outputs `sfx_ui_*.wav` in this folder (referenced from `src/audio/sfx.ts`).

Place your sound files here or in `card/assets/` as used by the app:

- `shake.mp3` — dice rattling in hand
- `roll.mp3` — dice tumbling across surface
- `land.mp3` — single die landing thud

**צליל הטלת קוביות:** יושמע בלחיצה על כפתור ההטלה — קובץ `dice_sound.mov` ב־`card/assets/`.

**צליל בחירת קלף מהיד:** קובץ `card_select.mp3` ב־`card/assets/`.
- להמיר את "קלף אחד מקוצר.MOV" ל־MP3 (למשל ב־cloudconvert.com או כל ממיר אודיו), לשמור כ־`card_select.mp3` ולהעתיק ל־`card/assets/`.

The app works silently without these files.
