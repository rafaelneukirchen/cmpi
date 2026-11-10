import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, Download, MessageCircle, Search, Users } from "lucide-react";

type Lead = {
  id: string;
  chave_licenca: string;
  cliente_nome: string | null;
  nome_completo: string;
  telefone: string | null;
  bairro: string | null;
  cidade_nome: string | null;
  tipo_captador: string | null;
  captador_nome: string | null;
  captured_at: string;
  url_origem: string | null;
};

const normPhone = (p?: string | null) => (p ? p.replace(/\D/g, "") : "");
const toWa = (p?: string | null) => {
  const n = normPhone(p);
  if (!n) return null;
  return n.startsWith("55") ? n : `55${n}`;
};

export default function LeadsCentralizados() {
  const { isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterLic, setFilterLic] = useState("");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads-centralizados"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads_centralizados" as any)
        .select("id,chave_licenca,cliente_nome,nome_completo,telefone,bairro,cidade_nome,tipo_captador,captador_nome,captured_at,url_origem")
        .order("captured_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as unknown as Lead[];
    },
  });

  const clientes = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((l) => map.set(l.chave_licenca, l.cliente_nome || l.chave_licenca));
    return Array.from(map.entries()).map(([key, label]) => ({ value: key, label }));
  }, [leads]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filterLic && l.chave_licenca !== filterLic) return false;
      if (!s) return true;
      return (
        l.nome_completo.toLowerCase().includes(s) ||
        (l.telefone || "").toLowerCase().includes(s) ||
        (l.cidade_nome || "").toLowerCase().includes(s) ||
        (l.bairro || "").toLowerCase().includes(s) ||
        (l.cliente_nome || "").toLowerCase().includes(s)
      );
    });
  }, [leads, search, filterLic]);

  const exportCsv = () => {
    const header = ["Nome", "Telefone", "WhatsApp_E164", "Bairro", "Cidade", "Cliente", "Captador", "Tipo", "Data"];
    const rows = filtered.map((l) => [
      l.nome_completo,
      l.telefone || "",
      toWa(l.telefone) || "",
      l.bairro || "",
      l.cidade_nome || "",
      l.cliente_nome || l.chave_licenca,
      l.captador_nome || "",
      l.tipo_captador || "",
      new Date(l.captured_at).toLocaleString("pt-BR"),
    ]);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((r) => r.map(escape).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-centralizados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6">Carregando…</div>;
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Acesso restrito</h1>
        <p className="text-muted-foreground max-w-md">Área exclusiva do Super Admin.</p>
        <Button onClick={() => navigate("/")}>Voltar</Button>
      </div>
    );
  }

  const stats = {
    total: leads.length,
    clientes: clientes.length,
    filtrados: filtered.length,
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Leads Centralizados (Todos os Clones)
          </h1>
          <p className="text-sm text-muted-foreground">
            Todo apoiador captado em qualquer clone licenciado chega aqui em tempo real.
          </p>
        </div>
        <Button onClick={exportCsv} className="gap-2" disabled={filtered.length === 0}>
          <Download className="h-4 w-4" /> Exportar CSV ({filtered.length})
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total de leads</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Clientes ativos</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{stats.clientes}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Após filtros</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold text-primary">{stats.filtrados}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone, cidade, bairro, cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <NativeSelect
            value={filterLic}
            onChange={(e) => setFilterLic(e.target.value)}
            options={[{ value: "", label: "Todos os clientes" }, ...clientes]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Leads ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum lead recebido ainda.</p>
              <p className="text-xs mt-1">Cada clone precisa ter a chave de licença configurada em Configurações → Geral.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade / Bairro</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Captador</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 1000).map((l) => {
                  const wa = toWa(l.telefone);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.nome_completo}</TableCell>
                      <TableCell className="text-sm">{l.telefone || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {l.cidade_nome || "—"}{l.bairro ? ` / ${l.bairro}` : ""}
                      </TableCell>
                      <TableCell><Badge variant="outline">{l.cliente_nome || l.chave_licenca}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.captador_nome || "—"}{l.tipo_captador ? ` (${l.tipo_captador})` : ""}
                      </TableCell>
                      <TableCell className="text-xs">{new Date(l.captured_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        {wa ? (
                          <Button size="sm" variant="outline" asChild className="gap-1">
                            <a href={`https://api.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(`Olá ${l.nome_completo.split(" ")[0]}, tudo bem?`)}`} target="_blank" rel="noreferrer">
                              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">sem telefone</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {filtered.length > 1000 && (
            <p className="text-xs text-muted-foreground mt-3">
              Mostrando primeiros 1.000. Use os filtros ou exporte CSV para ver todos.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
