import { useState, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useCidades } from "@/hooks/useSupabaseData";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Download, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

interface ImportRow {
  tipo: "lideranca" | "cabo";
  nome: string;
  lider_vinculado?: string;
  telefone?: string;
  whatsapp?: string;
  cidade_base?: string;
  coordenador?: string;
  votos_estimados?: number;
  forca_politica?: string;
  status?: string;
  zonas_eleitorais?: string;
  bairros?: string;
  observacoes?: string;
  dobradinha?: string;
  cargo_dobradinha?: string;
  _error?: string;
  _matched_cidade_id?: string;
  _matched_coord_id?: string;
  _matched_lider_id?: string;
  _is_duplicate?: boolean;
  _phone_match?: "lider" | "cabo" | null;
  _will_convert?: boolean;
}

function normalizePhone(s?: string): string {
  return (s || "").replace(/\D/g, "");
}

const TEMPLATE_COLUMNS = [
  "Tipo (lideranca/cabo)*",
  "Nome*",
  "Líder Vinculado (obrigatório se Tipo=cabo)",
  "Telefone",
  "WhatsApp",
  "Cidade Base*",
  "Coordenador",
  "Apoiadores Estimados",
  "Força Política (baixa/media/alta)",
  "Status (ativa/potencial/em_negociacao)",
  "Zonas Eleitorais",
  "Bairros",
  "Dobradinha (Nome do Parceiro)",
  "Cargo Dobradinha",
  "Observações",
];

const EXAMPLE_ROW = [
  "lideranca",
  "João Silva",
  "",
  "(11) 99999-0000",
  "(11) 99999-0000",
  "São Paulo",
  "Maria Santos",
  "500",
  "alta",
  "ativa",
  "001, 045, 120",
  "Centro, Vila Madalena",
  "Mario Frias",
  "Vereador",
  "Liderança importante na zona leste",
];

const EXAMPLE_ROW_CABO = [
  "cabo",
  "Pedro Souza",
  "João Silva",
  "(11) 98888-0000",
  "(11) 98888-0000",
  "São Paulo",
  "",
  "80",
  "",
  "",
  "",
  "Vila Madalena",
  "",
  "",
  "Cabo eleitoral vinculado ao líder João Silva",
];

