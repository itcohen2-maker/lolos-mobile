# StartScreen Precedents (M6 reference)

**Source:** card/index.tsx, function StartScreen (≈line 4643)
**Snapshot date:** 2026-04-11
**Purpose:** Reference for adding mode toggle, bot difficulty toggle,
and advanced panel in M6 of the vs-bot implementation plan.

---

## 1. `StartScreen` function declaration and initial state

**Declaration line:** 4643

```tsx
function StartScreen({ onBackToChoice, onOpenSoundDemo }: { onBackToChoice?: () => void; onOpenSoundDemo?: () => void }) {
```

**Hook block: lines 4644–4692 (last hook is `useMemo` for `timerWheelOptions`)**

All `useState` variables (verbatim, with types and defaults):

```tsx
const { t, isRTL } = useLocale();                                       // line 4644 — not useState, but key destructure
const { dispatch, state: gameState } = useGame();                        // line 4645
const safe = useGameSafeArea();                                          // line 4646
const [playerCount, setPlayerCount] = useState(2);                      // line 4647 — number, default 2
const [numberRange, setNumberRange] = useState<'easy' | 'full'>('full'); // line 4648
const [difficultyStage, setDifficultyStage] = useState<DifficultyStageId>('E'); // line 4649
const [enabledOperators, setEnabledOperators] = useState<Operation[]>(['+']); // line 4650
const [allowNegativeTargets, setAllowNegativeTargets] = useState(false); // line 4651
const [abVariant, setAbVariant] = useState<AbVariant>('control_0_12_plus'); // line 4652
const [fractions, setFractions] = useState(true);                       // line 4653
const [showPossibleResults, setShowPossibleResults] = useState(true);   // line 4654
const [showSolveExercise, setShowSolveExercise] = useState(true);       // line 4655
const [timer, setTimer] = useState<'30' | '60' | 'off' | 'custom'>('off'); // line 4656
const [customTimerSeconds, setCustomTimerSeconds] = useState(60);       // line 4657
const [timerCustomModalOpen, setTimerCustomModalOpen] = useState(false); // line 4658
const [guidancePromptOpen, setGuidancePromptOpen] = useState(true);     // line 4659
const [guidanceOn, setGuidanceOn] = useState(true);                     // line 4660
const [advancedSetupOpen, setAdvancedSetupOpen] = useState(false);      // line 4661
const [advancedStageExpanded, setAdvancedStageExpanded] = useState<DifficultyStageId | null>(null); // line 4662
const [rulesOpen, setRulesOpen] = useState(false);                      // line 4663
const [cardsCatalogOpen, setCardsCatalogOpen] = useState(false);        // line 4664
const [futureLabOpen, setFutureLabOpen] = useState(false);              // line 4665
const [benefitsDemoOpen, setBenefitsDemoOpen] = useState(false);        // line 4666
const [teacherScreenOpen, setTeacherScreenOpen] = useState(false);      // line 4667
const [demoGradeBand, setDemoGradeBand] = useState<DemoGradeBand>('g2'); // line 4668
const [demoLevel, setDemoLevel] = useState<DemoLevel>('medium');        // line 4669
const [demoClassGames, setDemoClassGames] = useState(120);              // line 4670
const [demoSimRunning, setDemoSimRunning] = useState(false);            // line 4671
const [demoSimTurns, setDemoSimTurns] = useState(0);                    // line 4672
const [demoSimProgress, setDemoSimProgress] = useState(0);              // line 4673
const [demoSimResult, setDemoSimResult] = useState<'success' | 'almost' | null>(null); // line 4674
const [demoSimMessage, setDemoSimMessage] = useState('');               // line 4675
const demoSimTimerRef = useRef<ReturnType<typeof setInterval> | null>(null); // line 4676 — useRef, not useState
const [teacherKpi, setTeacherKpi] = useState({                          // line 4677
  classAccuracy: 63,
  avgTurns: 24,
  atRiskStudents: 6,
  taskCompletion: 71,
});
const [teacherAlertsOn, setTeacherAlertsOn] = useState(true);           // line 4683
const [teacherLastAction, setTeacherLastAction] = useState('');         // line 4684
const [teacherRecommendation, setTeacherRecommendation] = useState(''); // line 4685
const [teacherActionLog, setTeacherActionLog] = useState<string[]>([]); // line 4686
```

