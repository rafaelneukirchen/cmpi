-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.agenda_campanha
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS aprovado_por_user_id uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agenda_campanha_status_check') THEN
    ALTER TABLE public.agenda_campanha
      ADD CONSTRAINT agenda_campanha_status_check
      CHECK (status IN ('pendente','aprovado','rejeitado'));
  END IF;
END $$;

DROP POLICY IF EXISTS agenda_campanha_select ON public.agenda_campanha;

CREATE POLICY agenda_campanha_select
ON public.agenda_campanha
FOR SELECT
TO authenticated
USING (
  is_admin()
  OR criado_por_user_id = auth.uid()
  OR (status = 'aprovado' AND (user_has_agenda_conjunta() OR criado_por_user_id = auth.uid()))
);

DROP POLICY IF EXISTS agenda_campanha_update ON public.agenda_campanha;

CREATE POLICY agenda_campanha_update
ON public.agenda_campanha
FOR UPDATE
TO authenticated
USING (
  is_admin() OR (can_write() AND criado_por_user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.agenda_enforce_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF is_admin() THEN
      -- admin defaults to aprovado if not specified explicitly
      IF NEW.status IS NULL OR NEW.status = 'pendente' THEN
        NEW.status := 'aprovado';
        NEW.aprovado_por_user_id := auth.uid();
        NEW.aprovado_em := now();
      END IF;
    ELSE
      NEW.status := 'pendente';
      NEW.aprovado_por_user_id := NULL;
      NEW.aprovado_em := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT is_admin() THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar a situação do evento.' USING ERRCODE = '42501';
      END IF;
      IF NEW.status IN ('aprovado','rejeitado') THEN
        NEW.aprovado_por_user_id := auth.uid();
        NEW.aprovado_em := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agenda_enforce_status ON public.agenda_campanha;

CREATE TRIGGER trg_agenda_enforce_status
BEFORE INSERT OR UPDATE ON public.agenda_campanha
FOR EACH ROW EXECUTE FUNCTION public.agenda_enforce_status();
