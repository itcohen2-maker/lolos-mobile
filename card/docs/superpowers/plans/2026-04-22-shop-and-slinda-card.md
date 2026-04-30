# Shop & Slinda Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a purchasable Slinda (joker) card via an in-game shop, a coin-award animation when the excellence meter fills, and an in-game bank button so owners can add the Slinda card to their hand at any time.

**Architecture:** Three new surfaces — (1) a `ShopScreen` modal accessible from the choice screen and start screen, (2) a persistent in-game "bank" button for owned Slinda card, and (3) an enhanced +5-coin notification when the excellence meter resets. Ownership is persisted in Supabase `profiles.slinda_owned`; purchasing deducts coins via an atomic Postgres RPC.

**Tech Stack:** React Native / Expo, Supabase (Postgres RPC + client SDK), TypeScript, existing `SlindaCoin` component, existing `useAuth` / `PlayerProfile` pattern.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260422_slinda_owned.sql` | Create | Add `slinda_owned` column + `purchase_slinda` RPC |
| `src/hooks/useAuth.tsx` | Modify | Add `slinda_owned` to `PlayerProfile`; expose `purchaseSlinda()` |
| `shared/i18n/en.ts` | Modify | Add shop + slinda bank strings |
| `shared/i18n/he.ts` | Modify | Add shop + slinda bank strings (Hebrew) |
| `src/screens/ShopScreen.tsx` | Create | Shop modal: animated coin header, items list, purchase flow |
| `index.tsx` | Modify | (1) Shop button in `PlayModeChoiceScreen`; (2) `lastCourageCoinsAwarded` flag in `GameState` + reducer; (3) +5-coin notification; (4) Slinda bank button in `GameScreen` |

---

## Task 1: Supabase migration — `slinda_owned` column + `purchase_slinda` RPC

**Files:**
- Create: `supabase/migrations/20260422_slinda_owned.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260422_slinda_owned.sql

-- 1. Add ownership column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS slinda_owned boolean NOT NULL DEFAULT false;

-- 2. Atomic purchase RPC:
--    Deducts 100 coins and sets slinda_owned = true.
--    Returns 'ok', 'already_owned', or 'insufficient_coins'.
CREATE OR REPLACE FUNCTION public.purchase_slinda()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coins integer;
  v_owned boolean;
BEGIN
  SELECT total_coins, slinda_owned
    INTO v_coins, v_owned
    FROM public.profiles
   WHERE id = auth.uid()
   FOR UPDATE;

  IF v_owned THEN
    RETURN 'already_owned';
  END IF;

  IF v_coins < 100 THEN
    RETURN 'insufficient_coins';
  END IF;

  UPDATE public.profiles
     SET total_coins  = total_coins - 100,
         slinda_owned = true
   WHERE id = auth.uid();

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_slinda() TO authenticated, anon;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Run the SQL above using `mcp__supabase__apply_migration` with name `slinda_owned`.

- [ ] **Step 3: Verify column exists**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'slinda_owned';
```
Expected: one row — `slinda_owned | boolean | false`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260422_slinda_owned.sql
git commit -m "feat(db): add slinda_owned to profiles + purchase_slinda RPC"
```

---

## Task 2: Update `PlayerProfile` type + add `purchaseSlinda` to `useAuth`

**Files:**
- Modify: `src/hooks/useAuth.tsx`

- [ ] **Step 1: Add `slinda_owned` to `PlayerProfile` interface**

In `src/hooks/useAuth.tsx`, change:
```typescript
export interface PlayerProfile {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  abandons: number;
  total_coins: number;
  created_at: string;
}
```
To:
```typescript
export interface PlayerProfile {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  abandons: number;
  total_coins: number;
  slinda_owned: boolean;
  created_at: string;
}
```

- [ ] **Step 2: Add `purchaseSlinda` to `AuthContextValue`**

Change the interface:
```typescript
interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: PlayerProfile | null;
  loading: boolean;
  isAnonymous: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Purchase the Slinda card for 100 coins. Returns 'ok', 'already_owned', or 'insufficient_coins'. */
  purchaseSlinda: () => Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'error'>;
}
```

- [ ] **Step 3: Implement `purchaseSlinda` inside `AuthProvider`**