**`useMemo` hook (line 4687):**
```tsx
const timerWheelOptions = useMemo((): HorizontalWheelOption[] => [
  { key: 'off', label: t('lobby.off'), accessibilityLabel: t('start.timerA11y.off') },
  { key: '30', label: t('lobby.timerSec', { n: 30 }), accessibilityLabel: t('start.timerA11y.sec30') },
  { key: '60', label: t('lobby.timerMin'), accessibilityLabel: t('start.timerA11y.min1') },
  { key: 'custom', label: t('lobby.timerCustom'), accessibilityLabel: t('start.timerA11y.custom') },
], [t]);
```

**Two derived constants (lines 4693–4694)** that shift wheel indices when the custom timer row is visible:
```tsx
const guidanceWheelIndex = timer === 'custom' ? 7 : 6;
const advancedWheelIndex = timer === 'custom' ? 8 : 7;
```

**`useRef` animations (lines 4736–4737):**
```tsx
const bounceAnim = useRef(new Animated.Value(0)).current;
const scrollY = useRef(new Animated.Value(0)).current;
```

**Inline `WheelRow` component (lines 4743–4756) — defined inside StartScreen:**
```tsx
const WheelRow = useCallback(({ index, children }: { index: number; children: React.ReactNode }) => {
  const centerY = wheelCenterForIndex(index);
  const rotateX = scrollY.interpolate({
    inputRange: [centerY - 90, centerY - 35, centerY, centerY + 35, centerY + 90],
    outputRange: ['-8deg', '-3deg', '0deg', '3deg', '8deg'],
  });
  const opacity = scrollY.interpolate({
    inputRange: [centerY - 90, centerY - 35, centerY, centerY + 35, centerY + 90],
    outputRange: [0.82, 0.94, 1, 0.94, 0.82],
  });
  return (
    <Animated.View style={{ transform: [{ perspective: 1000 }, { rotateX }], opacity }}>{children}</Animated.View>
  );
}, [scrollY]);
```

> **Note:** StartScreen is substantial — approximately 1,400 lines of JSX/logic (lines 4643–6012 before the `hsS` stylesheet block at 6013). The teacher-demo and futurelab sub-screens are also inlined inside the function.

---

## 2. `advancedSetupOpen` disclosure pattern

### Declaration

**Line 4661:**
```tsx
const [advancedSetupOpen, setAdvancedSetupOpen] = useState(false);
```

### Entry row (the button that opens the modal) — lines 5875–5924

The "Advanced" entry is rendered as a `WheelRow` at index `advancedWheelIndex`. It is a `TouchableOpacity` inside a `LinearGradient`, not an inline chevron toggle. Pressing it opens a full-screen `AppModal` — it does **not** inline-expand below the row.

```tsx
<WheelRow index={advancedWheelIndex}>
  <LinearGradient
    colors={['#fbbf24', '#f472b6', '#a855f7', '#38bdf8']}
    start={{ x: isRTL ? 1 : 0, y: 0 }}
    end={{ x: isRTL ? 0 : 1, y: 1 }}
    style={hsS.rowGradientOuter}
  >
  <TouchableOpacity
    activeOpacity={0.88}
    onPress={() => setAdvancedSetupOpen(true)}
    style={hsS.advancedEntryInner}
  >
    {/* שורה אחת: תמיד [תוכן | כפתור] בציר LTR הפיזי */}
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 26 }}>✨</Text>
          <Text style={[hsS.advancedEntryTitle, { textAlign: isRTL ? 'right' : 'left', flex: 1, writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
            {t('start.advancedSetup.entryTitle')}
          </Text>
        </View>
        <Text style={[hsS.advancedEntryTeaser, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
          {t('start.advancedSetup.entryRowTeaser')}
        </Text>
        <View style={[hsS.advancedEntryChipRow, { flexDirection: 'row' }]}>
          {STAGE_SEQUENCE.map((letter, i) => {
            const on = difficultyStage === letter;
            return (
              <View
                key={letter}
                style={[
                  hsS.advancedStageChip,
                  { backgroundColor: ADVANCED_ENTRY_STAGE_COLORS[i] ?? '#64748b' },
                  on && hsS.advancedStageChipActive,
                ]}
              >
                <Text style={[hsS.advancedStageChipTxt, on && hsS.advancedStageChipTxtActive]}>{letter}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={[hsS.advancedEntryCtaWrap, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={hsS.advancedEntryCtaTxt}>{t('start.advancedSetup.entryOpenCta')}</Text>
        <Text style={hsS.advancedEntryCtaArrow}>{isRTL ? '‹' : '›'}</Text>
      </View>
    </View>
  </TouchableOpacity>
  </LinearGradient>
</WheelRow>
```

