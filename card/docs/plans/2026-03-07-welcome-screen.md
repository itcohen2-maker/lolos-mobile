# Welcome Screen (TurnTransition Replacement) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the existing `TurnTransition` component with a rich "Welcome to your turn" screen that shows player greeting, last move summary, encouragement, game info, an interactive card fan with tooltips, and a welcome onboarding moment.

**Architecture:** Single component `TurnTransition` rewritten in-place inside `index.tsx` (lines 3162-3219). Uses existing `GameCard` component at 0.7x scale for the card fan. Card tooltips are local state with a positioned popup. Onboarding uses the existing `onbSeen` + AsyncStorage pattern with a new `onb_welcome_screen` key.

**Tech Stack:** React Native, Animated, AsyncStorage, existing GameCard/CasinoButton/LulosButton components.

---

### Task 1: Add `onb_welcome_screen` to ONB_KEYS

**Files:**
- Modify: `index.tsx` line ~3289 (ONB_KEYS array)

**Step 1: Add the key**

Change:
```typescript
const ONB_KEYS = ['onb_game_start', 'onb_fraction', 'onb_op_challenge', 'onb_joker', 'onb_results', 'onb_forward', 'onb_first_discard'] as const;
```
To:
```typescript
const ONB_KEYS = ['onb_game_start', 'onb_fraction', 'onb_op_challenge', 'onb_joker', 'onb_results', 'onb_forward', 'onb_first_discard', 'onb_welcome_screen'] as const;
```

Also add it to the dev reset button's `allKeys` array in `StartScreen` (~line 3049).

**Step 2: Commit**
```
git add index.tsx && git commit -m "feat: add onb_welcome_screen key"
```

---

### Task 2: Rewrite TurnTransition component

**Files:**
- Modify: `index.tsx` lines 3162-3219 (the entire `TurnTransition` function)

**Step 1: Replace the TurnTransition function**

The new component layout (top to bottom inside a ScrollView):

1. **Exit button** (absolute top-right, same as current)
2. **Personal greeting** — "Hey [name]! Your turn" with emoji
3. **Last move summary** — `state.lastMoveMessage` in a styled card (not a CasinoButton - use a display-only View styled like one, since CasinoButton requires onPress)
4. **Encouragement** — feedback card (reuse the existing `fbType`/`fbEmoji`/`fbTitle` logic already in current TurnTransition)
5. **Game info bar** — row of small badges: timer setting, fractions on/off, card count
6. **Card fan** — horizontal ScrollView of the player's cards at `small` size, each tappable to show tooltip
7. **Card tooltip** — absolute-positioned popup above tapped card with explanation text
8. **Welcome onboarding banner** — shown once ever via `onb_welcome_screen`, animated intro text above card fan
9. **"I'm ready" button** — CasinoButton at bottom

**Key implementation details:**

- Card fan: Use `<GameCard card={c} small onPress={() => setTooltipCard(c)} />` for each card in `cp.hand`
- Tooltip state: `const [tooltipCard, setTooltipCard] = useState<Card | null>(null)`
- Tooltip text map:
  - `number` -> "card number - place it to solve the equation"
  - `fraction` -> "fraction card - worth half! place on discard pile on your turn"
  - `operation` -> "operation card - place in equation to challenge next player!"
  - `joker` -> "joker - special card! choose any number you want"
- Dismiss tooltip: wrap entire component in a Pressable/TouchableWithoutFeedback that clears tooltipCard, or tap same card again
- Welcome onboarding: check `onbSeen.current.has('onb_welcome_screen')` — if not seen, show animated banner. On dismiss or after 6s auto-dismiss, mark as seen via AsyncStorage.
- Since this component renders during `turn-transition` phase (NOT inside GameScreen), it does NOT have access to the GameScreen's `onbSeen` ref. It must do its own AsyncStorage check.

**Complete replacement code:**

