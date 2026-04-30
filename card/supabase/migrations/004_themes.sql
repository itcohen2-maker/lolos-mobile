-- Add theme ownership columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS themes_owned text[] NOT NULL DEFAULT ARRAY['classic'],
  ADD COLUMN IF NOT EXISTS active_card_back text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS active_table text NOT NULL DEFAULT 'classic';

-- Atomic purchase RPC:
-- Deducts 50 coins and adds theme_id to themes_owned.
-- Returns 'ok', 'already_owned', 'insufficient_coins', 'invalid_theme', or 'error'.
CREATE OR REPLACE FUNCTION public.purchase_theme(theme_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coins integer;
  v_owned text[];
  valid_themes text[] := ARRAY['classic', 'royal', 'forest', 'ocean'];
BEGIN
  IF NOT (theme_id = ANY(valid_themes)) THEN
    RETURN 'invalid_theme';
  END IF;

  SELECT total_coins, themes_owned
    INTO v_coins, v_owned
    FROM public.profiles
   WHERE id = auth.uid()
   FOR UPDATE;

  IF theme_id = ANY(v_owned) THEN
    RETURN 'already_owned';
  END IF;

  IF v_coins < 50 THEN
    RETURN 'insufficient_coins';
  END IF;

  UPDATE public.profiles
     SET total_coins   = total_coins - 50,
         themes_owned  = array_append(themes_owned, theme_id)
   WHERE id = auth.uid();

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_theme(text) TO authenticated, anon;

-- Set active skin RPC (card_back or table):
-- Returns 'ok', 'not_owned', 'invalid', or 'error'.
CREATE OR REPLACE FUNCTION public.set_active_skin(kind text, theme_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owned text[];
  valid_themes text[] := ARRAY['classic', 'royal', 'forest', 'ocean'];
BEGIN
  IF kind NOT IN ('card_back', 'table') THEN
    RETURN 'invalid';
  END IF;

  IF NOT (theme_id = ANY(valid_themes)) THEN
    RETURN 'invalid';
  END IF;

  SELECT themes_owned
    INTO v_owned
    FROM public.profiles
   WHERE id = auth.uid()
   FOR UPDATE;

  IF NOT (theme_id = ANY(v_owned)) THEN
    RETURN 'not_owned';
  END IF;

  IF kind = 'card_back' THEN
    UPDATE public.profiles SET active_card_back = theme_id WHERE id = auth.uid();
  ELSE
    UPDATE public.profiles SET active_table = theme_id WHERE id = auth.uid();
  END IF;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_skin(text, text) TO authenticated, anon;
