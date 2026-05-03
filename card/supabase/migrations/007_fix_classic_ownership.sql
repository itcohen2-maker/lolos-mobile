-- Backfill 'classic' theme into themes_owned for any existing user missing it.
-- Migration 004 set a column DEFAULT but never updated pre-existing rows.
UPDATE profiles
SET themes_owned = array_append(themes_owned, 'classic')
WHERE NOT ('classic' = ANY(COALESCE(themes_owned, ARRAY[]::text[])));

-- Replace set_active_skin with a version that:
--   1. Treats free themes (classic) as always activatable without ownership check
--   2. Guards against NULL arrays with COALESCE
CREATE OR REPLACE FUNCTION public.set_active_skin(kind text, theme_id text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_themes_owned text[];
  v_skins_owned  text[];
  valid_themes   text[] := ARRAY['classic','royal','forest','ocean'];
  valid_skins    text[] := ARRAY['poker_red','poker_gold','poker_blue'];
  free_themes    text[] := ARRAY['classic'];
BEGIN
  IF v_user_id IS NULL THEN RETURN 'error'; END IF;

  SELECT COALESCE(themes_owned, ARRAY[]::text[]),
         COALESCE(table_skins_owned, ARRAY[]::text[])
    INTO v_themes_owned, v_skins_owned
    FROM profiles WHERE id = v_user_id;

  IF kind IN ('card_back', 'table_theme') THEN
    IF theme_id != ALL(valid_themes) THEN RETURN 'invalid'; END IF;
    -- Free themes bypass the ownership check
    IF NOT (theme_id = ANY(free_themes))
       AND NOT (theme_id = ANY(v_themes_owned))
    THEN RETURN 'not_owned'; END IF;

    IF kind = 'card_back' THEN
      UPDATE profiles SET active_card_back  = theme_id WHERE id = v_user_id;
    ELSE
      UPDATE profiles SET active_table_theme = theme_id WHERE id = v_user_id;
    END IF;
    RETURN 'ok';

  ELSIF kind = 'table_skin' THEN
    IF theme_id = 'none' THEN
      UPDATE profiles SET active_table_skin = NULL WHERE id = v_user_id;
      RETURN 'ok';
    END IF;
    IF theme_id != ALL(valid_skins) THEN RETURN 'invalid'; END IF;
    IF NOT (theme_id = ANY(v_skins_owned)) THEN RETURN 'not_owned'; END IF;
    UPDATE profiles SET active_table_skin = theme_id WHERE id = v_user_id;
    RETURN 'ok';

  ELSE
    RETURN 'invalid';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_skin(text, text) TO authenticated, anon;
