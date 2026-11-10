import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

export type Cidade = Tables<"cidades">;
export type Lideranca = Tables<"liderancas">;
export type ProjecaoVotos = Tables<"projecao_votos">;
export type EstruturaCampanha = Tables<"estrutura_campanha">;
export type VisitaCampanha = Tables<"visitas_campanha">;
export type AgendaCampanha = Tables<"agenda_campanha">;

export function useCidades() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["cidades", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cidades").select("*").order("nome");
      if (error) throw error;
      return data as Cidade[];
    },
    enabled: !loading && !!session,
  });
}

export function useLiderancas() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["liderancas", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("liderancas").select("*").order("nome");
      if (error) throw error;
      return data as Lideranca[];
    },
    enabled: !loading && !!session,
  });
}

export function useProjecoes() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["projecoes", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projecao_votos").select("*");
      if (error) throw error;
      return data as ProjecaoVotos[];
    },
    enabled: !loading && !!session,
  });
}

export function useEstruturas() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["estruturas", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("estrutura_campanha").select("*");
      if (error) throw error;
      return data as EstruturaCampanha[];
    },
    enabled: !loading && !!session,
  });
}

export function useVisitas() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["visitas", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("visitas_campanha").select("*").order("data_visita", { ascending: false });
      if (error) throw error;
      return data as VisitaCampanha[];
    },
    enabled: !loading && !!session,
  });
}

export function useAgenda() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["agenda", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_campanha")
        .select("*")
        .order("data");
      if (error) throw error;
      return data as AgendaCampanha[];
    },
    enabled: !loading && !!session,
  });
}

// Profiles map (for showing event owners on shared agenda view)
export function useProfilesMap() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["profiles-map", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome, cor");
      if (error) throw error;
      return data as { user_id: string; nome: string; cor: string | null }[];
    },
    enabled: !loading && !!session,
  });
}