### The modal itself — `AppModal` at line 5327

```tsx
<AppModal
  visible={advancedSetupOpen}
  onClose={() => setAdvancedSetupOpen(false)}
  overlayOpacity={0.82}
  topAligned
  customHeader={(
    <LinearGradient
      colors={['#fbbf24', '#f472b6', '#a855f7', '#38bdf8']}
      start={{ x: isRTL ? 1 : 0, y: 0 }}
      end={{ x: isRTL ? 0 : 1, y: 1 }}
      style={{ ... }}
    >
      ...title + close button (✕)...
    </LinearGradient>
  )}
  boxStyle={{
    width: '100%',
    maxHeight: SCREEN_H - 56,
    marginTop: (safe.insets.top || 12) + 8,
    borderRadius: 0,
    backgroundColor: 'rgba(15,23,42,0.97)',
    ...
  }}
>
  <ScrollView
    style={{ flex: 1, direction: isRTL ? 'rtl' : 'ltr' }}
    contentContainerStyle={{ paddingBottom: 28, direction: isRTL ? 'rtl' : 'ltr' }}
    showsVerticalScrollIndicator
    nestedScrollEnabled
    keyboardShouldPersistTaps="handled"
  >
    ...settings rows...
  </ScrollView>
</AppModal>
```

### Visual pattern summary

| Attribute | Value |
|-----------|-------|
| Toggle mechanism | Plain boolean state (`advancedSetupOpen`) |
| Trigger | `TouchableOpacity` row with `›`/`‹` arrow character (RTL-flipped) |
| Content container | Full-screen `AppModal` (not inline expand) |
| Animation | None — `AppModal` handles its own `animationType` |
| `LayoutAnimation` | Not used |
| `Animated.Value` | Not used for the disclosure itself |
| Keyboard dismiss | Not called on toggle |
| Chevron rotation | No — uses static `›` / `‹` text character, RTL-flipped |

### Styles used by the Advanced entry row

- `hsS.rowGradientOuter` — outer gradient shell (borderRadius 12, padding 1)
- `hsS.advancedEntryInner` — card background (dark translucent, border)
- `hsS.advancedEntryTitle` — white bold 18px title
- `hsS.advancedEntryTeaser` — yellow-tinted 12px teaser text
- `hsS.advancedEntryChipRow` — flex row wrap for stage chips
- `hsS.advancedStageChip` / `hsS.advancedStageChipActive` — individual A–H letter chips
- `hsS.advancedStageChipTxt` / `hsS.advancedStageChipTxtActive`
- `hsS.advancedEntryCtaWrap` — white pill button wrapping the arrow
- `hsS.advancedEntryCtaTxt` / `hsS.advancedEntryCtaArrow`

---

## 3. `HorizontalWheelOption` component

### Important clarification

`HorizontalWheelOption` is a **type**, not a component. The rendering component is `HorizontalOptionWheel`. Both are exported from `./components/HorizontalOptionWheel`.

**Import line (line 29 of index.tsx):**
```tsx
import { HorizontalOptionWheel, type HorizontalWheelOption } from './components/HorizontalOptionWheel';
```