```tsx
function TurnTransition() {
  const { state, dispatch } = useGame();
  const cp = state.players[state.currentPlayerIndex];
  const [tooltipCard, setTooltipCard] = useState<Card | null>(null);

  // Welcome onboarding — first time ever
  const [welcomeSeen, setWelcomeSeen] = useState(true); // default hidden
  const [welcomeLoaded, setWelcomeLoaded] = useState(false);
  const welcomeY = useRef(new Animated.Value(-80)).current;
  useEffect(() => {
    AsyncStorage.getItem('onb_welcome_screen').then(v => {
      if (v !== 'true') setWelcomeSeen(false);
      setWelcomeLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (welcomeLoaded && !welcomeSeen) {
      Animated.spring(welcomeY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
      const t = setTimeout(() => {
        AsyncStorage.setItem('onb_welcome_screen', 'true');
        Animated.timing(welcomeY, { toValue: -80, duration: 200, useNativeDriver: true }).start(() => setWelcomeSeen(true));
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [welcomeLoaded, welcomeSeen]);
  const dismissWelcome = () => {
    AsyncStorage.setItem('onb_welcome_screen', 'true');
    Animated.timing(welcomeY, { toValue: -80, duration: 200, useNativeDriver: true }).start(() => setWelcomeSeen(true));
  };

  // Feedback from last move
  const msg = state.lastMoveMessage;
  const fbType = msg?.startsWith('✅') ? 'success'
    : msg?.startsWith('⚔️') ? 'challenge'
    : msg?.startsWith('🔄') ? 'identical'
    : msg?.startsWith('📥') ? 'draw'
    : null;

  // Tooltip text per card type
  const getTooltip = (card: Card): string => {
    switch (card.type) {
      case 'number': return `קלף מספר (${card.value}) — הנח אותו בתרגיל כדי לפתור את המשוואה`;
      case 'fraction': return `קלף שבר (${card.fraction}) — שווה חצי! שים אותו על ערימת ההשלכה בתור שלך`;
      case 'operation': return `קלף פעולה (${card.operation}) — הנח אותו בתרגיל כדי לאתגר את השחקן הבא!`;
      case 'joker': return `ג'וקר — קלף מיוחד! בחר כל מספר שתרצה`;
    }
  };

  return (
    <View style={{flex:1}}>
      {/* Exit button */}
      <View style={{position:'absolute',top:54,right:20,zIndex:10}}>
        <LulosButton text="יציאה" color="red" width={100} height={44} onPress={()=>dispatch({type:'RESET_GAME'})} />
      </View>

      {/* Main content */}
      <ScrollView contentContainerStyle={{paddingTop:80,paddingBottom:120,paddingHorizontal:24,alignItems:'center',gap:16}} showsVerticalScrollIndicator={false}>

        {/* 1. Personal greeting */}
        <Text style={{color:'#FFD700',fontSize:24,fontWeight:'900',textAlign:'center'}}>
          היי {cp?.name}! התור שלך
        </Text>

        {/* 2. Last move summary */}
        {!!state.lastMoveMessage && (
          <View style={{backgroundColor:'rgba(30,41,59,0.85)',borderRadius:14,paddingHorizontal:18,paddingVertical:12,borderWidth:1.5,borderColor:'rgba(255,215,0,0.3)',width:'100%',maxWidth:320}}>
            <Text style={{color:'#FDE68A',fontSize:14,fontWeight:'700',textAlign:'center',lineHeight:21}}>{state.lastMoveMessage}</Text>
          </View>
        )}

        {/* 3. Encouragement / challenge message */}
        {!!state.message && (
          <View style={{backgroundColor:'rgba(30,41,59,0.85)',borderRadius:14,paddingHorizontal:18,paddingVertical:12,borderWidth:1.5,borderColor:'rgba(167,139,250,0.3)',width:'100%',maxWidth:320}}>
            <Text style={{color:'#C4B5FD',fontSize:14,fontWeight:'700',textAlign:'center',lineHeight:20}}>{state.message}</Text>
          </View>
        )}

        {/* 4. Game info bar */}
        <View style={{flexDirection:'row',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(255,255,255,0.08)',borderRadius:8,paddingHorizontal:10,paddingVertical:5}}>
            <Text style={{fontSize:12}}>🃏</Text>
            <Text style={{color:'#D1D5DB',fontSize:12,fontWeight:'700'}}>{cp?.hand.length} קלפים</Text>
          </View>
          <View style={{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(255,255,255,0.08)',borderRadius:8,paddingHorizontal:10,paddingVertical:5}}>
            <Text style={{fontSize:12}}>{state.timerSetting === 'off' ? '⏸️' : '⏱️'}</Text>
            <Text style={{color:'#D1D5DB',fontSize:12,fontWeight:'700'}}>{state.timerSetting === 'off' ? 'ללא טיימר' : `${state.timerSetting} שנ׳`}</Text>
          </View>
          {state.showFractions && (
            <View style={{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(255,255,255,0.08)',borderRadius:8,paddingHorizontal:10,paddingVertical:5}}>
              <Text style={{fontSize:12}}>½</Text>
              <Text style={{color:'#D1D5DB',fontSize:12,fontWeight:'700'}}>שברים</Text>
            </View>
          )}
        </View>

        {/* 5. Welcome onboarding banner (first time only) */}
        {!welcomeSeen && welcomeLoaded && (
          <Animated.View style={{transform:[{translateY:welcomeY}],backgroundColor:'rgba(255,215,0,0.1)',borderRadius:12,borderWidth:1.5,borderColor:'rgba(255,215,0,0.3)',padding:14,width:'100%',maxWidth:320}}>
            <Text style={{color:'#FFD700',fontSize:15,fontWeight:'900',textAlign:'center',marginBottom:4}}>ברוך הבא למשחק!</Text>
            <Text style={{color:'#E2E8F0',fontSize:13,fontWeight:'600',textAlign:'center',lineHeight:20}}>הנה הקלפים שלך — לחץ על קלף כדי ללמוד עליו</Text>
            <TouchableOpacity onPress={dismissWelcome} style={{alignSelf:'center',marginTop:8}}>
              <Text style={{color:'rgba(255,255,255,0.4)',fontSize:12,fontWeight:'600'}}>הבנתי</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* 6. Card fan */}
        <View style={{width:'100%'}}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingHorizontal:8,paddingVertical:8,justifyContent:'center',minWidth:'100%'}}>
            {cp?.hand.map(c => (
              <View key={c.id} style={{alignItems:'center'}}>
                <View style={{transform:[{scale:0.7}],marginHorizontal:-15}}>
                  <GameCard card={c} small onPress={() => setTooltipCard(prev => prev?.id === c.id ? null : c)} />
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* 7. Card tooltip */}
        {tooltipCard && (
          <TouchableOpacity activeOpacity={1} onPress={() => setTooltipCard(null)} style={{width:'100%',maxWidth:320}}>
            <View style={{backgroundColor:'rgba(15,23,42,0.95)',borderRadius:12,borderWidth:1.5,borderColor:'rgba(255,215,0,0.4)',padding:14}}>
              <Text style={{color:'#E2E8F0',fontSize:14,fontWeight:'600',textAlign:'center',lineHeight:22}}>{getTooltip(tooltipCard)}</Text>
            </View>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* 8. "I'm ready" button — pinned to bottom */}
      <View style={{position:'absolute',bottom:40,left:20,right:20,alignItems:'center'}}>
        <CasinoButton text="אני מוכן/ה" width={220} height={48} fontSize={19} onPress={()=>dispatch({type:'BEGIN_TURN'})} />
      </View>
    </View>
  );
}
```

**Step 2: Verify no TypeScript errors**
```
npx tsc --noEmit --skipLibCheck 2>&1 | grep index.tsx
```

**Step 3: Commit**
```
git add index.tsx && git commit -m "feat: rewrite TurnTransition as welcome screen with card fan + tooltips + onboarding"
```

---

### Task 3: Update dev reset button

**Files:**
- Modify: `index.tsx` — the `allKeys` array in the long-press handler on StartScreen

**Step 1: Add `onb_welcome_screen` to the reset list**

Find the `allKeys` array in the long-press handler and add `'onb_welcome_screen'` to it.

**Step 2: Commit**
```
git add index.tsx && git commit -m "feat: add onb_welcome_screen to dev reset"
```

---

### Execution Notes

- All changes are in `index.tsx` — no new files needed
- The `GameCard` component already supports `small` prop and `onPress`
- `useState<Card | null>` for tooltip is local to TurnTransition, no reducer changes
- The `onb_welcome_screen` AsyncStorage check is self-contained inside TurnTransition (not shared with GameScreen's onbSeen ref since they're different render trees)
- The card fan uses `transform:[{scale:0.7}]` with negative horizontal margins to keep cards close together
- Tooltip dismisses on tap (either tap the tooltip or tap another card)