Add before the `return` statement in `AuthProvider`:
```typescript
const purchaseSlinda = useCallback(async (): Promise<'ok' | 'already_owned' | 'insufficient_coins' | 'error'> => {
  try {
    const { data, error } = await supabase.rpc('purchase_slinda');
    if (error) return 'error';
    const result = data as string;
    if (result === 'ok') await refreshProfile();
    return result as 'ok' | 'already_owned' | 'insufficient_coins';
  } catch {
    return 'error';
  }
}, [refreshProfile]);
```

- [ ] **Step 4: Add `purchaseSlinda` to the context value**

In the `<AuthContext.Provider value={{ ... }}>`, add:
```typescript
purchaseSlinda,
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAuth.tsx
git commit -m "feat(auth): add slinda_owned to PlayerProfile + purchaseSlinda RPC hook"
```

---

## Task 3: i18n strings

**Files:**
- Modify: `shared/i18n/en.ts`
- Modify: `shared/i18n/he.ts`

- [ ] **Step 1: Add English strings to `shared/i18n/en.ts`**

Find the section near `'auth.linkSubtitle'` and add:
```typescript
  // Shop
  'shop.title': 'Shop',
  'shop.coinBalance': 'Your coins: {{count}}',
  'shop.slindaCard.name': 'Slinda Card',
  'shop.slindaCard.description': 'A wild joker card. Add it to your hand at any time during any game — forever.',
  'shop.slindaCard.price': '100 coins',
  'shop.buyButton': 'Buy',
  'shop.ownedButton': 'Owned ✓',
  'shop.insufficientCoins': 'Not enough coins',
  'shop.purchaseSuccess': 'Slinda card added to your bank!',
  'shop.purchaseError': 'Purchase failed, please try again.',
  'shop.openShop': 'Shop',
  // In-game Slinda bank
  'slindaBank.addToHand': '+ Slinda',
  'slindaBank.tooltip': 'Add Slinda card to your hand',
  // Coin award notification (5 coins)
  'courage.coinAward.title': '⭐ +5 Coins!',
  'courage.coinAward.body': 'Excellence meter full — you earned 5 coins!',
```

- [ ] **Step 2: Add Hebrew strings to `shared/i18n/he.ts`**

Find the matching section and add:
```typescript
  // Shop
  'shop.title': 'חנות',
  'shop.coinBalance': 'המטבעות שלך: {{count}}',
  'shop.slindaCard.name': 'קלף סלינדה',
  'shop.slindaCard.description': 'קלף ג\'וקר קסם. הוסף אותו ליד שלך בכל זמן שתרצה, בכל משחק — לצמיתות.',
  'shop.slindaCard.price': '100 מטבעות',
  'shop.buyButton': 'קנה',
  'shop.ownedButton': 'ברשותך ✓',
  'shop.insufficientCoins': 'אין מספיק מטבעות',
  'shop.purchaseSuccess': 'קלף סלינדה נוסף לבנק שלך!',
  'shop.purchaseError': 'הרכישה נכשלה, נסה שוב.',
  'shop.openShop': 'חנות',
  // In-game Slinda bank
  'slindaBank.addToHand': '+ סלינדה',
  'slindaBank.tooltip': 'הוסף קלף סלינדה ליד',
  // Coin award notification (5 coins)
  'courage.coinAward.title': '⭐ +5 מטבעות!',
  'courage.coinAward.body': 'מד ההצטיינות התמלא — הרווחת 5 מטבעות!',
```

- [ ] **Step 3: Commit**

```bash
git add shared/i18n/en.ts shared/i18n/he.ts
git commit -m "feat(i18n): add shop, slinda bank, and coin award strings"
```

---

## Task 4: `ShopScreen` component

**Files:**
- Create: `src/screens/ShopScreen.tsx`

- [ ] **Step 1: Create `ShopScreen.tsx`**

