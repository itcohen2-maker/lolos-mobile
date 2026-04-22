-- Add ownership column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS slinda_owned boolean NOT NULL DEFAULT false;

-- Atomic purchase RPC:
-- Deducts 100 coins and sets slinda_owned = true.
-- Returns 'ok', 'already_owned', or 'insufficient_coins'.
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
