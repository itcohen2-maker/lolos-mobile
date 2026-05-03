CREATE OR REPLACE FUNCTION public.consume_slinda()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owned boolean;
BEGIN
  SELECT slinda_owned
    INTO v_owned
    FROM public.profiles
   WHERE id = auth.uid()
   FOR UPDATE;

  IF v_owned IS DISTINCT FROM true THEN
    RETURN 'not_owned';
  END IF;

  UPDATE public.profiles
     SET slinda_owned = false
   WHERE id = auth.uid();

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_slinda() TO authenticated;