```typescript
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal,
} from 'react-native';
import { SlindaCoin } from '../../components/SlindaCoin';
import { useAuth } from '../hooks/useAuth';
import { useLocale } from '../../src/i18n/useLocale';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ShopScreen({ visible, onClose }: Props) {
  const { t } = useLocale();
  const { profile, purchaseSlinda } = useAuth();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const slindaOwned = profile?.slinda_owned ?? false;
  const coins = profile?.total_coins ?? 0;

  async function handleBuySlinda() {
    if (slindaOwned || loading) return;
    setLoading(true);
    setFeedback(null);
    const result = await purchaseSlinda();
    setLoading(false);
    if (result === 'ok') {
      setFeedback(t('shop.purchaseSuccess'));
    } else if (result === 'insufficient_coins') {
      setFeedback(t('shop.insufficientCoins'));
    } else if (result === 'already_owned') {
      setFeedback(t('shop.ownedButton'));
    } else {
      setFeedback(t('shop.purchaseError'));
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <SlindaCoin size={40} spin />
            <Text style={styles.title}>{t('shop.title')}</Text>
            <SlindaCoin size={40} spin />
          </View>

          {/* Coin balance */}
          <View style={styles.balanceRow}>
            <SlindaCoin size={18} />
            <Text style={styles.balanceText}>
              {t('shop.coinBalance', { count: String(coins) })}
            </Text>
          </View>

          {/* Slinda card item */}
          <View style={styles.itemCard}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{t('shop.slindaCard.name')}</Text>
              <Text style={styles.itemDesc}>{t('shop.slindaCard.description')}</Text>
              <View style={styles.priceRow}>
                <SlindaCoin size={16} />
                <Text style={styles.priceText}>{t('shop.slindaCard.price')}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.buyBtn, slindaOwned && styles.ownedBtn]}
              onPress={handleBuySlinda}
              disabled={slindaOwned || loading}
            >
              {loading
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.buyBtnText}>
                    {slindaOwned ? t('shop.ownedButton') : t('shop.buyButton')}
                  </Text>
              }
            </TouchableOpacity>
          </View>

          {/* Feedback message */}
          {!!feedback && (
            <Text style={styles.feedback}>{feedback}</Text>
          )}

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#0f2840',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FCD34D',
    padding: 24,
    width: 320,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FCD34D',
    letterSpacing: 1,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  balanceText: {
    color: '#FDE68A',
    fontSize: 15,
    fontWeight: '700',
  },
  itemCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  itemDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  priceText: {
    color: '#FCD34D',
    fontSize: 13,
    fontWeight: '700',
  },
  buyBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  ownedBtn: {
    backgroundColor: '#374151',
  },
  buyBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  feedback: {
    color: '#FDE68A',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  closeBtn: {
    marginTop: 8,
    padding: 8,
  },
  closeBtnText: {
    color: '#9CA3AF',
    fontSize: 18,
  },
});
```

- [ ] **Step 2: Verify import paths**

`SlindaCoin` is at `../../components/SlindaCoin` relative to `src/screens/ShopScreen.tsx`. Check that `useLocale` import path matches the existing pattern in other screens — look at `src/screens/AuthScreen.tsx` to confirm.

- [ ] **Step 3: Commit**

```bash
git add src/screens/ShopScreen.tsx
git commit -m "feat(shop): add ShopScreen modal with animated coin header and Slinda card item"
```

---

## Task 5: Shop navigation — button in `PlayModeChoiceScreen` and `StartScreen`

**Files:**
- Modify: `index.tsx` (two locations)

### 5a — `PlayModeChoiceScreen`

- [ ] **Step 1: Add `onShop` prop to `PlayModeChoiceScreen`**

Change the function signature:
```typescript
function PlayModeChoiceScreen({
  onLocal,
  onOnline,
  onHowToPlay,
  onShop,
  preferredName,
  onPreferredNameChange,
}: {
  onLocal: () => void;
  onOnline: () => void;
  onHowToPlay: () => void;
  onShop: () => void;
  preferredName: string;
  onPreferredNameChange: (name: string) => void;
}) {
```

- [ ] **Step 2: Add Shop button + coin display inside `PlayModeChoiceScreen`**

After the "How to Play" `LulosButton`, add:
```typescript
      <LulosButton
        text={t('shop.openShop')}
        color="yellow"
        width={280}
        height={48}
        fontSize={15}
        onPress={onShop}
        style={{ marginTop: 12 }}
      />
```

Also add coin balance display above the name input (requires `useAuth`). Add at top of the function body:
```typescript
  const { profile } = useAuth();
```

And after the `<Text>{t('mode.howToPlay')}</Text>`, add:
```typescript
      {profile && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <SlindaCoin size={18} />
          <Text style={{ color: '#FDE68A', fontSize: 14, fontWeight: '700' }}>
            {profile.total_coins}
          </Text>
        </View>
      )}
```

Add imports at the top of `index.tsx` (they already exist — `SlindaCoin` is already imported at line 39).

- [ ] **Step 3: Thread `ShopScreen` state in `GameRouter`**

