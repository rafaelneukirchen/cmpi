-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, module)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_permissions_select" ON public.user_permissions
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR is_admin());

CREATE POLICY "user_permissions_insert" ON public.user_permissions
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "user_permissions_update" ON public.user_permissions
  FOR UPDATE TO authenticated
  USING (is_admin());

CREATE POLICY "user_permissions_delete" ON public.user_permissions
  FOR DELETE TO authenticated
  USING (is_admin());

CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(module), '{}')
  FROM public.user_permissions
  WHERE user_id = _user_id
$$;
