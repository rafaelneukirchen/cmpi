-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.normalize_bairro(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        lower(translate(btrim(coalesce(p,'')), 'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')),
                      '[^a-z0-9 ]', ' ', 'g'),
                    '\s+', ' ', 'g'),
                  '^(jd|jrd|jrdm|jardin|jardins|jardim)\s+', '', 'g'),
                '^(vl|vla|vila)\s+', '', 'g'),
              '^(pq|prq|parque)\s+', '', 'g'),
            '^(cj|cjt|cjto|conjunto|conj)\s+', '', 'g'),
          '^(res|resid|residencial|cohab|nucleo|chacara|chac|sitio|cidade|bairro|bro)\s+', '', 'g'),
        '^(st|sta|santa)\s+', 'santa ', 'g'),
      '^(da|de|do|das|dos)\s+', '', 'g'),
    '\s+', ' ', 'g')
  ), '');
$$;
