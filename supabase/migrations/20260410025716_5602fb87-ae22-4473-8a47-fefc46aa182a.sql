-- Exportação sem dados: somente estrutura e lógica.
CREATE TEMP TABLE dup_mapping AS
WITH ranked AS (
  SELECT id, nome, cidade_base_id, cidades_representadas, votos_estimados, votos_por_cidade,
         coordenador_user_id, forca_politica, status, bairros, historico_politico, observacoes,
         ROW_NUMBER() OVER (PARTITION BY nome ORDER BY created_at ASC) as rn
  FROM liderancas
  WHERE nome IN (SELECT nome FROM liderancas GROUP BY nome HAVING COUNT(*) > 1)
)
SELECT id, nome, rn,
       FIRST_VALUE(id) OVER (PARTITION BY nome ORDER BY rn) as keeper_id
FROM ranked;

DROP TABLE dup_mapping;
