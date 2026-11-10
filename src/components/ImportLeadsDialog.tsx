import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileUp, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function parseCSV(text: string): any[] {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
      } else if (ch === sep && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: any = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim(); });
    return row;
  });
}

function pick(row: any, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export default function ImportLeadsDialog() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => { setFile(null); setPreview(null); };

  const handleFile = async (f: File) => {
    setFile(f);
    try {
      const text = await f.text();
      const rows = parseCSV(text);
      if (!rows.length) throw new Error("Arquivo vazio");
      setPreview(rows);
    } catch (err: any) {
      toast.error("Erro ao ler arquivo: " + (err.message || "formato inválido"));
      setFile(null); setPreview(null);
    }
  };

  const handleImport = async () => {
    if (!preview?.length || !session?.user?.id) return;
    setSaving(true);
    try {
      const { data: cidades } = await supabase.from("cidades").select("id,nome");
      const cidadeByName = new Map<string, string>();
      (cidades || []).forEach((c: any) => cidadeByName.set(String(c.nome).toLowerCase().trim(), c.id));

      const normalizePhone = (p: string) => (p || "").replace(/\D+/g, "");

      // Fetch existing phones to dedupe against DB
      const { data: existentes } = await supabase
        .from("eleitores_captados" as never)
        .select("telefone") as any;
      const existingPhones = new Set<string>();
      (existentes || []).forEach((e: any) => {
        const n = normalizePhone(e.telefone || "");
        if (n) existingPhones.add(n);
      });

      const seenInFile = new Set<string>();
      let dupFile = 0;
      let dupDb = 0;

      const registros = preview
        .map((r) => {
          const nome = pick(r, "nome_completo", "nome");
          if (!nome) return null;
          const telefone = pick(r, "telefone", "whatsapp", "celular");
          const normalized = normalizePhone(telefone);
          if (normalized) {
            if (seenInFile.has(normalized)) { dupFile++; return null; }
            if (existingPhones.has(normalized)) { dupDb++; return null; }
            seenInFile.add(normalized);
          }
          const cidadeNome = pick(r, "cidade_nome", "cidade");
          const bairro = pick(r, "bairro");
          const obs = pick(r, "observacoes", "observação", "observacao", "obs");
          const cidadeId = cidadeNome ? cidadeByName.get(cidadeNome.toLowerCase()) || null : null;
          return {
            nome_completo: nome,
            telefone: telefone || null,
            bairro: bairro || null,
            cidade_id: cidadeId,
            cidade_nome: cidadeNome || null,
            observacoes: obs || null,
            origem: "importacao_csv",
            tipo_captador: "usuario",
            captado_por_user_id: session.user.id,
          };
        })
        .filter(Boolean) as any[];

      if (!registros.length) {
        const msg = (dupFile + dupDb) > 0
          ? `Nenhum registro novo. ${dupFile} duplicado(s) no arquivo, ${dupDb} já cadastrado(s).`
          : "Nenhum registro válido encontrado";
        throw new Error(msg);
      }

      const chunkSize = 200;
      let inserted = 0;
      let errors = 0;
      for (let i = 0; i < registros.length; i += chunkSize) {
        const chunk = registros.slice(i, i + chunkSize);
        const { error } = await supabase.from("eleitores_captados" as never).insert(chunk as never);
        if (error) errors += chunk.length; else inserted += chunk.length;
      }

      const extras: string[] = [];
      if (dupFile) extras.push(`${dupFile} duplicado(s) no arquivo`);
      if (dupDb) extras.push(`${dupDb} já cadastrado(s)`);
      if (errors) extras.push(`${errors} com erro`);
      const suffix = extras.length ? ` — ${extras.join(", ")}` : "";

      if (inserted) toast.success(`${inserted} lead(s) importado(s)${suffix}`);
      else toast.error(`Nenhum lead foi importado${suffix}`);

      setOpen(false); reset();
      setTimeout(() => qc.invalidateQueries({ queryKey: ["leads-eleitores"] }), 150);
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar");
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" /> Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[calc(100dvh-1rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>Importar Leads (CSV)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3 space-y-1">
            <p><strong>Colunas aceitas</strong> (separador <code>;</code> ou <code>,</code>):</p>
            <p>• <code>nome_completo</code> (obrigatório) • <code>telefone</code> • <code>cidade_nome</code> • <code>bairro</code> • <code>observacoes</code></p>
            <p>Cada lead será registrado como captado por você.</p>
          </div>

          <div className="space-y-2">
            <Label>Arquivo (.csv)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
              <input
                id="leads-file-input"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <label htmlFor="leads-file-input" className="cursor-pointer flex flex-col items-center gap-2">
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
                    <p className="text-xs text-muted-foreground">CSV UTF-8 (separador ; ou ,)</p>
                  </>
                )}
              </label>
            </div>
            {preview && preview.length > 0 && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                <strong>Colunas detectadas:</strong> {Object.keys(preview[0]).slice(0, 8).join(", ")}
                {Object.keys(preview[0]).length > 8 && "..."}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={!preview?.length || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Importar {preview?.length ? `(${preview.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