**`HorizontalWheelOption` type definition** (HorizontalOptionWheel.tsx, line 17):
```tsx
export type HorizontalWheelOption = {
  key: string;
  label: string;
  accessibilityLabel: string;
};
```

**`HorizontalOptionWheel` props interface** (HorizontalOptionWheel.tsx, lines 45–58):
```tsx
export function HorizontalOptionWheel({
  options,
  selectedKey,
  onSelect,
  scrollAfterSelect = () => true,
  snapFocus = 'center',
}: {
  options: readonly HorizontalWheelOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  scrollAfterSelect?: (key: string) => boolean;
  snapFocus?: 'center' | 'leading';
})
```

### One existing usage inside StartScreen (lines 5821–5832) — copy this template

```tsx
<HorizontalOptionWheel
  options={timerWheelOptions}
  selectedKey={timer}
  snapFocus="leading"
  scrollAfterSelect={(key) => key !== 'custom'}
  onSelect={(key) => {
    if (key === 'custom') setTimerCustomModalOpen(true);
    else setTimer(key as '30' | '60' | 'off');
  }}
/>
```

This is placed inside:
```tsx
<View style={hsS.timerWheelWrap}>
  <HorizontalOptionWheel ... />
</View>
```

Where `hsS.timerWheelWrap = { flex: 1, minWidth: 0, marginLeft: 4 }`.

### RTL handling inside `HorizontalOptionWheel`

The component hardcodes `style={{ direction: 'ltr' }}` on its inner `Animated.ScrollView` (HorizontalOptionWheel.tsx, line 132):
```tsx
<Animated.ScrollView
  ref={listRef}
  horizontal
  style={{ direction: 'ltr' }}
  ...
>
```

There is **no `isRTL` usage, no `inverted` prop, no manual flip** inside the component. The scroll direction is always physical LTR regardless of locale. The first option in the array always appears on the left. RTL callers must order the options array themselves if logical order matters.

### Selected state visuals

Selected chip (`styles.chipOn` in HorizontalOptionWheel.tsx):
```tsx
chipOn: {
  backgroundColor: '#FBBC05',          // yellow
  borderColor: 'rgba(251,188,5,0.5)',
  // iOS shadow + Android elevation 3
},
chipTxtOn: { color: '#3c3c00' },        // dark olive text on yellow
```

Unselected chip:
```tsx
chipOff: {
  backgroundColor: 'rgba(255,255,255,0.08)',
  borderColor: 'rgba(255,255,255,0.15)',
},
chipTxtOff: { color: 'rgba(255,255,255,0.5)' },
```

Plus a 3D perspective `rotateY` + `scale` + `opacity` animation driven by `scrollX` — items off-center rotate away, shrink to 0.86, and fade to 0.55.

---

## 4. Existing mode/difficulty toggles

### Difficulty: easy / full — "Number range" toggle (lines 5732–5746)

This is the canonical two-option toggle pattern. Quote:

```tsx
<WheelRow index={1}>
<LinearGradient colors={['#1a73e8', '#4285F4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={hsS.rowGradientOuter}>
<View style={[hsS.row, hsS.rowRange]}>
  <Text style={hsS.rowLabel}>{t('start.wheel.numberRange')}</Text>
  <View style={hsS.toggleGroup}>
    {([['full', '0-25'], ['easy', '0-12']] as const).map(([key, label]) => (
      <TouchableOpacity key={key} onPress={() => setNumberRange(key)} activeOpacity={0.7}
        style={[hsS.toggleBtn, numberRange === key ? hsS.toggleOn : hsS.toggleOff]}>
        <Text style={numberRange === key ? hsS.toggleOnTxt : hsS.toggleOffTxt}>{label}</Text>
      </TouchableOpacity>
    ))}
  </View>
</View>
</LinearGradient>
</WheelRow>
```

**This is the exact template to copy for the new mode toggle ("Pass and play" / "Play vs Bot") and bot difficulty toggle ("Easy" / "Hard").**

### Difficulty stage A–H picker

