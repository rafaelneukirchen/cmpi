-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_conferencias_leads_por_dia(p_from date DEFAULT (now() - interval '30 days')::date, p_to date DEFAULT now()::date)
RETURNS TABLE(
  dia date,
  user_id uuid,
  nome text,
  nomes_conferidos bigint,
  confirmados bigint,
  nao_confirmados bigint,
  sem_resposta bigint,
  observacoes bigint,
  total_acoes bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ev AS (
    SELECT
      (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
      a.user_id,
      COALESCE(NULLIF(btrim(a.executor_name), ''), 'Desconhecido') AS nome,
      a.record_id,
      CASE
        WHEN a.action = 'INSERT' THEN a.details->'new'->>'confirm_status'
        ELSE a.details->'alteracoes'->'confirm_status'->>'para'
      END AS novo_status,
      CASE
        WHEN a.action = 'INSERT' THEN (a.details->'new'->>'confirm_status') IS NOT NULL
        ELSE (a.details->'alteracoes') ? 'confirm_status'
      END AS mudou_status,
      CASE
        WHEN a.action = 'INSERT' THEN NULLIF(a.details->'new'->>'observacao','') IS NOT NULL
        ELSE (a.details->'alteracoes') ? 'observacao'
      END AS mudou_obs
    FROM public.audit_log a
    WHERE a.table_name = 'lead_contact_status'
      AND (a.created_at AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_from AND p_to
      AND (public.is_admin() OR public.has_full_leads_access() OR a.user_id = auth.uid())
      AND a.user_id IS NOT NULL
      AND (
        EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = a.user_id AND up.module = 'leads_full')
        OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = a.user_id AND ur.role = 'admin')
      )
  )
  SELECT
    ev.dia,
    ev.user_id,
    ev.nome,
    COUNT(DISTINCT ev.record_id) AS nomes_conferidos,
    COUNT(*) FILTER (WHERE ev.mudou_status AND ev.novo_status = 'confirmado') AS confirmados,
    COUNT(*) FILTER (WHERE ev.mudou_status AND ev.novo_status = 'nao_confirmado') AS nao_confirmados,
    COUNT(*) FILTER (WHERE ev.mudou_status AND ev.novo_status IS NULL) AS sem_resposta,
    COUNT(*) FILTER (WHERE ev.mudou_obs) AS observacoes,
    COUNT(*) AS total_acoes
  FROM ev
  GROUP BY ev.dia, ev.user_id, ev.nome
  ORDER BY ev.dia DESC, COUNT(DISTINCT ev.record_id) DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_conferencias_leads_por_dia(date, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_conferencias_leads_por_dia(date, date) TO authenticated;
