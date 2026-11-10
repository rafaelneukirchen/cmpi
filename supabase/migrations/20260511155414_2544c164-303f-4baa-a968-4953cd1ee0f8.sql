-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(regexp_replace(coalesce(p,''), '\D', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.check_lideranca_phone_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel text;
  v_wa text;
  v_dup text;
BEGIN
  v_tel := public.normalize_phone(NEW.telefone);
  v_wa := public.normalize_phone(NEW.whatsapp);

  IF v_tel IS NOT NULL AND length(v_tel) >= 10 THEN
    IF EXISTS (
      SELECT 1 FROM public.liderancas
      WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND (public.normalize_phone(telefone) = v_tel OR public.normalize_phone(whatsapp) = v_tel)
    ) OR EXISTS (
      SELECT 1 FROM public.eleitores_captados
      WHERE public.normalize_phone(telefone) = v_tel
    ) THEN
      RAISE EXCEPTION 'Telefone % já cadastrado no sistema.', NEW.telefone USING ERRCODE = '23505';
    END IF;
  END IF;

  IF v_wa IS NOT NULL AND length(v_wa) >= 10 AND v_wa <> COALESCE(v_tel,'') THEN
    IF EXISTS (
      SELECT 1 FROM public.liderancas
      WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND (public.normalize_phone(telefone) = v_wa OR public.normalize_phone(whatsapp) = v_wa)
    ) OR EXISTS (
      SELECT 1 FROM public.eleitores_captados
      WHERE public.normalize_phone(telefone) = v_wa
    ) THEN
      RAISE EXCEPTION 'WhatsApp % já cadastrado no sistema.', NEW.whatsapp USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lideranca_phone_unique ON public.liderancas;

CREATE TRIGGER trg_lideranca_phone_unique
BEFORE INSERT OR UPDATE OF telefone, whatsapp ON public.liderancas
FOR EACH ROW EXECUTE FUNCTION public.check_lideranca_phone_unique();

CREATE OR REPLACE FUNCTION public.check_eleitor_phone_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel text;
BEGIN
  v_tel := public.normalize_phone(NEW.telefone);
  IF v_tel IS NOT NULL AND length(v_tel) >= 10 THEN
    IF EXISTS (
      SELECT 1 FROM public.eleitores_captados
      WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND public.normalize_phone(telefone) = v_tel
    ) OR EXISTS (
      SELECT 1 FROM public.liderancas
      WHERE public.normalize_phone(telefone) = v_tel
         OR public.normalize_phone(whatsapp) = v_tel
    ) THEN
      RAISE EXCEPTION 'Telefone % já cadastrado no sistema.', NEW.telefone USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eleitor_phone_unique ON public.eleitores_captados;

CREATE TRIGGER trg_eleitor_phone_unique
BEFORE INSERT OR UPDATE OF telefone ON public.eleitores_captados
FOR EACH ROW EXECUTE FUNCTION public.check_eleitor_phone_unique();