Not a toggle — it is a grid of `TouchableOpacity` chips inside the `advancedSetupOpen` modal (lines 5450–5460 area). Not a two-option pattern.

### Player count selector (lines 5693–5730)

Not a toggle — it is a stepper (− / number / +) using `LulosButton`-styled `TouchableOpacity`s with `LinearGradient`.

### Summary of two-option toggle pattern

- Container: `<View style={hsS.toggleGroup}>` — `flexDirection: 'row'`, `direction: 'ltr'` (locks visual order regardless of RTL)
- Each option: `<TouchableOpacity style={[hsS.toggleBtn, selected ? hsS.toggleOn : hsS.toggleOff]}>`
- Label: `<Text style={selected ? hsS.toggleOnTxt : hsS.toggleOffTxt}>`
- Options array rendered with `.map()` — static tuples `[key, label]` as `const`
- No `HorizontalOptionWheel` needed for a two-option toggle; use `hsS.toggleGroup` directly

---

## 5. Existing "Start game" button and dispatch

### `startGame` function (lines 4822–4843)

```tsx
const startGame = () => {
  // שמות יוכנסו במסך השחקן — כל שחקן מזין את שמו בתורו
  const players = Array.from({ length: playerCount }, (_, i) => ({ name: t('start.playerPlaceholder', { n: String(i + 1) }) }));
  if (gameState.soundsEnabled !== false) {
    void playSfx('start', { cooldownMs: 250, volumeOverride: 0.4 });
  }
  dispatch({
    type: 'START_GAME',
    players,
    difficulty: numberRange,
    fractions,
    showPossibleResults,
    showSolveExercise,
    timerSetting: timer,
    timerCustomSeconds: timer === 'custom' ? customTimerSeconds : 60,
    difficultyStage,
    enabledOperators,
    allowNegativeTargets,
    mathRangeMax: numberRange === 'easy' ? 12 : 25,
    abVariant,
  });
};
```

### The `START_GAME` action type signature (line 357)

```tsx
| { type: 'START_GAME'; players: { name: string }[]; difficulty: 'easy' | 'full'; fractions: boolean; showPossibleResults: boolean; showSolveExercise: boolean; timerSetting: '30' | '60' | 'off' | 'custom'; timerCustomSeconds?: number; difficultyStage?: DifficultyStageId; enabledOperators?: Operation[]; allowNegativeTargets?: boolean; mathRangeMax?: 12 | 25; abVariant?: AbVariant }
```

**Field inventory:**

| Field | Type | Notes |
|-------|------|-------|
| `players` | `{ name: string }[]` | Length = `playerCount` |
| `difficulty` | `'easy' \| 'full'` | Maps from `numberRange` state |
| `fractions` | `boolean` | |
| `showPossibleResults` | `boolean` | |
| `showSolveExercise` | `boolean` | |
| `timerSetting` | `'30' \| '60' \| 'off' \| 'custom'` | |
| `timerCustomSeconds` | `number?` | Only meaningful when `timerSetting === 'custom'` |
| `difficultyStage` | `DifficultyStageId?` | A–H |
| `enabledOperators` | `Operation[]?` | |
| `allowNegativeTargets` | `boolean?` | |
| `mathRangeMax` | `12 \| 25?` | Derived from `numberRange` |
| `abVariant` | `AbVariant?` | |

> **There is no existing `gameMode` or `botDifficulty` field in `START_GAME`.** M6 will need to add these to both the action type (line 357) and the reducer (line 940+).

### Start button (line 5967)

```tsx
<CasinoButton text={t('start.letsPlay')} width={220} height={48} fontSize={19} onPress={startGame} />
```

Wrapped in:
```tsx
<View style={{ marginTop: 12, alignItems: 'center' }}>
  <CasinoButton text={t('start.letsPlay')} width={220} height={48} fontSize={19} onPress={startGame} />
</View>
```

---

## 6. RTL handling

### Import (line 36)

```tsx
import { LocaleProvider, useLocale } from './src/i18n/LocaleContext';
```

### Access inside StartScreen (line 4644)