function normalizeStr(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export default function ImportLiderancasDialog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [importResult, setImportResult] = useState({ success: 0, errors: 0, merged: 0, deleted: 0 });
  const [errorDetails, setErrorDetails] = useState<{ nome: string; motivo: string }[]>([]);
  const [replaceMode, setReplaceMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: cidades = [] } = useCidades();
  const { data: coordenadores = [] } = useCoordenadores();
  const queryClient = useQueryClient();

  const cidadeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cidades) {
      map.set(normalizeStr(c.nome), c.id);
    }
    return map;
  }, [cidades]);

  const coordNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of coordenadores) {
      map.set(normalizeStr(c.nome), c.user_id);
    }
    return map;
  }, [coordenadores]);

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLUMNS, EXAMPLE_ROW, EXAMPLE_ROW_CABO]);
    ws["!cols"] = TEMPLATE_COLUMNS.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, "Lideranças e Cabos");
    XLSX.writeFile(wb, "Modelo_Importacao_Liderancas_Cabos.xlsx");
    toast.success("Modelo baixado com sucesso!");
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

        if (jsonRows.length === 0) {
          toast.error("Planilha vazia. Use o modelo padrão.");
          return;
        }

        // Fetch existing liderancas to detect duplicates + resolve cabo→líder
        const { data: existingLiderancas } = await supabase.from("liderancas").select("id, nome, telefone, whatsapp");
        const { data: existingCabos } = await supabase.from("cabos_eleitorais").select("id, nome, telefone, whatsapp");
        const existingNames = new Set<string>();
        const liderIdByName = new Map<string, string>();
        const liderByPhone = new Map<string, { id: string; nome: string }>();
        const caboByPhone = new Map<string, { id: string; nome: string }>();
        for (const l of existingLiderancas || []) {
          existingNames.add(normalizeStr(l.nome));
          liderIdByName.set(normalizeStr(l.nome), l.id);
          const t = normalizePhone(l.telefone as any);
          const w = normalizePhone(l.whatsapp as any);
          if (t.length >= 10) liderByPhone.set(t, { id: l.id, nome: l.nome });
          if (w.length >= 10) liderByPhone.set(w, { id: l.id, nome: l.nome });
        }
        for (const c of existingCabos || []) {
          const t = normalizePhone((c as any).telefone);
          const w = normalizePhone((c as any).whatsapp);
          if (t.length >= 10) caboByPhone.set(t, { id: c.id, nome: c.nome });
          if (w.length >= 10) caboByPhone.set(w, { id: c.id, nome: c.nome });
        }
        // Track names seen in the file itself for intra-file duplicates
        const seenInFile = new Set<string>();
        // Track líderes que serão criados nesta mesma planilha para permitir vincular cabos
        const liderancasNoArquivo = new Set<string>();
        for (const row of jsonRows) {
          const t = String((row as any)["Tipo (lideranca/cabo)*"] ?? (row as any)["Tipo"] ?? (row as any)["tipo"] ?? "").trim().toLowerCase();
          const n = String((row as any)["Nome*"] ?? (row as any)["Nome"] ?? (row as any)["nome"] ?? "").trim();
          if (n && (t === "" || t === "lideranca" || t === "liderança" || t === "líder" || t === "lider")) {
            liderancasNoArquivo.add(normalizeStr(n));
          }
        }

        const parsed: ImportRow[] = jsonRows.map((row) => {
          const get = (keys: string[]): string => {
            for (const k of keys) {
              const val = row[k];
              if (val !== undefined && val !== null && String(val).trim()) return String(val).trim();
            }
            return "";
          };

          const tipoRaw = normalizeStr(get(["Tipo (lideranca/cabo)*", "Tipo", "tipo", "TIPO"]) || "lideranca");
          const tipo: "lideranca" | "cabo" = (tipoRaw === "cabo" || tipoRaw === "cabo eleitoral") ? "cabo" : "lideranca";

          const nome = get(["Nome*", "Nome", "nome", "NOME"]);
          const liderVinculado = get(["Líder Vinculado (obrigatório se Tipo=cabo)", "Líder Vinculado", "Lider Vinculado", "lider_vinculado", "Líder", "Lider"]);
          const telefone = get(["Telefone", "telefone", "TELEFONE", "Fone"]);
          const whatsapp = get(["WhatsApp", "whatsapp", "WHATSAPP", "Whats"]);
          const cidadeBase = get(["Cidade Base*", "Cidade Base", "cidade_base", "Cidade", "cidade", "CIDADE"]);
          const coordenador = get(["Coordenador", "coordenador", "COORDENADOR"]);
          const votosStr = get([
            "Apoiadores Estimados", "apoiadores_estimados", "Apoiadores estimados", "APOIADORES ESTIMADOS",
            "Apoiadores", "apoiadores", "APOIADORES",
            "Votos Estimados", "Votos estimados", "votos_estimados", "VOTOS ESTIMADOS",
            "Votos", "votos", "VOTOS",
            "Estimativa de Votos", "Estimativa Votos", "estimativa_votos",
            "Meta Votos", "Meta de Votos", "meta_votos",
            "Qtd Votos", "Quantidade de Votos", "qtd_votos",
          ]);
          const forca = get(["Força Política (baixa/media/alta)", "Força Política", "forca_politica", "Força", "forca", "FORÇA"]);
          const status = get(["Status (ativa/potencial/em_negociacao)", "Status", "status", "STATUS"]);
          const zonas = get(["Zonas Eleitorais", "zonas_eleitorais", "Zonas", "zonas", "ZONAS"]);
          const bairros = get(["Bairros", "bairros", "BAIRROS"]);
          const dobradinha = get(["Dobradinha (Nome do Parceiro)", "Dobradinha", "dobradinha", "DOBRADINHA", "Nome do Parceiro"]);
          const cargoDobradinha = get(["Cargo Dobradinha", "cargo_dobradinha", "Cargo", "cargo"]);
          const obs = get(["Observações", "observacoes", "Observações", "Obs", "obs"]);

          const votos = votosStr ? parseInt(votosStr.replace(/\D/g, ""), 10) || 0 : 0;

          const errors: string[] = [];
          if (!nome || nome.length < 2) errors.push("Nome obrigatório");

          let matchedLiderId: string | undefined;
          if (tipo === "cabo") {
            if (!liderVinculado) {
              errors.push("Líder Vinculado obrigatório para Cabo");
            } else {
              const key = normalizeStr(liderVinculado);
              matchedLiderId = liderIdByName.get(key);
              if (!matchedLiderId && !liderancasNoArquivo.has(key)) {
                errors.push(`Líder "${liderVinculado}" não encontrado`);
              }
            }
          } else {
            if (!cidadeBase) errors.push("Cidade Base obrigatória");
          }

          const matchedCidade = cidadeBase ? cidadeNameMap.get(normalizeStr(cidadeBase)) : undefined;
          if (cidadeBase && !matchedCidade) errors.push(`Cidade "${cidadeBase}" não encontrada`);

          const matchedCoord = coordenador ? coordNameMap.get(normalizeStr(coordenador)) : undefined;
          if (coordenador && !matchedCoord) errors.push(`Coordenador "${coordenador}" não encontrado`);

          const forcaNorm = normalizeStr(forca || "media");
          const validForca = ["baixa", "media", "alta"].includes(forcaNorm) ? forcaNorm : "media";

          const statusNorm = normalizeStr(status || "potencial");
          const validStatus = ["ativa", "potencial", "em_negociacao"].includes(statusNorm) ? statusNorm : "potencial";

          const nameKey = normalizeStr(nome);
          const phoneKey = normalizePhone(telefone);
          const waKey = normalizePhone(whatsapp);
          const phoneKeys = [phoneKey, waKey].filter(k => k && k.length >= 10);
          let phoneMatch: "lider" | "cabo" | null = null;
          let phoneMatchedLiderId: string | undefined;
          for (const pk of phoneKeys) {
            if (liderByPhone.has(pk)) { phoneMatch = "lider"; phoneMatchedLiderId = liderByPhone.get(pk)!.id; break; }
            if (caboByPhone.has(pk)) { phoneMatch = "cabo"; break; }
          }
          const willConvert = !!phoneMatch && ((tipo === "cabo" && phoneMatch === "lider") || (tipo === "lideranca" && phoneMatch === "cabo"));
          const isDuplicate = (tipo === "lideranca" && (existingNames.has(nameKey) || seenInFile.has(nameKey))) || (!!phoneMatch && !willConvert);
          if (tipo === "lideranca") seenInFile.add(nameKey);

          return {
            tipo,
            nome,
            lider_vinculado: liderVinculado || undefined,
            telefone: telefone || undefined,
            whatsapp: whatsapp || undefined,
            cidade_base: cidadeBase,
            coordenador: coordenador || undefined,
            votos_estimados: votos,
            forca_politica: validForca,
            status: validStatus,
            zonas_eleitorais: zonas || undefined,
            bairros: bairros || undefined,
            dobradinha: dobradinha || undefined,
            cargo_dobradinha: cargoDobradinha || undefined,
            observacoes: obs || undefined,
            _error: errors.length > 0 ? errors.join("; ") : undefined,
            _matched_cidade_id: matchedCidade,
            _matched_coord_id: matchedCoord,
            _matched_lider_id: matchedLiderId || (tipo === "cabo" && phoneMatch === "lider" ? undefined : phoneMatchedLiderId),
            _is_duplicate: isDuplicate,
            _phone_match: phoneMatch,
            _will_convert: willConvert,
          };
        });

        setRows(parsed);
        setStep("preview");
      } catch {
        toast.error("Erro ao ler planilha. Verifique o formato.");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  const validRows = rows.filter((r) => !r._error);
  const errorRows = rows.filter((r) => r._error);

  async function handleImport() {
    if (validRows.length === 0) {
      toast.error("Nenhuma linha válida para importar.");
      return;
    }
    setImporting(true);
    let success = 0;
    let merged = 0;
    let errors = 0;
    const errorList: { nome: string; motivo: string }[] = [];

    // Fetch existing liderancas and cabos to detect duplicates by name/phone
    const { data: existingLiderancas } = await supabase.from("liderancas").select("*");
    const { data: existingCabos } = await supabase.from("cabos_eleitorais").select("*");
    const existingByName = new Map<string, any>();
    const liderByPhone = new Map<string, any>();
    const caboByPhone = new Map<string, any>();
    // Also track liderancas created during this import batch (for same-name rows in same file)
    const batchCreated = new Map<string, string>(); // normalizedName -> id

    for (const l of existingLiderancas || []) {
      existingByName.set(normalizeStr(l.nome), l);
      const t = normalizePhone((l as any).telefone);
      const w = normalizePhone((l as any).whatsapp);
      if (t.length >= 10) liderByPhone.set(t, l);
      if (w.length >= 10) liderByPhone.set(w, l);
    }
    for (const c of existingCabos || []) {
      const t = normalizePhone((c as any).telefone);
      const w = normalizePhone((c as any).whatsapp);
      if (t.length >= 10) caboByPhone.set(t, c);
      if (w.length >= 10) caboByPhone.set(w, c);
    }

    const rowPhonesOf = (r: ImportRow) =>
      [normalizePhone(r.telefone), normalizePhone(r.whatsapp)].filter((p) => p.length >= 10);

    let cabosOk = 0;
    let converted = 0;
    // Process líderes primeiro para que cabos possam vincular a líderes recém-criados
    const liderRows = validRows.filter((r) => r.tipo === "lideranca");
    const caboRows = validRows.filter((r) => r.tipo === "cabo");

    for (const row of liderRows) {
      const zonasPorCidade: Record<string, string[]> = {};
      if (row.zonas_eleitorais && row._matched_cidade_id) {
        const zonasArr = row.zonas_eleitorais.split(/[,;]/).map((z) => z.trim()).filter(Boolean);
        if (zonasArr.length > 0) {
          zonasPorCidade[row._matched_cidade_id] = zonasArr;
        }
      }

      const bairrosArr = row.bairros
        ? row.bairros.split(/[,;]/).map((b) => b.trim()).filter(Boolean)
        : [];

      const nameKey = normalizeStr(row.nome);
      const existing = existingByName.get(nameKey);
      const batchId = batchCreated.get(nameKey);

      // Phone-based match: convert cabo→líder if phone corresponds to an existing cabo
      const rowPhones = rowPhonesOf(row);
      for (const p of rowPhones) {
        if (caboByPhone.has(p)) {
          const oldCabo = caboByPhone.get(p);
          try {
            await supabase.from("cabos_eleitorais").delete().eq("id", oldCabo.id);
            caboByPhone.delete(p);
            converted++;
          } catch (e) { /* ignore */ }
        }
      }
      // Phone-based match: existing líder with same phone → override with list values
      let phoneLider: any = null;
      for (const p of rowPhones) {
        if (liderByPhone.has(p)) { phoneLider = liderByPhone.get(p); break; }
      }
      if (!existing && !batchId && phoneLider) {
        try {
          const { error: upErr } = await supabase.from("liderancas").update({
            nome: row.nome,
            telefone: row.telefone || null,
            whatsapp: row.whatsapp || null,
            cidade_base_id: row._matched_cidade_id || phoneLider.cidade_base_id,
            coordenador_user_id: row._matched_coord_id || phoneLider.coordenador_user_id || null,
            votos_estimados: row.votos_estimados || 0,
            forca_politica: row.forca_politica as "baixa" | "media" | "alta",
            status: row.status as "ativa" | "potencial" | "em_negociacao",
            zonas_por_cidade: zonasPorCidade,
            bairros: bairrosArr,
            observacoes: row.observacoes || phoneLider.observacoes || null,
            cidades_representadas: row._matched_cidade_id ? [row._matched_cidade_id] : (phoneLider.cidades_representadas || []),
            votos_por_cidade: row._matched_cidade_id && (row.votos_estimados || 0) > 0
              ? { [row._matched_cidade_id]: row.votos_estimados || 0 } : {},
          } as any).eq("id", phoneLider.id);
          if (upErr) throw upErr;
          merged++; success++;
          batchCreated.set(nameKey, phoneLider.id);
          existingByName.set(nameKey, { ...phoneLider, ...row, id: phoneLider.id });
        } catch (err: any) {
          errorList.push({ nome: row.nome, motivo: `Erro ao atualizar por telefone: ${err?.message || String(err)}` });
          errors++;
        }
        continue;
      }


      if (existing || batchId) {
        // OVERWRITE existing record with values from the file (exactly as uploaded)
        try {
          const targetId = existing?.id || batchId;
          const newCidade = row._matched_cidade_id!;
          const votos = row.votos_estimados || 0;

          // If the same líder repeats within the same file, accumulate cidades/votos
          // ONLY from this batch — never from what was in the DB before.
          const { data: current } = await supabase.from("liderancas").select("*").eq("id", targetId).single();
          const isBatchDup = !!batchId && !!current;

          const cidadesRepresentadas = isBatchDup
            ? [...new Set([...(((current!.cidades_representadas as string[]) || [])), newCidade])]
            : [newCidade];

          const votosPorCidade: Record<string, number> = isBatchDup
            ? { ...((current!.votos_por_cidade as Record<string, number>) || {}) }
            : {};
          if (votos > 0) votosPorCidade[newCidade] = votos;
          const totalVotos = Object.values(votosPorCidade).reduce((s, v) => s + v, 0);

          const zonasFinal: Record<string, string[]> = isBatchDup
            ? { ...((current!.zonas_por_cidade as Record<string, string[]>) || {}) }
            : {};
          for (const [cid, zonas] of Object.entries(zonasPorCidade)) {
            zonasFinal[cid] = zonas;
          }

          const { error: updateError } = await supabase.from("liderancas").update({
            nome: row.nome,
            cidade_base_id: newCidade,
            cidades_representadas: cidadesRepresentadas,
            votos_por_cidade: votosPorCidade,
            votos_estimados: totalVotos,
            zonas_por_cidade: zonasFinal,
            bairros: bairrosArr,
            observacoes: row.observacoes || null,
            telefone: row.telefone || null,
            whatsapp: row.whatsapp || null,
            coordenador_user_id: row._matched_coord_id || null,
            forca_politica: row.forca_politica as "baixa" | "media" | "alta",
            status: row.status as "ativa" | "potencial" | "em_negociacao",
          } as any).eq("id", targetId);

          if (updateError) throw updateError;

          merged++;
          success++;
          batchCreated.set(nameKey, targetId);
          existingByName.set(nameKey, { id: targetId, ...row });

          // Create dobradinha if provided
          if (row.dobradinha) {
            await supabase.from("dobradinhas").insert({
              candidato_parceiro: row.dobradinha,
              cargo_parceiro: row.cargo_dobradinha || null,
              lideranca_id: targetId,
              cidade_id: row._matched_cidade_id || null,
              coordenador_user_id: row._matched_coord_id || null,
            });
          }
        } catch (err: any) {
          console.error("Overwrite error:", err);
          errorList.push({ nome: row.nome, motivo: `Erro ao atualizar: ${err?.message || String(err)}` });
          errors++;
        }
      } else {
        // INSERT new record
        const { data: insertedLideranca, error } = await supabase.from("liderancas").insert({
          nome: row.nome,
          telefone: row.telefone || null,
          whatsapp: row.whatsapp || null,
          cidade_base_id: row._matched_cidade_id!,
          coordenador_user_id: row._matched_coord_id || null,
          votos_estimados: row.votos_estimados || 0,
          forca_politica: row.forca_politica as "baixa" | "media" | "alta",
          status: row.status as "ativa" | "potencial" | "em_negociacao",
          zonas_por_cidade: zonasPorCidade,
          bairros: bairrosArr,
          observacoes: row.observacoes || null,
          cidades_representadas: row._matched_cidade_id ? [row._matched_cidade_id] : [],
          votos_por_cidade: row._matched_cidade_id && (row.votos_estimados || 0) > 0
            ? { [row._matched_cidade_id]: row.votos_estimados || 0 }
            : {},
        }).select("id").single();

        if (error) {
          console.error("Import error:", error);
          errorList.push({ nome: row.nome, motivo: error.message || "Erro desconhecido ao inserir" });
          errors++;
        } else {
          success++;
          batchCreated.set(nameKey, insertedLideranca.id);
          existingByName.set(nameKey, { id: insertedLideranca.id, ...row });

          // Create dobradinha if provided
          if (row.dobradinha && insertedLideranca?.id) {
            const { error: dobError } = await supabase.from("dobradinhas").insert({
              candidato_parceiro: row.dobradinha,
              cargo_parceiro: row.cargo_dobradinha || null,
              lideranca_id: insertedLideranca.id,
              cidade_id: row._matched_cidade_id || null,
              coordenador_user_id: row._matched_coord_id || null,
            });
            if (dobError) {
              console.error("Dobradinha import error:", dobError);
            }
          }
        }
      }
    }

    // Segunda fase: cabos eleitorais
    for (const row of caboRows) {
      try {
        const rowPhones = rowPhonesOf(row);

        // Se telefone bate com um líder existente → converter líder→cabo (remove líder)
        for (const p of rowPhones) {
          if (liderByPhone.has(p)) {
            const oldLider = liderByPhone.get(p);
            try {
              await supabase.from("liderancas").delete().eq("id", oldLider.id);
              liderByPhone.delete(p);
              // remove também de existingByName para não interferir depois
              existingByName.delete(normalizeStr(oldLider.nome));
              converted++;
            } catch (e: any) {
              throw new Error(`Não foi possível converter líder em cabo (${oldLider.nome}): ${e?.message || e}`);
            }
          }
        }

        // Se telefone bate com um cabo já existente → UPDATE (manter conforme a lista)
        let existingCabo: any = null;
        for (const p of rowPhones) {
          if (caboByPhone.has(p)) { existingCabo = caboByPhone.get(p); break; }
        }

        let liderId = row._matched_lider_id;
        if (!liderId && row.lider_vinculado) {
          const key = normalizeStr(row.lider_vinculado);
          liderId = batchCreated.get(key) || existingByName.get(key)?.id;
        }
        if (!liderId && existingCabo) {
          liderId = existingCabo.lider_id;
        }
        if (!liderId) {
          errorList.push({ nome: row.nome, motivo: `Líder "${row.lider_vinculado}" não encontrado` });
          errors++;
          continue;
        }

        if (existingCabo) {
          const { error: upErr } = await supabase.from("cabos_eleitorais").update({
            nome: row.nome,
            lider_id: liderId,
            telefone: row.telefone || null,
            whatsapp: row.whatsapp || null,
            cidade_base_id: row._matched_cidade_id || existingCabo.cidade_base_id || null,
            votos_estimados: row.votos_estimados || 0,
            bairro: row.bairros || existingCabo.bairro || null,
            observacoes: row.observacoes || existingCabo.observacoes || null,
          } as any).eq("id", existingCabo.id);
          if (upErr) throw upErr;
          merged++; success++;
        } else {
          const { error: caboErr } = await supabase.from("cabos_eleitorais").insert({
            nome: row.nome,
            lider_id: liderId,
            telefone: row.telefone || null,
            whatsapp: row.whatsapp || null,
            cidade_base_id: row._matched_cidade_id || null,
            votos_estimados: row.votos_estimados || 0,
            bairro: row.bairros || null,
            observacoes: row.observacoes || null,
          });
          if (caboErr) throw caboErr;
          cabosOk++;
          success++;
        }
      } catch (err: any) {
        console.error("Cabo import error:", err);
        errorList.push({ nome: row.nome, motivo: `Erro ao importar cabo: ${err?.message || String(err)}` });
        errors++;
      }
    }


    // REPLACE MODE: delete records of coordinators/cidades in the file that weren't in the list
    let deleted = 0;
    if (replaceMode) {
      const coordIds = new Set(validRows.map(r => r._matched_coord_id).filter(Boolean) as string[]);
      const cidadeIds = new Set(validRows.map(r => r._matched_cidade_id).filter(Boolean) as string[]);
      const keepLiderNames = new Set(validRows.filter(r => r.tipo === "lideranca").map(r => normalizeStr(r.nome)));
      const keepLiderPhones = new Set<string>();
      for (const r of validRows.filter(r => r.tipo === "lideranca")) {
        const t = normalizePhone(r.telefone); if (t.length >= 10) keepLiderPhones.add(t);
        const w = normalizePhone(r.whatsapp); if (w.length >= 10) keepLiderPhones.add(w);
      }
      const keepCaboNames = new Set(validRows.filter(r => r.tipo === "cabo").map(r => normalizeStr(r.nome)));
      const keepCaboPhones = new Set<string>();
      for (const r of validRows.filter(r => r.tipo === "cabo")) {
        const t = normalizePhone(r.telefone); if (t.length >= 10) keepCaboPhones.add(t);
        const w = normalizePhone(r.whatsapp); if (w.length >= 10) keepCaboPhones.add(w);
      }

      if (coordIds.size > 0 || cidadeIds.size > 0) {
        const { data: allLid } = await supabase.from("liderancas").select("id, nome, telefone, whatsapp, coordenador_user_id, cidade_base_id");
        const toDelete: string[] = [];
        for (const l of allLid || []) {
          const inScope =
            (l.coordenador_user_id && coordIds.has(l.coordenador_user_id)) ||
            (l.cidade_base_id && cidadeIds.has(l.cidade_base_id));
          if (!inScope) continue;
          const nk = normalizeStr(l.nome);
          const tk = normalizePhone((l as any).telefone);
          const wk = normalizePhone((l as any).whatsapp);
          const keep = keepLiderNames.has(nk) ||
            (tk.length >= 10 && keepLiderPhones.has(tk)) ||
            (wk.length >= 10 && keepLiderPhones.has(wk));
          if (!keep) toDelete.push(l.id);
        }
        if (toDelete.length > 0) {
          const { error: delErr } = await supabase.from("liderancas").delete().in("id", toDelete);
          if (!delErr) deleted += toDelete.length;
        }

        const { data: allCabos } = await supabase
          .from("cabos_eleitorais")
          .select("id, nome, telefone, whatsapp, lider_id, liderancas!inner(coordenador_user_id, cidade_base_id)");
        const cabosToDelete: string[] = [];
        for (const c of (allCabos as any[]) || []) {
          const lid = c.liderancas;
          const inScope =
            (lid?.coordenador_user_id && coordIds.has(lid.coordenador_user_id)) ||
            (lid?.cidade_base_id && cidadeIds.has(lid.cidade_base_id));
          if (!inScope) continue;
          const nk = normalizeStr(c.nome);
          const tk = normalizePhone(c.telefone);
          const wk = normalizePhone(c.whatsapp);
          const keep = keepCaboNames.has(nk) ||
            (tk.length >= 10 && keepCaboPhones.has(tk)) ||
            (wk.length >= 10 && keepCaboPhones.has(wk));
          if (!keep) cabosToDelete.push(c.id);
        }
        if (cabosToDelete.length > 0) {
          const { error: delErr } = await supabase.from("cabos_eleitorais").delete().in("id", cabosToDelete);
          if (!delErr) deleted += cabosToDelete.length;
        }
      }
    }

    setImportResult({ success, errors, merged, deleted });
    setErrorDetails(errorList);
    setStep("done");
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["liderancas"] });
    queryClient.invalidateQueries({ queryKey: ["dobradinhas"] });
    queryClient.invalidateQueries({ queryKey: ["cabos_eleitorais"] });
    if (cabosOk > 0) toast.success(`${cabosOk} cabo(s) eleitoral(is) importado(s).`);
    if (converted > 0) toast.info(`${converted} registro(s) convertido(s) entre Líder/Cabo por telefone.`);
    if (deleted > 0) toast.info(`${deleted} registro(s) removido(s) por não constar na lista.`);
  }


  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setRows([]);
      setStep("upload");
      setImportResult({ success: 0, errors: 0, merged: 0, deleted: 0 });
      setErrorDetails([]);
    }, 200);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Importar Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[calc(100dvh-1rem)] flex flex-col overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Lideranças e Cabos via Excel
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm">Como funciona:</h3>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal ml-4">
                <li>Baixe o <strong>modelo padrão</strong> clicando no botão abaixo</li>
                <li>Na coluna <strong>Tipo</strong>, informe <code>lideranca</code> ou <code>cabo</code></li>
                <li>Para <strong>cabos</strong>, preencha a coluna <strong>Líder Vinculado</strong> com o nome exato de uma liderança já cadastrada (ou de uma liderança nova incluída na mesma planilha)</li>
                <li>Os nomes de <strong>Cidade</strong> e <strong>Coordenador</strong> devem ser iguais aos cadastrados no sistema</li>
                <li>Zonas Eleitorais e Bairros: separe por vírgula (ex: "001, 045, 120")</li>
                <li><strong>Dobradinha:</strong> preencha o nome do candidato parceiro para criar automaticamente (apenas para lideranças)</li>
                <li>Importe o arquivo preenchido</li>
              </ol>
            </div>


            <div className="flex gap-3">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Modelo Padrão
              </Button>
            </div>

            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Selecione o arquivo Excel preenchido</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFile}
                className="hidden"
              />
              <Button onClick={() => fileRef.current?.click()}>
                Selecionar Arquivo
              </Button>
            </div>

            <label className="flex items-start gap-3 p-3 border border-amber-500/40 bg-amber-500/5 rounded-md cursor-pointer">
              <input
                type="checkbox"
                checked={replaceMode}
                onChange={(e) => setReplaceMode(e.target.checked)}
                className="mt-1"
              />
              <div className="text-sm">
                <div className="font-semibold text-amber-700 dark:text-amber-400">
                  Substituição completa (espelhar a lista)
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Após importar, remove lideranças e cabos dos coordenadores/cidades presentes no arquivo que <strong>não</strong> estão na lista. Use quando quiser que o banco fique exatamente igual ao arquivo.
                </div>
              </div>
            </label>
          </div>
        )}

        {step === "preview" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="flex flex-wrap gap-3 items-center">
              <Badge variant="default" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {validRows.length} válida{validRows.length !== 1 ? "s" : ""}
              </Badge>
              {(() => {
                const dupCount = validRows.filter(r => r._is_duplicate).length;
                return dupCount > 0 ? (
                  <Badge className="text-xs bg-blue-600">
                    🔄 {dupCount} será{dupCount !== 1 ? "ão" : ""} mesclada{dupCount !== 1 ? "s" : ""} (duplicada{dupCount !== 1 ? "s" : ""})
                  </Badge>
                ) : null;
              })()}
              {errorRows.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {errorRows.length} com erro{errorRows.length !== 1 ? "s" : ""}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                Duplicadas serão mescladas automaticamente
              </span>
            </div>

            <div className="overflow-auto flex-1 max-h-[50vh] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Líder Vinculado</TableHead>
                    <TableHead>Cidade Base</TableHead>
                    <TableHead>Coordenador</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Apoiadores</TableHead>
                    <TableHead>Zonas</TableHead>
                    <TableHead>Dobradinha</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} className={r._error ? "bg-destructive/10" : r._is_duplicate ? "bg-blue-500/10" : ""}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={r.tipo === "cabo" ? "outline" : "default"} className="text-[10px] w-fit">
                            {r.tipo === "cabo" ? "Cabo" : "Líder"}
                          </Badge>
                          {r._will_convert && (
                            <Badge variant="outline" className="text-[10px] w-fit border-amber-500 text-amber-600 whitespace-nowrap">
                              🔄 {r._phone_match === "lider" ? "Líder → Cabo" : "Cabo → Líder"}
                            </Badge>
                          )}
                          {!r._will_convert && r._phone_match && (
                            <Badge variant="outline" className="text-[10px] w-fit border-blue-500 text-blue-600 whitespace-nowrap">
                              atualizar
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {r.nome || "—"}
                        {r._is_duplicate && !r._error && (
                          <Badge variant="outline" className="ml-1 text-[10px] border-blue-500 text-blue-500">mesclar</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.tipo === "cabo"
                          ? (r.lider_vinculado
                              ? (r._matched_lider_id
                                  ? <span className="text-green-600">{r.lider_vinculado}</span>
                                  : <span className="text-amber-600">{r.lider_vinculado} (novo)</span>)
                              : <span className="text-destructive">—</span>)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r._matched_cidade_id ? (
                          <span className="text-green-600">{r.cidade_base}</span>
                        ) : (
                          <span className="text-destructive">{r.cidade_base || "—"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.coordenador ? (
                          r._matched_coord_id ? (
                            <span className="text-green-600">{r.coordenador}</span>
                          ) : (
                            <span className="text-destructive">{r.coordenador}</span>
                          )
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{r.telefone || "—"}</TableCell>
                      <TableCell className="text-sm">{r.votos_estimados || 0}</TableCell>
                      <TableCell className="text-sm text-xs">{r.zonas_eleitorais || "—"}</TableCell>
                      <TableCell className="text-sm text-xs">
                        {r.dobradinha ? (
                          <span>{r.dobradinha}{r.cargo_dobradinha ? ` (${r.cargo_dobradinha})` : ""}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {r._error ? (
                          <span className="text-destructive text-xs">{r._error}</span>
                        ) : (
                          <Badge variant="secondary" className="text-xs">{r.status}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep("upload"); setRows([]); }}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={importing || validRows.length === 0}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar {validRows.length} registro{validRows.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
            <h3 className="text-lg font-semibold">Importação concluída!</h3>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                ✅ {importResult.success} liderança{importResult.success !== 1 ? "s" : ""} importada{importResult.success !== 1 ? "s" : ""} com sucesso
              </p>
              {importResult.merged > 0 && (
                <p className="text-sm text-blue-500">
                  🔄 {importResult.merged} liderança{importResult.merged !== 1 ? "s" : ""} mesclada{importResult.merged !== 1 ? "s" : ""} (nome duplicado)
                </p>
              )}
              {importResult.deleted > 0 && (
                <p className="text-sm text-amber-600">
                  🗑️ {importResult.deleted} registro{importResult.deleted !== 1 ? "s" : ""} removido{importResult.deleted !== 1 ? "s" : ""} (não estava{importResult.deleted !== 1 ? "m" : ""} na lista)
                </p>
              )}
              {importResult.errors > 0 && (
                <p className="text-sm text-destructive">
                  ❌ {importResult.errors} erro{importResult.errors !== 1 ? "s" : ""} ao importar
                </p>
              )}
            </div>
            {errorDetails.length > 0 && (
              <div className="text-left max-h-64 overflow-auto border border-destructive/30 rounded-md bg-destructive/5 p-3 space-y-2">
                <p className="text-sm font-semibold text-destructive">Detalhes dos erros:</p>
                <ul className="text-xs space-y-1">
                  {errorDetails.map((e, i) => (
                    <li key={i} className="break-words">
                      <span className="font-medium">{e.nome || "(sem nome)"}:</span>{" "}
                      <span className="text-destructive">{e.motivo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
