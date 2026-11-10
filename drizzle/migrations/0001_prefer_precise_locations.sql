CREATE OR REPLACE FUNCTION public.get_latest_user_locations()
 RETURNS TABLE(user_id uuid, latitude double precision, longitude double precision, accuracy double precision, battery_level integer, captured_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT DISTINCT ON (ul.user_id)
    ul.user_id, ul.latitude, ul.longitude, ul.accuracy, ul.battery_level, ul.captured_at
  FROM public.user_locations ul
  WHERE
    is_admin()
    OR ul.user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.equipe_membros em WHERE em.user_id = ul.user_id AND em.coordenador_user_id = auth.uid())
  ORDER BY ul.user_id,
    (coalesce(ul.accuracy, 99999) <= 500 AND ul.captured_at > now() - interval '12 hours') DESC,
    ul.captured_at DESC;
$function$;