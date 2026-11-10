import { useState } from "react";
import { PageHeader } from "@/components/logistics/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

const actionColors: Record<string, string> = {
  INSERT: "bg-emerald-500/15 text-emerald-600",
  UPDATE: "bg-amber-500/15 text-amber-600",
  DELETE: "bg-destructive/15 text-destructive",
};

const actionLabels: Record<string, string> = {
  INSERT: "Cadastro",
  UPDATE: "Atualização",
  DELETE: "Exclusão",
};

const tableLabels: Record<string, string> = {
  acoes_execucao: "Execução de Campo",
  acoes_midias: "Mídias de Ações",
  acoes_planejadas: "Ações Planejadas",
  agenda_campanha: "Agenda",
  app_settings: "Configurações",
  cabos_eleitorais: "Cabos Eleitorais",
  campanhas: "Campanhas",
  cidades: "Cidades",
  contatos_coordenacao: "Contatos Coordenação",
  coordenador_cidades: "Cidades do Coordenador",
  dobradinhas: "Dobradas",
  eleitores_captados: "Apoiadores Captados",
  equipe_membros: "Equipe",
  estrutura_campanha: "Estrutura",
  financial_transactions: "Financeiro",
  integration_secrets: "Integrações",
  lead_contact_status: "Status de Leads",
  licencas: "Licenças",
  liderancas: "Lideranças",
  logistics_profiles: "Pessoas",
  material_requests: "Solicitações de Material",
  materials: "Materiais",
  movements: "Movimentações",
  payment_schedule: "Pagamentos",
  planejamento_logistico: "Planejamento de Material de Campanha",
  planejamento_semanal: "Planejamento Semanal",
  profiles: "Usuários",
  projecao_votos: "Projeções",
  public_map_links: "Links de Mapa",
  reimbursements: "Reembolsos",
  social_competitors: "Concorrentes Sociais",
  social_discovery_profiles: "Perfis Sociais",
  system_api_credentials: "Credenciais de API",
  user_location_consent: "Consentimento de Localização",
  user_permissions: "Permissões",
  user_roles: "Perfis de Acesso",
  visitas_campanha: "Visitas",
  whatsapp_instances: "WhatsApp",
};

const fieldLabels: Record<string, string> = {
  confirm_status: "Status do contato",
  observacao: "Observação",
  sent_at: "Mensagem enviada",
  phone_key: "Telefone",
};

const valueLabels: Record<string, string> = {
  confirmado: "Confirmado",
  nao_confirmado: "Não confirmado",
};

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "Sem resposta";
  const s = String(v);
  return valueLabels[s] || (s.length > 60 ? `${s.slice(0, 60)}…` : s);
}

function resumoAlteracoes(alter: Record<string, { de?: unknown; para?: unknown }>): string {
  return Object.entries(alter)
    .slice(0, 3)
    .map(([k, v]) => `${fieldLabels[k] || k}: ${fmtValue(v?.de)} → ${fmtValue(v?.para)}`)
    .join(" | ");
}

const PAGE_SIZE = 100;


export default function LogAuditoria() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [table, setTable] = useState("all");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["audit_log", search, action, table, page],
    queryFn: async () => {
      let q = supabase
        .from("audit_log" as any)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (action !== "all") q = q.eq("action", action);
      if (table !== "all") q = q.eq("table_name", table);
      if (search.trim()) {
        const s = search.trim().replace(/[,%]/g, " ");
        q = q.or(`executor_name.ilike.%${s}%,table_name.ilike.%${s}%,record_id.ilike.%${s}%`);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data as any[]) || [], count: count ?? 0 };
    },
  });

  const logs = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetPage = (fn: () => void) => { fn(); setPage(0); };

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader title="Auditoria" description="Registro de todas as ações realizadas no sistema" />

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por executor, seção ou ID do registro..."
            className="pl-10"
            value={search}
            onChange={e => resetPage(() => setSearch(e.target.value))}
          />
        </div>
        <NativeSelect
          value={action}
          onChange={e => resetPage(() => setAction(e.target.value))}
          className="sm:w-48"
          options={[
            { value: "all", label: "Todas as ações" },
            { value: "INSERT", label: "Cadastro" },
            { value: "UPDATE", label: "Atualização" },
            { value: "DELETE", label: "Exclusão" },
          ]}
        />
        <NativeSelect
          value={table}
          onChange={e => resetPage(() => setTable(e.target.value))}
          className="sm:w-56"
          options={[
            { value: "all", label: "Todas as seções" },
            ...Object.entries(tableLabels)
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([k, v]) => ({ value: k, label: v })),
          ]}
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground"><p className="text-sm">Carregando logs...</p></div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Data/Hora</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Executor</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Ação</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Seção</th>
                    <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => {
                    const removido = log.details?.removido;
                    const novo = log.details?.new;
                    const alter = log.details?.alteracoes;
                    const base = removido?.nome || removido?.nome_completo || removido?.name || removido?.description
                      || novo?.nome || novo?.nome_completo || novo?.name || novo?.description
                      || (alter ? resumoAlteracoes(alter) : "");
                    const resumo = log.table_name === "lead_contact_status" && log.record_id
                      ? `${log.record_id} — ${base}`
                      : base;

                    return (
                      <tr key={log.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-5 py-3.5 text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs font-medium text-foreground">{log.executor_name || "Sistema"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${actionColors[log.action] || "bg-muted text-muted-foreground"}`}>
                            {actionLabels[log.action] || log.action}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground text-xs">{tableLabels[log.table_name || ""] || log.table_name || "-"}</td>
                        <td className="px-5 py-3.5 text-muted-foreground text-xs max-w-[280px] truncate" title={resumo}>{resumo || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {total.toLocaleString("pt-BR")} registros • página {page + 1} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          </div>
        </>
      )}

      {!isLoading && logs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum log de auditoria encontrado.</p>
        </div>
      )}
    </div>
  );
}
