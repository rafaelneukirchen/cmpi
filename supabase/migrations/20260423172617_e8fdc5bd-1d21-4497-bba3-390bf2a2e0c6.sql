-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.generate_lideranca_token()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_token TEXT;
  exists_check INT;
BEGIN
  LOOP
    new_token := lower(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));
    SELECT count(*) INTO exists_check FROM public.liderancas WHERE token_publico = new_token;
    EXIT WHEN exists_check = 0;
  END LOOP;
  RETURN new_token;
END;
$$;
