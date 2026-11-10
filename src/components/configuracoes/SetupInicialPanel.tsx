import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Painel "Setup Inicial" — aparece para Admin em Configurações → Geral.
 * Permite popular os votos TSE 2022/2024 num clone vazio (a tabela base
 * cidades/estados/candidatos já vem nas migrations).
 */
export function SetupInicialPanel() {
  const qc = useQueryClient();
  const [importingTse, setImportingTse] = useState(false);
  const currentYear = new Date().getFullYear();
  const defaultYear = currentYear % 2 === 0 ? currentYear : currentYear - 1;
  const [tseYear, setTseYear] = useState<string>(String(defaultYear));
  const [tseForce, setTseForce] = useState(false);

  const { data: counts, isLoading } = useQuery({
    queryKey: ["setup-counts"],
    queryFn: async () => {
      const [c, e, tc, tv] = await Promise.all([
        supabase.from("cidades").select("*", { count: "exact", head: true }),
        supabase.from("estados").select("*", { count: "exact", head: true }),
        supabase.from("tse_candidatos").select("*", { count: "exact", head: true }),
        supabase.from("tse_votos_municipio").select("*", { count: "exact", head: true }),
      ]);
      return {
        cidades: c.count ?? 0,
        estados: e.count ?? 0,
        tse_candidatos: tc.count ?? 0,
        tse_votos: tv.count ?? 0,
      };
    },
  });

  const importTse = useMutation({
    mutationFn: async (opts: { year?: number; force?: boolean }) => {
      setImportingTse(true);
      const body: any = {};
      if (opts.year) body.year = opts.year;
      if (opts.force) body.force = true;
      const { data, error } = await supabase.functions.invoke("seed-tse-votos", { body });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || "Falha");
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(data?.message || "Votos TSE importados!");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["setup-counts"] }), 200);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao importar votos TSE"),
    onSettled: () => setImportingTse(false),
  });

  const items = [
    { label: "Estados", count: counts?.estados ?? 0, expected: 1, key: "estados" },
    { label: "Cidades de SP", count: counts?.cidades ?? 0, expected: 645, key: "cidades" },
    { label: "Candidatos TSE 2022/2024", count: counts?.tse_candidatos ?? 0, expected: 50000, key: "cand" },
    { label: "Votos TSE por município", count: counts?.tse_votos ?? 0, expected: 880000, key: "votos" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Setup Inicial — Base de Dados Eleitoral
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Estados, cidades e candidatos TSE já vêm prontos via migration. Os votos TSE (≈880 mil registros, 88 MB) ficam num arquivo hospedado e podem ser importados com 1 clique.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {items.map((it) => {
            const ok = it.count >= it.expected * 0.9;
            return (
              <div key={it.key} className="rounded-md border p-3 bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : ok ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-xs text-muted-foreground">{it.label}</span>
                </div>
                <div className="text-lg font-bold">
                  {it.count.toLocaleString("pt-BR")}
                </div>
                <Badge variant={ok ? "secondary" : "destructive"} className="text-[10px] mt-1">
                  {ok ? "OK" : "vazio"}
                </Badge>
              </div>
            );
          })}
        </div>

        {(counts?.tse_votos ?? 0) < 1000 && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div>
              <p className="font-semibold text-sm">Importar votos TSE 2022/2024</p>
              <p className="text-xs text-muted-foreground mt-1">
                Baixa ≈880 mil registros de votos por município/zona (≈88 MB descompactado). Pode levar 1-3 minutos. Necessário para mapa de calor e análise de dobradinhas.
              </p>
            </div>
            <Button
              onClick={() => importTse.mutate({})}
              disabled={importingTse}
              className="gap-2"
            >
              {importingTse ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {importingTse ? "Importando…" : "Importar agora"}
            </Button>
          </div>
        )}

        {(counts?.tse_votos ?? 0) >= 1000 && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span>Base eleitoral carregada. Sistema pronto para uso.</span>
          </div>
        )}

        {/* Atualizar / nova eleição */}
        <div className="rounded-md border p-4 space-y-3">
          <div>
            <p className="font-semibold text-sm">🗳️ Atualizar dados TSE (nova eleição)</p>
            <p className="text-xs text-muted-foreground mt-1">
              Eleições acontecem a cada 2 anos. Quando o TSE publicar os dados de uma nova eleição, basta clicar em <strong>"Atualizar agora"</strong> para puxar os novos votos. O sistema também tenta atualizar <strong>automaticamente no dia 1º de novembro</strong> de cada ano (logo após o pleito de outubro).
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Ano da eleição</label>
              <input
                type="number"
                min={2020}
                max={2040}
                step={2}
                value={tseYear}
                onChange={(e) => setTseYear(e.target.value)}
                className="h-10 w-24 rounded-md border border-input bg-background px-3 text-sm font-mono"
              />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer h-10">
              <input
                type="checkbox"
                checked={tseForce}
                onChange={(e) => setTseForce(e.target.checked)}
                className="h-4 w-4"
              />
              Forçar reimportação
            </label>
            <Button
              onClick={() => importTse.mutate({ year: Number(tseYear), force: tseForce })}
              disabled={importingTse || !tseYear}
              className="gap-2"
            >
              {importingTse ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Atualizar agora
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Dica: o arquivo de seed precisa estar em <code className="bg-muted px-1 rounded">app-assets/seeds/tse_votos_&lt;ano&gt;.tsv.gz</code>. Sem isso o cron é apenas um no-op.
          </p>
        </div>

        <LicenseKeyConfig />
      </CardContent>
    </Card>
  );
}

function LicenseKeyConfig() {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);

  useQuery({
    queryKey: ["license-key-setting"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "license_key").maybeSingle();
      const v = data?.value || "";
      setValue(v);
      setLoaded(true);
      return v;
    },
  });

  const save = useMutation({
    mutationFn: async (key: string) => {
      const clean = key.trim().toUpperCase();
      const { data: existing } = await supabase.from("app_settings").select("id").eq("key", "license_key").maybeSingle();
      if (existing) {
        const { error } = await supabase.from("app_settings").update({ value: clean }).eq("key", "license_key");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("app_settings").insert({ key: "license_key", value: clean });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Chave de licença salva. Novos leads serão enviados para a central.");
      qc.invalidateQueries({ queryKey: ["license-key-setting"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div>
        <p className="font-semibold text-sm">🔗 Conexão com Central de Leads</p>
        <p className="text-xs text-muted-foreground mt-1">
          Cole abaixo a <strong>chave de licença</strong> fornecida pelo administrador do sistema. Todos os eleitores captados neste clone serão enviados automaticamente, em tempo real, para a central de leads do owner (você não precisa fazer nada depois). Deixe em branco para desativar.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex.: INTEL-XXXX-XXXX-XXXX"
          disabled={!loaded}
          className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm font-mono"
        />
        <Button onClick={() => save.mutate(value)} disabled={save.isPending || !loaded}>
          {save.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