In `GameRouter`, add state:
```typescript
const [showShop, setShowShop] = useState(false);
```

And add import at top of file:
```typescript
import { ShopScreen } from './src/screens/ShopScreen';
```

- [ ] **Step 4: Pass `onShop` to `PlayModeChoiceScreen` and render `ShopScreen`**

Change the `<PlayModeChoiceScreen ...>` call (around line 14591) to:
```typescript
    screen = (
      <PlayModeChoiceScreen
        onLocal={() => setPlayMode('local')}
        onOnline={() => setPlayMode('online')}
        onHowToPlay={() => setPlayMode('tutorial')}
        onShop={() => setShowShop(true)}
        preferredName={preferredName}
        onPreferredNameChange={setPreferredName}
      />
    );
```

In the `return` of `GameRouter` (after the `{screen}` render), add:
```typescript
      <ShopScreen visible={showShop} onClose={() => setShowShop(false)} />
```

### 5b — `StartScreen` (accessible before a local game starts)

- [ ] **Step 5: Add Shop button to `StartScreen`**

Find the `StartScreen` component (it renders when `state.phase === 'setup'`). Add `onShop` prop and a Shop button inside it — near the top-right area, render a small shop button:

Find the `StartScreen` function signature and add `onShop?: () => void` to its props. Add a `TouchableOpacity` button in the top-right corner:
```typescript
{onShop && (
  <TouchableOpacity
    onPress={onShop}
    style={{ position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(252,211,77,0.15)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#FCD34D' }}
  >
    <SlindaCoin size={16} />
    <Text style={{ color: '#FCD34D', fontSize: 13, fontWeight: '800' }}>{t('shop.openShop')}</Text>
  </TouchableOpacity>
)}
```

Pass `onShop` from `GameRouter` where `StartScreen` is rendered (two call sites around line 14600 and 14614):
```typescript
screen = <StartScreen onBackToChoice={() => setPlayMode('choose')} onHowToPlay={() => setPlayMode('tutorial')} onShop={() => setShowShop(true)} preferredName={preferredName} />;
```

- [ ] **Step 6: Commit**

```bash
git add index.tsx
git commit -m "feat(shop): add shop button to choice screen and start screen"
```

---

## Task 6: In-game Slinda bank button

**Files:**
- Modify: `index.tsx` (GameState type + reducer + GameScreen render)

The bank button shows during a local game when `profile.slinda_owned === true`. Pressing it adds a joker card to the current player's hand.

- [ ] **Step 1: Add `ADD_SLINDA_TO_HAND` action type**

Find the `GameAction` union type (around line 620) and add:
```typescript
  | { type: 'ADD_SLINDA_TO_HAND' }
```

- [ ] **Step 2: Handle `ADD_SLINDA_TO_HAND` in `gameReducer`**

After the `case 'CLOSE_JOKER_MODAL':` case (around line 1940), add:
```typescript
    case 'ADD_SLINDA_TO_HAND': {
      const cpIdx = st.currentPlayerIndex;
      const newCard: Card = { id: makeId(), type: 'joker' };
      const updatedPlayers = st.players.map((p, i) =>
        i === cpIdx ? { ...p, hand: [...p.hand, newCard] } : p,
      );
      return { ...st, players: updatedPlayers };
    }
```

- [ ] **Step 3: Add the Slinda bank button to `GameScreen`**

Find the main `GameScreen` component render. Near the excellence meter display (around line 10240), add the bank button — only shown when:
- `profile?.slinda_owned === true`
- Current player is not a bot
- Phase is `'pre-roll'`, `'roll-dice'`, or `'building'`

At the top of `GameScreen`, get auth context:
```typescript
const { profile } = useAuth();
```

