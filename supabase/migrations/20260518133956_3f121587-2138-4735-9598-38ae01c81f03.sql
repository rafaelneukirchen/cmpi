-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.equipe_membros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  coordenador_user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  regiao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_equipe_membros_coord ON public.equipe_membros(coordenador_user_id);

CREATE INDEX idx_equipe_membros_user ON public.equipe_membros(user_id);

ALTER TABLE public.equipe_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipe_membros_select" ON public.equipe_membros FOR SELECT TO authenticated
USING (is_admin() OR coordenador_user_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "equipe_membros_insert" ON public.equipe_membros FOR INSERT TO authenticated
WITH CHECK (is_admin() OR coordenador_user_id = auth.uid());

CREATE POLICY "equipe_membros_update" ON public.equipe_membros FOR UPDATE TO authenticated
USING (is_admin() OR coordenador_user_id = auth.uid());

CREATE POLICY "equipe_membros_delete" ON public.equipe_membros FOR DELETE TO authenticated
USING (is_admin() OR coordenador_user_id = auth.uid());

CREATE TRIGGER trg_equipe_membros_updated
BEFORE UPDATE ON public.equipe_membros
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_latest_user_locations()
 RETURNS TABLE(user_id uuid, latitude double precision, longitude double precision, accuracy double precision, battery_level integer, captured_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (ul.user_id)
    ul.user_id, ul.latitude, ul.longitude, ul.accuracy, ul.battery_level, ul.captured_at
  FROM public.user_locations ul
  WHERE
    is_admin()
    OR ul.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.equipe_membros em
      WHERE em.user_id = ul.user_id AND em.coordenador_user_id = auth.uid()
    )
  ORDER BY ul.user_id, ul.captured_at DESC;
$function$;