```tsx
const { t, isRTL } = useLocale();
```

`isRTL` is destructured directly from the `useLocale()` hook return value.

### Five representative uses of `isRTL`

**1. `flexDirection` flip on setting rows (line 5548):**
```tsx
<View style={[hsS.row, hsS.rowRange, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
```

**2. `textAlign` + `writingDirection` on row labels (line 5549):**
```tsx
<Text style={[hsS.rowLabel, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]}>
  {t('start.wheel.numberRange')}
</Text>
```

**3. `flexDirection` inside the advanced modal header (line 5351):**
```tsx
<View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
```

**4. `LinearGradient` direction flip (line 5878):**
```tsx
start={{ x: isRTL ? 1 : 0, y: 0 }}
end={{ x: isRTL ? 0 : 1, y: 1 }}
```

**5. RTL arrow character on the advanced entry CTA (line 5919):**
```tsx
<Text style={hsS.advancedEntryCtaArrow}>{isRTL ? '‹' : '›'}</Text>
```

### RTL traps

- `hsS.toggleGroup` is `{ direction: 'ltr' }` — this intentionally prevents the option order from flipping under RTL. The first option in the array always renders on the physical left.
- `HorizontalOptionWheel` also hardcodes `direction: 'ltr'` on the scroll container — options are always in LTR physical order.
- StartScreen does **not** use `Switch` anywhere. No Android RTL `Switch` bug to worry about.
- The modal `ScrollView` explicitly sets `direction: isRTL ? 'rtl' : 'ltr'` on both `style` and `contentContainerStyle`.

---

## 7. i18n keys used by StartScreen

### Keys referenced inside StartScreen (lines 4643–6012)

```
start.playerCount
start.playerPlaceholder          (interpolated: { n })
start.wheel.numberRange
start.wheel.timerRow
start.wheel.guidanceRow
start.customTimerMinSec          (interpolated: { min, sec })
start.customTimerSecOnly         (interpolated: { sec })
start.timerPickerSec
start.timerPickerMin
start.timerModalStart
start.letsPlay
start.rulesButton
start.rulesModalTitle
start.catalogTitle
start.welcomeSalinda
start.advancedSetup.entryTitle
start.advancedSetup.entryRowTeaser
start.advancedSetup.entryOpenCta
start.advancedSetup.stagePicker.sectionTitle
start.advancedSetup.stagePicker.intro
start.advancedSetup.stagePicker.detailPlaceholder
start.advancedSetup.stagePicker.currentChoice  (interpolated: { stage })
start.advancedSetup.paywall.title
start.advancedSetup.paywall.body
start.advancedSetup.paywall.ctaPlaceholder
start.advancedSetup.stage.{A-H}.detail        (dynamic key)
start.timerA11y.off
start.timerA11y.sec30
start.timerA11y.min1
start.timerA11y.custom
lobby.off
lobby.timerSec                   (interpolated: { n })
lobby.timerMin
lobby.timerCustom
lobby.fractions
lobby.withFractions
lobby.noFractions
lobby.possibleResults
lobby.show
lobby.hide
lobby.solveExercise
lobby.on
lobby.off
lobby.backToMode
ui.cancel
ui.turnTimerLabel
```

### Where keys are defined

- **English:** `card/shared/i18n/en.ts`
- **Hebrew:** `card/shared/i18n/he.ts`

### Example — `start.letsPlay`

**en.ts (line ~547):**
```ts
'start.letsPlay': "Let's play",
```

**he.ts (line ~551):**
```ts
'start.letsPlay': 'בואו נשחק',
```

### Example — `start.advancedSetup.entryTitle`

**en.ts (line 506):**
```ts
'start.advancedSetup.entryTitle': 'Advanced',
```

**he.ts (line 510):**
```ts
'start.advancedSetup.entryTitle': 'מתקדמים',
```

---

## 8. Keyboard handling

### Does StartScreen use `TextInput`?

**No `TextInput` is rendered inside the StartScreen JSX itself.** `TextInput` appears in `PlayerNameModal` (line 6290), which is a separate function component rendered elsewhere in the game flow.

