import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Dobradinha {
  id: string;
  cidade_id: string | null;
  lideranca_id: string | null;
  cabo_id: string | null;
  cidades_excluidas?: string[];
  candidato_parceiro: string;
  cargo_parceiro: string | null;
  votos_estimados: number | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export function useDobradinhas() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["dobradinhas", session?.user?.id],
    enabled: !loading && !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dobradinhas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Dobradinha[];
    },
  });
}
