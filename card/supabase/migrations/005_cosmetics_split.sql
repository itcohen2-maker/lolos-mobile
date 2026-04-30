-- Split table theme and table skin into separate ownership/active slots
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS table_skins_owned text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS active_table_theme text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS active_table_skin text;

-- Backfill new active_table_theme from the legacy active_table value when possible.
UPDATE public.profiles
SET active_table_theme = CASE
  WHEN active_table IN ('classic', 'royal', 'forest', 'ocean') THEN active_table
  ELSE 'classic'
END
WHERE active_table_theme IS NULL OR active_table_theme = '';

-- If legacy active_table currently holds a table skin id, preserve it.
UPDATE public.profiles
SET active_table_skin = active_table
WHERE active_table IN ('poker_red', 'poker_gold', 'poker_blue')
  AND (active_table_skin IS NULL OR active_table_skin = '');

CREATE OR REPLACE FUNCTION public.purchase_table_skin(skin_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coins integer;
  v_owned text[];
  valid_skins text[] := ARRAY['poker_red', 'poker_gold', 'poker_blue'];
BEGIN
  IF NOT (skin_id = ANY(valid_skins)) THEN
    RETURN 'invalid_skin';
  END IF;

  SELECT total_coins, table_skins_owned
    INTO v_coins, v_owned
    FROM public.profiles
   WHERE id = auth.uid()
   FOR UPDATE;

  IF skin_id = ANY(v_owned) THEN
    RETURN 'already_owned';
  END IF;

  IF v_coins < 40 THEN
    RETURN 'insufficient_coins';
  END IF;

  UPDATE public.profiles
     SET total_coins = total_coins - 40,
         table_skins_owned = array_append(table_skins_owned, skin_id)
   WHERE id = auth.uid();

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_table_skin(text) TO authenticated, anon;

-- kind = card_back | table_theme | table_skin
CREATE OR REPLACE FUNCTION public.set_active_skin(kind text, theme_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_themes_owned text[];
  v_table_skins_owned text[];
  valid_themes text[] := ARRAY['classic', 'royal', 'forest', 'ocean'];
  valid_skins text[] := ARRAY['poker_red', 'poker_gold', 'poker_blue'];
BEGIN
  IF kind NOT IN ('card_back', 'table_theme', 'table_skin') THEN
    RETURN 'invalid';
  END IF;

  SELECT themes_owned, table_skins_owned
    INTO v_themes_owned, v_table_skins_owned
    FROM public.profiles
   WHERE id = auth.uid()
   FOR UPDATE;

  IF kind = 'card_back' THEN
    IF NOT (theme_id = ANY(valid_themes)) OR NOT (theme_id = ANY(v_themes_owned)) THEN
      RETURN 'not_owned';
    END IF;
    UPDATE public.profiles SET active_card_back = theme_id WHERE id = auth.uid();
    RETURN 'ok';
  END IF;

  IF kind = 'table_theme' THEN
    IF NOT (theme_id = ANY(valid_themes)) OR NOT (theme_id = ANY(v_themes_owned)) THEN
      RETURN 'not_owned';
    END IF;
    UPDATE public.profiles SET active_table_theme = theme_id WHERE id = auth.uid();
    RETURN 'ok';
  END IF;

  IF kind = 'table_skin' THEN
    IF theme_id = 'none' THEN
      UPDATE public.profiles SET active_table_skin = NULL WHERE id = auth.uid();
      RETURN 'ok';
    END IF;
    IF NOT (theme_id = ANY(valid_skins)) OR NOT (theme_id = ANY(v_table_skins_owned)) THEN
      RETURN 'not_owned';
    END IF;
    UPDATE public.profiles SET active_table_skin = theme_id WHERE id = auth.uid();
    RETURN 'ok';
  END IF;

  RETURN 'invalid';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_skin(text, text) TO authenticated, anon;
