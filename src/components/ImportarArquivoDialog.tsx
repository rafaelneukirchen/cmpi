import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Upload, Loader2, FileUp, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const TABELA_OPTIONS = [
  { value: "liderancas", label: "Lideranças" },
  { value: "projecao_votos", label: "Projeção de Votos" },
  { value: "estrutura_campanha", label: "Estrutura" },
  { value: "visitas_campanha", label: "Visitas" },
  { value: "agenda_campanha", label: "Agenda" },
  { value: "dobradinhas", label: "Dobradinhas" },
  { value: "cidades", label: "Cidades" },
];

interface Campanha { id: string; nome: string; ano: number }

interface Props {
  campanhas: Campanha[];
}

function parseCSV(text: string): any[] {
  // Remove UTF-8 BOM
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detect separator (; preferred, fallback to ,)
  const sep = lines[0].includes(";") ? ";" : ",";

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === sep && !inQuotes) {
        out.push(cur); cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };

  const headers = parseLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = parseLine(line);
    const row: any = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

export default function ImportarArquivoDialog({ campanhas }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [campanhaId, setCampanhaId] = useState("");
  const [nome, setNome] = useState("");
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [tabela, setTabela] = useState("liderancas");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFile(null); setPreview(null); setMode("new"); setCampanhaId("");
    setNome(""); setAno(new Date().getFullYear()); setTabela("liderancas");
  };

  const handleFile = async (f: File) => {
    setFile(f);
    try {
      const text = await f.text();
      let rows: any[] = [];
      if (f.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text);
        // Aceita: array direto, ou objeto { tabela, dados }
        if (Array.isArray(parsed)) rows = parsed;
        else if (parsed?.dados && Array.isArray(parsed.dados)) {
          rows = parsed.dados;
          if (parsed.tabela && TABELA_OPTIONS.some(t => t.value === parsed.tabela)) {
            setTabela(parsed.tabela);
          }
        } else throw new Error("JSON inválido");
      } else {
        rows = parseCSV(text);
      }
      if (!rows.length) throw new Error("Arquivo vazio");
      setPreview(rows);
    } catch (err: any) {
      toast.error("Erro ao ler arquivo: " + (err.message || "formato inválido"));
      setFile(null); setPreview(null);
    }
  };

  const handleImport = async () => {
    if (!preview?.length) return;
    setSaving(true);
    try {
      let cid = campanhaId;
      if (mode === "new") {
        if (!nome.trim()) throw new Error("Informe o nome da campanha");
        const { data: nova, error: e1 } = await supabase
          .from("campanhas")
          .insert({ nome: nome.trim(), ano, status: "arquivada" })
          .select()
          .single();
        if (e1) throw e1;
        cid = nova.id;
      } else {
        if (!cid) throw new Error("Selecione uma campanha");
      }

      const { error: e2 } = await supabase
        .from("campanhas_arquivo")
        .insert({ campanha_id: cid, tabela, dados: preview });
      if (e2) throw e2;

      toast.success(`${preview.length} registro(s) importado(s) com sucesso!`);
      setOpen(false);
      reset();
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["campanhas-arquivo"] });
        qc.invalidateQueries({ queryKey: ["campanhas-arquivadas"] });
      }, 150);
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="h-4 w-4" /> Importar Arquivo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[calc(100dvh-1rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>Importar Arquivo de Campanha</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Campanha destino */}
          <div className="space-y-2">
            <Label>Campanha</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>Nova</Button>
              <Button type="button" size="sm" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")} disabled={!campanhas.length}>Existente</Button>
            </div>
            {mode === "new" ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="col-span-1 sm:col-span-2">
                  <Input placeholder="Nome da campanha" value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <Input type="number" placeholder="Ano" value={ano} onChange={(e) => setAno(Number(e.target.value))} />
              </div>
            ) : (
              <NativeSelect
                value={campanhaId}
                onChange={(e) => setCampanhaId(e.target.value)}
                options={[
                  { value: "", label: "Selecione..." },
                  ...campanhas.map(c => ({ value: c.id, label: `${c.nome} (${c.ano})` })),
                ]}
              />
            )}
          </div>

          {/* Tabela alvo */}
          <div className="space-y-2">
            <Label>Tipo de Dado</Label>
            <NativeSelect
              value={tabela}
              onChange={(e) => setTabela(e.target.value)}
              options={TABELA_OPTIONS}
            />
          </div>

          {/* Arquivo */}
          <div className="space-y-2">
            <Label>Arquivo (.csv ou .json)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              <input
                id="file-input"
                type="file"
                accept=".csv,.json,text/csv,application/json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <label htmlFor="file-input" className="cursor-pointer flex flex-col items-center gap-2">
                {file ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{preview?.length || 0} registro(s) detectado(s)</p>
                  </>
                ) : (
                  <>
                    <FileUp className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm">Clique para selecionar o arquivo</p>
                    <p className="text-xs text-muted-foreground">CSV (separador ;) ou JSON exportado do sistema</p>
                  </>
                )}
              </label>
            </div>
            {preview && preview.length > 0 && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                <strong>Colunas detectadas:</strong> {Object.keys(preview[0]).slice(0, 6).join(", ")}
                {Object.keys(preview[0]).length > 6 && "..."}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={!preview?.length || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
