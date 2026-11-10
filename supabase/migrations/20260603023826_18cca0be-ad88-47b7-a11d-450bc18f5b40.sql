-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS agenda_campanha_select ON public.agenda_campanha;

CREATE POLICY agenda_campanha_select ON public.agenda_campanha
FOR SELECT TO authenticated
USING (
  is_admin()
  OR (criado_por_user_id = auth.uid())
  OR (
    status = 'aprovado'
    AND user_can_access_cidade(cidade_id)
    AND (user_has_agenda_conjunta() OR criado_por_user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS logistics_profiles_insert ON public.logistics_profiles;

CREATE POLICY logistics_profiles_insert ON public.logistics_profiles
FOR INSERT TO authenticated
WITH CHECK (is_admin() OR (can_write() AND user_id = auth.uid()));