Then in the JSX, after the excellence meter section, add:
```typescript
{profile?.slinda_owned && !state.isTutorial && !isOnlineSpectator &&
 (state.phase === 'pre-roll' || state.phase === 'roll-dice' || state.phase === 'building') && (
  <TouchableOpacity
    onPress={() => dispatch({ type: 'ADD_SLINDA_TO_HAND' })}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(234,179,8,0.18)',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: '#EAB308',
      alignSelf: 'center',
      marginBottom: 6,
    }}
  >
    <SlindaCoin size={18} />
    <Text style={{ color: '#FCD34D', fontSize: 13, fontWeight: '800' }}>
      {t('slindaBank.addToHand')}
    </Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 4: Commit**

```bash
git add index.tsx
git commit -m "feat(game): add Slinda bank button — owners can add joker card to hand at any time"
```

---

## Task 7: +5 coins animated notification when excellence meter fills

**Files:**
- Modify: `index.tsx` (GameState + reducer + notification render)

Currently `lastCourageRewardReason` is set on every meter step. We need a separate flag for when the meter **fills** (5 coins awarded) to show a distinct animated coin notification.

- [ ] **Step 1: Add `lastCourageCoinsAwarded` to `GameState`**

Find the `GameState` interface (around line 220) and add:
```typescript
  /** True for exactly one turn after the excellence meter fills and grants 5 coins. */
  lastCourageCoinsAwarded: boolean;
```

- [ ] **Step 2: Initialize it in `initialState`**

Find `initialState` (around line 1153) and add:
```typescript
  lastCourageCoinsAwarded: false,
```

- [ ] **Step 3: Set it in `applyCourageStepReward`**

Find `applyCourageStepReward` (around line 1303). Change the return to include the flag:
```typescript
  return {
    ...st,
    courageMeterStep: isFull ? 0 : nextStep,
    courageMeterPercent: isFull ? 0 : nextPercent,
    courageDiscardSuccessStreak: 0,
    courageRewardPulseId: (st.courageRewardPulseId ?? 0) + 1,
    courageCoins: (st.courageCoins ?? 0) + (isFull ? 5 : 0),
    lastCourageRewardReason: reason,
    lastCourageCoinsAwarded: isFull,
  };
```

- [ ] **Step 4: Clear it in `BEGIN_TURN` / turn transitions**

Find the places where `lastCourageRewardReason: null` is set (lines ~1509, ~1527, ~1531) and add `lastCourageCoinsAwarded: false` alongside each one.

- [ ] **Step 5: Add the +5 coin notification bubble**

Find the existing `lastCourageRewardReason` notification block (around line 10401). Immediately **below** it, add:
```typescript
{!!state.lastCourageCoinsAwarded && !state.players[lastPlayerIndex]?.isBot && !state.isTutorial && (
  <View style={{ alignSelf: 'center', marginBottom: 8, maxWidth: 360, width: '100%', alignItems: 'center' }}>
    <View style={[alertBubbleStyle.box, { paddingVertical: 12, paddingHorizontal: 20, maxWidth: 340, backgroundColor: '#854D0E', borderColor: '#FDE68A', borderWidth: 3, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
      <SlindaCoin size={28} spin pulseKey={state.courageRewardPulseId} />
      <View style={{ flex: 1 }}>
        <Text style={[alertBubbleStyle.title, { fontSize: 18, color: '#FEF3C7', marginBottom: 2 }]}>
          {t('courage.coinAward.title')}
        </Text>
        <Text style={{ color: '#FDE68A', fontSize: 13 }}>
          {t('courage.coinAward.body')}
        </Text>
      </View>
    </View>
  </View>
)}
```

- [ ] **Step 6: Commit**

```bash
git add index.tsx
git commit -m "feat(game): show animated +5 coins notification when excellence meter fills"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|-------------|------|
| Buy Slinda card for 100 coins | Tasks 1, 2, 4 |
| Coins via tutorial (already works) | — |
| Excellence meter fills → 5 coins (already works) | — |
| Animated icon/notification when 5 coins awarded | Task 7 |
| Shop accessible from login/choice screen | Task 5a |
| Shop accessible from user screen (StartScreen) | Task 5b |
| Slinda card in user's bank (persistent) | Tasks 1, 2 |
| Add Slinda to hand at any time | Task 6 |
| Card always available to add to hand | Task 6 (no limit on uses) |
| Shop header: SlindaCoin 40×40 spinning | Task 4 |

### No placeholders found ✓

### Type consistency check

- `PlayerProfile.slinda_owned: boolean` — defined Task 2, used Task 4 (ShopScreen) and Task 6 (bank button) ✓
- `GameAction 'ADD_SLINDA_TO_HAND'` — defined Task 6 Step 1, handled Step 2, dispatched Step 3 ✓
- `GameState.lastCourageCoinsAwarded: boolean` — defined Task 7 Step 1, initialized Step 2, set Step 3, cleared Step 4, rendered Step 5 ✓
- `purchaseSlinda()` — defined Task 2, called Task 4 ✓