The **custom timer modal** (lines 5928–5964) uses `ScrollView`-based pickers (not `TextInput`) for selecting minutes/seconds.

### Keyboard handling summary

- **No `Keyboard.dismiss()`** is called inside the StartScreen return JSX or `startGame`. `Keyboard.dismiss()` appears only in `PlayerNameModal` (line 6253).
- **No `KeyboardAvoidingView`** wraps StartScreen's main UI.
- **`keyboardShouldPersistTaps="handled"`** is set on the `advancedSetupOpen` modal's `ScrollView` (line 5423).
- The `timerCustomModalOpen` RNModal uses `ScrollView` snap-pickers (no text input), so no keyboard is involved.
- When toggles unmount rows, there is no `TextInput` to lose focus — no keyboard lingering concern.

---

## 9. Button component used for primary actions

### Primary "Start game" button: `CasinoButton`

**Import (line 26):**
```tsx
import { CasinoButton } from './components/CasinoButton';
```

**Usage (line 5967):**
```tsx
<CasinoButton text={t('start.letsPlay')} width={220} height={48} fontSize={19} onPress={startGame} />
```

### Secondary/utility buttons: `LulosButton`

**Import (line 25):**
```tsx
import { LulosButton } from './components/LulosButton';
```

**Example usage (line 5302):**
```tsx
<LulosButton text={t('start.rulesButton')} color="blue" width={90} height={38} fontSize={13} onPress={() => setRulesOpen(true)} />
```

### In-row toggle buttons: plain `TouchableOpacity` with `hsS.toggleBtn` / `hsS.toggleOn` / `hsS.toggleOff` styles

No custom button component — just `TouchableOpacity` styled with the shared toggle style objects.

---

## 10. Styles reference

The `hsS` stylesheet is defined at **line 6013** of `card/index.tsx`:

```tsx
const hsS = StyleSheet.create({
  // Joker area — flex:1 fills space between top and bottom menu
  jokerArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  // Settings container
  settings: { width: '100%', marginTop: 8 },
  // Setting row — horizontal, label left, controls right
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(10,22,40,0.9)',
    borderRadius: 10,
    marginHorizontal: 2,
    marginBottom: 4,
  },
  rowGradientOuter: {
    borderRadius: 12,
    padding: 1,
    marginHorizontal: 2,
    marginBottom: 4,
  },
  // Google-color rows
  rowPlayers:         { backgroundColor: 'rgba(52,168,83,0.92)' },
  rowRange:           { backgroundColor: 'rgba(26,115,232,0.92)' },
  rowFractions:       { backgroundColor: 'rgba(66,133,244,0.92)' },
  rowPossibleResults: { backgroundColor: 'rgba(234,67,53,0.92)' },
  rowSolveExercise:   { backgroundColor: 'rgba(52,168,83,0.92)' },
  rowTimer:           { backgroundColor: 'rgba(234,67,53,0.92)' },
  rowGuidance:        { backgroundColor: 'rgba(26,115,232,0.92)' },
  timerWheelWrap: { flex: 1, minWidth: 0, marginLeft: 4 },
  rowLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600', flexShrink: 0 },
  rowHint:    { color: 'rgba(255,255,255,0.72)', fontSize: 11, lineHeight: 16, flexShrink: 1 },
  rowSubHint: { color: 'rgba(255,255,255,0.88)', fontSize: 11, lineHeight: 16, flexShrink: 1 },
  // LTR forced — option order never flips under forceRTL
  toggleGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, direction: 'ltr' },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  toggleOn: {
    backgroundColor: '#FBBC05', borderColor: 'rgba(251,188,5,0.5)',
    // iOS shadow + Android elevation 3
  },
  toggleOff: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' },
  toggleOnTxt:  { fontSize: 12, fontWeight: '700', color: '#3c3c00' },
  toggleOffTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, direction: 'ltr' },
  stepBtnWrap: { borderRadius: 10, /* elevation/shadow */ },
  stepBtn: {
    width: 42, height: 58, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: 'rgba(251,188,5,0.5)',
    overflow: 'hidden',
  },
  stepBtnInner: {
    position: 'absolute', top: 4, left: 4, right: 4, bottom: 4,
    borderRadius: 7, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  stepBtnTxt: {
    fontSize: 28, fontWeight: '700', color: '#3c3c00',
    textShadowColor: 'rgba(255,255,255,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0,
  },
  stepVal: {
    fontSize: 26, fontWeight: '700', color: '#FFF', minWidth: 28, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  advancedEntryInner: {
    borderRadius: 11, marginHorizontal: 2, marginBottom: 4,
    paddingVertical: 14, paddingHorizontal: 12,
    backgroundColor: 'rgba(15,23,42,0.58)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  advancedEntryTitle: {
    color: '#FFFFFF', fontSize: 18, fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
  advancedEntryTeaser: {
    color: 'rgba(254,249,195,0.98)', fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 8,
  },
  advancedEntryChipRow: { flexWrap: 'wrap', gap: 5, marginTop: 10, alignItems: 'center' },
  advancedStageChip: {
    width: 24, height: 24, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', opacity: 0.88,
  },
  advancedStageChipActive: {
    borderColor: '#FDE68A', borderWidth: 2, opacity: 1,
    // iOS glow + Android elevation 4
  },
  advancedStageChipTxt:       { fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.92)' },
  advancedStageChipTxtActive: { color: '#FFFFFF' },
  advancedEntryCtaWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 999,
    alignSelf: 'flex-start',
    // iOS shadow + Android elevation 5
  },
  advancedEntryCtaTxt:   { color: '#5b21b6', fontSize: 13, fontWeight: '900' },
  advancedEntryCtaArrow: { color: '#7c3aed', fontSize: 18, fontWeight: '900', marginTop: -1 },
});
```

