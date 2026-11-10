-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.dobradinha_require_vinculo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.lideranca_id IS NULL AND NEW.cabo_id IS NULL AND NEW.coordenador_user_id IS NULL THEN
    RAISE EXCEPTION 'A dobrada precisa estar vinculada a uma liderança, cabo eleitoral ou coordenador.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dobradinha_require_vinculo ON public.dobradinhas;

CREATE TRIGGER trg_dobradinha_require_vinculo
BEFORE INSERT OR UPDATE ON public.dobradinhas
FOR EACH ROW EXECUTE FUNCTION public.dobradinha_require_vinculo();
