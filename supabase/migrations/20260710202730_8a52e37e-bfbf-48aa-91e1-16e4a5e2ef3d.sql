-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.check_lideranca_phone_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel text;
  v_wa text;
  v_old_tel text;
  v_old_wa text;
BEGIN
  v_tel := public.normalize_phone(NEW.telefone);
  v_wa := public.normalize_phone(NEW.whatsapp);

  IF TG_OP = 'UPDATE' THEN
    v_old_tel := public.normalize_phone(OLD.telefone);
    v_old_wa := public.normalize_phone(OLD.whatsapp);
  END IF;

  IF v_tel IS NOT NULL AND length(v_tel) >= 10 AND (TG_OP = 'INSERT' OR v_tel IS DISTINCT FROM v_old_tel) THEN
    IF EXISTS (
      SELECT 1 FROM public.liderancas
      WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND NOT (COALESCE(NEW.promoted_from_origem, '') = 'lideranca' AND id = NEW.promoted_from_id)
        AND (public.normalize_phone(telefone) = v_tel OR public.normalize_phone(whatsapp) = v_tel)
    ) THEN
      RAISE EXCEPTION 'Telefone % já cadastrado no sistema.', NEW.telefone USING ERRCODE = '23505';
    END IF;
  END IF;

  IF v_wa IS NOT NULL AND length(v_wa) >= 10 AND v_wa <> COALESCE(v_tel,'')
     AND (TG_OP = 'INSERT' OR v_wa IS DISTINCT FROM v_old_wa) THEN
    IF EXISTS (
      SELECT 1 FROM public.liderancas
      WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND NOT (COALESCE(NEW.promoted_from_origem, '') = 'lideranca' AND id = NEW.promoted_from_id)
        AND (public.normalize_phone(telefone) = v_wa OR public.normalize_phone(whatsapp) = v_wa)
    ) THEN
      RAISE EXCEPTION 'WhatsApp % já cadastrado no sistema.', NEW.whatsapp USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_cabo_phone_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tel text;
  v_wa text;
  v_old_tel text;
  v_old_wa text;
BEGIN
  v_tel := public.normalize_phone(NEW.telefone);
  v_wa := public.normalize_phone(NEW.whatsapp);

  IF TG_OP = 'UPDATE' THEN
    v_old_tel := public.normalize_phone(OLD.telefone);
    v_old_wa := public.normalize_phone(OLD.whatsapp);
  END IF;

  IF v_tel IS NOT NULL AND length(v_tel) >= 10 AND (TG_OP = 'INSERT' OR v_tel IS DISTINCT FROM v_old_tel) THEN
    IF EXISTS (
      SELECT 1 FROM public.cabos_eleitorais
      WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND NOT (COALESCE(NEW.promoted_from_origem, '') = 'cabo_eleitoral' AND id = NEW.promoted_from_id)
        AND (public.normalize_phone(telefone) = v_tel OR public.normalize_phone(whatsapp) = v_tel)
    ) THEN
      RAISE EXCEPTION 'Telefone % já cadastrado no sistema.', NEW.telefone USING ERRCODE = '23505';
    END IF;
  END IF;

  IF v_wa IS NOT NULL AND length(v_wa) >= 10 AND v_wa <> COALESCE(v_tel,'')
     AND (TG_OP = 'INSERT' OR v_wa IS DISTINCT FROM v_old_wa) THEN
    IF EXISTS (
      SELECT 1 FROM public.cabos_eleitorais
      WHERE id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND NOT (COALESCE(NEW.promoted_from_origem, '') = 'cabo_eleitoral' AND id = NEW.promoted_from_id)
        AND (public.normalize_phone(telefone) = v_wa OR public.normalize_phone(whatsapp) = v_wa)
    ) THEN
      RAISE EXCEPTION 'WhatsApp % já cadastrado no sistema.', NEW.whatsapp USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
