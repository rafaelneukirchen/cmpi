import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContatoCoordenacao {
  id: string;
  coordenador_user_id: string;
  registrado_por_user_id: string;
  data_contato: string;
  tipo_contato: string;
  assunto: string;
  relatorio: string | null;
  proximos_passos: string | null;
  created_at: string;
  updated_at: string;
}

export function useContatosCoordenacao(coordenadorUserId?: string) {
  return useQuery({
    queryKey: ["contatos-coordenacao", coordenadorUserId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("contatos_coordenacao").select("*").order("data_contato", { ascending: false });
      if (coordenadorUserId) q = q.eq("coordenador_user_id", coordenadorUserId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ContatoCoordenacao[];
    },
  });
}

export function useCreateContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      coordenador_user_id: string;
      tipo_contato: string;
      assunto: string;
      relatorio?: string;
      proximos_passos?: string;
      data_contato?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sem sessão");
      const { error } = await supabase.from("contatos_coordenacao").insert({
        ...payload,
        registrado_por_user_id: uid,
        data_contato: payload.data_contato ?? new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ["contatos-coordenacao"] }), 150);
    },
  });
}

export function useDeleteContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contatos_coordenacao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setTimeout(() => qc.invalidateQueries({ queryKey: ["contatos-coordenacao"] }), 150);
    },
  });
}
