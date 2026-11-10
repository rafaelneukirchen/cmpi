import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type CidadeOption = {
  id: string;
  nome: string;
  regiao_administrativa: string | null;
};

/**
 * Lista completa de cidades para uso em campos de seleção
 * (cadastro de liderança, dobradinhas, etc).
 * Usa a função SECURITY DEFINER `get_cidades_options`, que retorna
 * todas as cidades para usuários com permissão de cadastro,
 * ignorando o filtro regional de RLS aplicado em `cidades`.
 */
export function useCidadesOptions() {
  const { session, loading, roleLoading } = useAuth();
  return useQuery({
    queryKey: ["cidades-options", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cidades_options");
      if (!error && data && data.length > 0) return data as CidadeOption[];

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("cidades")
        .select("id, nome, regiao_administrativa")
        .order("nome");

      if (fallbackError) throw error || fallbackError;
      return (fallbackData || []) as CidadeOption[];
    },
    enabled: !loading && !roleLoading && !!session,
    staleTime: 1000 * 60 * 10,
  });
}
