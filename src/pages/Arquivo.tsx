import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Archive, Filter, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ImportarArquivoDialog from "@/components/ImportarArquivoDialog";

const tabelaLabels: Record<string, string> = {
  liderancas: "Lideranças",
  projecao_votos: "Projeção de Votos",
  estrutura_campanha: "Estrutura",
  visitas_campanha: "Visitas",
  agenda_campanha: "Agenda",
  dobradinhas: "Dobradinhas",
  cidades: "Cidades",
};

function getColumns(tabela: string): { key: string; label: string }[] {
  const map: Record<string, { key: string; label: string }[]> = {
    cidades: [
      { key: "nome", label: "Nome" },
      { key: "populacao", label: "População" },
      { key: "eleitores", label: "Eleitores" },
      { key: "regiao_administrativa", label: "Região" },
    ],
    liderancas: [
      { key: "nome", label: "Nome" },
      { key: "telefone", label: "Telefone" },
      { key: "forca_politica", label: "Força Política" },
      { key: "status", label: "Status" },
    ],
    projecao_votos: [
      { key: "votos_projetados", label: "Votos Projetados" },
      { key: "votos_confirmados", label: "Votos Confirmados" },
      { key: "meta_votos", label: "Meta" },
      { key: "nivel_confianca", label: "Confiança" },
      { key: "responsavel", label: "Responsável" },
    ],
    estrutura_campanha: [
      { key: "cabos_eleitorais", label: "Cabos Eleitorais" },
      { key: "apoiadores", label: "Apoiadores" },
      { key: "veiculos", label: "Veículos" },
      { key: "materiais_distribuidos", label: "Materiais" },
    ],
    visitas_campanha: [
      { key: "data_visita", label: "Data" },
      { key: "objetivo", label: "Objetivo" },
      { key: "resultado", label: "Resultado" },
      { key: "equipe_responsavel", label: "Equipe" },
    ],
    agenda_campanha: [
      { key: "evento", label: "Evento" },
      { key: "data", label: "Data" },
      { key: "tipo_evento", label: "Tipo" },
      { key: "responsavel", label: "Responsável" },
    ],
    dobradinhas: [
      { key: "candidato_parceiro", label: "Candidato Parceiro" },
      { key: "cargo_parceiro", label: "Cargo" },
      { key: "votos_estimados", label: "Votos Estimados" },
      { key: "observacoes", label: "Observações" },
    ],
  };
  return map[tabela] || [{ key: "id", label: "ID" }];
}

function exportToCSV(rows: any[], cols: { key: string; label: string }[], filename: string) {
  if (!rows.length) return;
  const sep = ";";
  const header = cols.map((c) => c.label).join(sep);
  const lines = rows.map((row) =>
    cols.map((c) => {
      const val = row[c.key] != null ? String(row[c.key]).replace(/"/g, '""') : "";
      return `"${val}"`;
    }).join(sep)
  );
  const bom = "\uFEFF";
  const csv = bom + [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/\s+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Arquivo() {
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const [selectedCampanha, setSelectedCampanha] = useState<string>("all");
  const [selectedTabela, setSelectedTabela] = useState<string>("all");

  const { data: campanhas, isLoading: loadingCampanhas } = useQuery({
    queryKey: ["campanhas-arquivadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campanhas")
        .select("*")
        .eq("status", "arquivada")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: arquivos, isLoading: loadingArquivos } = useQuery({
    queryKey: ["campanhas-arquivo", selectedCampanha, selectedTabela],
    queryFn: async () => {
      let query = supabase.from("campanhas_arquivo").select("*, campanhas(nome, ano)");
      if (selectedCampanha !== "all") {
        query = query.eq("campanha_id", selectedCampanha);
      }
      if (selectedTabela !== "all") {
        query = query.eq("tabela", selectedTabela);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Arquivo de Campanhas</h1>
          <p className="text-muted-foreground">Consulte e importe dados de campanhas anteriores</p>
        </div>
        <ImportarArquivoDialog campanhas={campanhas || []} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Filter className="h-3 w-3" /> Campanha
          </label>
          <NativeSelect
            value={selectedCampanha}
            onChange={e => setSelectedCampanha(e.target.value)}
            className="w-[220px]"
            options={[
              { value: "all", label: "Todas as campanhas" },
              ...(campanhas || []).map(c => ({ value: c.id, label: `${c.nome} (${c.ano})` })),
            ]}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Filter className="h-3 w-3" /> Tabela
          </label>
          <NativeSelect
            value={selectedTabela}
            onChange={e => setSelectedTabela(e.target.value)}
            className="w-[220px]"
            options={[
              { value: "all", label: "Todas as tabelas" },
              ...Object.entries(tabelaLabels).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
      </div>

      {/* Results */}
      {(loadingCampanhas || loadingArquivos) ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !arquivos?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Archive className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum dado arquivado encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        arquivos.map((arquivo) => {
          const rows = Array.isArray(arquivo.dados) ? arquivo.dados : [];
          const cols = getColumns(arquivo.tabela);
          const campanha = arquivo.campanhas as { nome: string; ano: number } | null;

          return (
            <Card key={arquivo.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Archive className="h-4 w-4" />
                    {tabelaLabels[arquivo.tabela] || arquivo.tabela}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {campanha && (
                      <Badge variant="outline">{campanha.nome} ({campanha.ano})</Badge>
                    )}
                    <Badge variant="secondary">{rows.length} registro(s)</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => exportToCSV(rows, cols, `${arquivo.tabela}_${campanha?.nome || "arquivo"}`)}
                    >
                      <Download className="h-3.5 w-3.5" /> CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {cols.map((col) => (
                          <TableHead key={col.key}>{col.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 50).map((row: any, idx: number) => (
                        <TableRow key={idx}>
                          {cols.map((col) => (
                            <TableCell key={col.key} className="text-sm">
                              {row[col.key] != null ? String(row[col.key]) : "—"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {rows.length > 50 && (
                        <TableRow>
                          <TableCell colSpan={cols.length} className="text-center text-muted-foreground text-xs py-3">
                            Exibindo 50 de {rows.length} registros
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