**Naming convention:** Each new setting row should follow `rowXxx` for the `View` backgroundColor variant and `hsS.row` as the base. New toggle controls should reuse `hsS.toggleGroup`, `hsS.toggleBtn`, `hsS.toggleOn/Off`, and `hsS.toggleOnTxt/OffTxt` verbatim.

---

## Recommended reuses

- **Reuse `hsS.toggleGroup` + `hsS.toggleBtn` / `hsS.toggleOn` / `hsS.toggleOff` for the mode toggle.** The `numberRange` row (lines 5732–5746) is the exact two-option template: `([['pass-and-play', 'Pass and play'], ['vs-bot', 'Play vs Bot']] as const).map(...)`.

- **Reuse the same two-option pattern for the bot difficulty toggle.** Conditionally render the entire `<WheelRow>` only when `gameMode === 'vs-bot'`, identical to how the custom-timer display row is conditionally rendered at line 5835 (`{timer === 'custom' && (...)}`). Increment `guidanceWheelIndex` and `advancedWheelIndex` by 1 when the bot difficulty row is visible.

- **Do NOT add a new modal for "Advanced game settings" — the pattern already exists.** `advancedSetupOpen` opens `AppModal` (line 5327). If the new bot-difficulty row belongs in advanced settings rather than the main wheel, add it inside that `AppModal`'s `ScrollView` following the existing `LinearGradient` + `<View style={[hsS.row, ...]}>` row pattern.

- **Reuse `timerWheelWrap` + `HorizontalOptionWheel` only if the bot difficulty needs more than 2–3 options.** For a simple "Easy / Hard" two-option toggle, `hsS.toggleGroup` is cleaner and consistent with `numberRange`, `fractions`, `showPossibleResults`, and `guidanceOn` rows.

- **Always apply `isRTL ? 'right' : 'left'` to `textAlign` and `writingDirection` on `hsS.rowLabel` instances in the Advanced modal.** In the main wheel rows, `isRTL` is omitted from the row label (see line 5696, 5735) because the `WheelRow` container handles direction. Inside the modal's `ScrollView` (which has `direction: isRTL ? 'rtl' : 'ltr'`), add explicit `textAlign` and `writingDirection` overrides as shown in lines 5549, 5562, 5578, 5598, 5621.
