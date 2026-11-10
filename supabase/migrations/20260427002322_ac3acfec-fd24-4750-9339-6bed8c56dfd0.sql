-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.agenda_campanha
ADD COLUMN IF NOT EXISTS criado_por_user_id UUID;

CREATE OR REPLACE FUNCTION public.set_agenda_criado_por()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.criado_por_user_id IS NULL THEN
    NEW.criado_por_user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_agenda_criado_por ON public.agenda_campanha;

CREATE TRIGGER trg_set_agenda_criado_por
BEFORE INSERT ON public.agenda_campanha
FOR EACH ROW
EXECUTE FUNCTION public.set_agenda_criado_por();

CREATE OR REPLACE FUNCTION public.user_has_agenda_conjunta()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND module = 'agenda_conjunta'
  )
$$;

DROP POLICY IF EXISTS agenda_campanha_select ON public.agenda_campanha;

CREATE POLICY agenda_campanha_select
ON public.agenda_campanha
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.user_has_agenda_conjunta()
  OR criado_por_user_id = auth.uid()
);

DROP POLICY IF EXISTS agenda_campanha_insert ON public.agenda_campanha;

CREATE POLICY agenda_campanha_insert
ON public.agenda_campanha
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_write()
  AND (criado_por_user_id IS NULL OR criado_por_user_id = auth.uid() OR public.is_admin())
);

DROP POLICY IF EXISTS agenda_campanha_update ON public.agenda_campanha;

CREATE POLICY agenda_campanha_update
ON public.agenda_campanha
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR (public.can_write() AND criado_por_user_id = auth.uid())
);
