-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.leads_centralizados
ADD CONSTRAINT leads_centralizados_chave_origem_unique
UNIQUE (chave_licenca, origem_lead_id);
