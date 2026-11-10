import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConfirmStatus = "confirmado" | "nao_confirmado";

const SENT_KEY = "leads:wa-sent:v1";
const CONFIRM_KEY = "leads:wa-confirm:v1";
const OBS_KEY = "leads:wa-obs:v1";
const OBS_AUTHOR_KEY = "leads:wa-obs-author:v1";
const OBS_AUTHOR_NAMES_KEY = "leads:wa-obs-author-names:v1";
const STATUS_AUTHOR_KEY = "leads:wa-status-author:v1";
const SYNCED_KEY = "leads:status-migrated:v1";

export function phoneKey(phone: string | null | undefined): string {
  const d = (phone || "").replace(/\D/g, "");
  return d.startsWith("55") ? d : d ? `55${d}` : "";
}

function load<T>(k: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch { return {}; }
}
function save<T>(k: string, v: Record<string, T>) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

export function loadSentMap() { return load<string>(SENT_KEY); }
export function saveSentMap(m: Record<string, string>) { save(SENT_KEY, m); }
export function loadConfirmMap() { return load<ConfirmStatus>(CONFIRM_KEY); }
export function saveConfirmMap(m: Record<string, ConfirmStatus>) { save(CONFIRM_KEY, m); }
export function loadObsMap() { return load<string>(OBS_KEY); }
export function saveObsMap(m: Record<string, string>) { save(OBS_KEY, m); }
export function loadObsAuthorMap() { return load<string>(OBS_AUTHOR_KEY); }
export function saveObsAuthorMap(m: Record<string, string>) { save(OBS_AUTHOR_KEY, m); }
export function loadStatusAuthorMap() { return load<string>(STATUS_AUTHOR_KEY); }
export function saveStatusAuthorMap(m: Record<string, string>) { save(STATUS_AUTHOR_KEY, m); }
export function loadObsAuthorNames() { return load<string>(OBS_AUTHOR_NAMES_KEY); }
export function saveObsAuthorNames(m: Record<string, string>) { save(OBS_AUTHOR_NAMES_KEY, m); }


const EVT = "leads:status-changed";

async function upsertRemote(phone: string, patch: {
  confirm_status?: ConfirmStatus | null;
  observacao?: string | null;
  sent_at?: string | null;
}) {
  const key = phoneKey(phone);
  if (!key) return;
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    const row: Record<string, unknown> = { phone_key: key, updated_by: uid };
    if ("confirm_status" in patch) row.confirm_status = patch.confirm_status;
    if ("observacao" in patch) row.observacao = patch.observacao;
    if ("sent_at" in patch) row.sent_at = patch.sent_at;
    await supabase.from("lead_contact_status" as never).upsert(row as never, { onConflict: "phone_key" });
  } catch (e) {
    console.warn("[useLeadStatus] falha ao sincronizar", e);
  }
}

async function fetchAllRemote(): Promise<{
  sent: Record<string, string>;
  confirm: Record<string, ConfirmStatus>;
  obs: Record<string, string>;
  authors: Record<string, string>;
  statusAuthors: Record<string, string>;
}> {
  const sent: Record<string, string> = {};
  const confirm: Record<string, ConfirmStatus> = {};
  const obs: Record<string, string> = {};
  const authors: Record<string, string> = {};
  const statusAuthors: Record<string, string> = {};
  const pageSize = 1000;
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("lead_contact_status" as never)
      .select("phone_key,confirm_status,observacao,sent_at,updated_by")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Array<{
      phone_key: string;
      confirm_status: ConfirmStatus | null;
      observacao: string | null;
      sent_at: string | null;
      updated_by: string | null;
    }>;
    for (const r of rows) {
      if (r.sent_at) sent[r.phone_key] = r.sent_at;
      if (r.confirm_status) confirm[r.phone_key] = r.confirm_status;
      if (r.observacao) obs[r.phone_key] = r.observacao;
      if (r.observacao && r.updated_by) authors[r.phone_key] = r.updated_by;
      if (r.confirm_status && r.updated_by) statusAuthors[r.phone_key] = r.updated_by;
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return { sent, confirm, obs, authors, statusAuthors };
}

async function fetchAuthorNames(ids: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  if (ids.length === 0) return names;
  try {
    const { data } = await supabase.from("profiles").select("user_id,nome").in("user_id", ids);
    (data ?? []).forEach((p: { user_id: string; nome: string }) => {
      if (p.user_id && p.nome) names[p.user_id] = p.nome;
    });
  } catch (e) {
    console.warn("[useLeadStatus] falha ao buscar nomes dos operadores", e);
  }
  return names;
}


// IMPORTANTE: o banco é a única fonte de verdade.
// Antigamente o cache local era enviado ao banco na primeira carga de cada
// navegador, o que sobrescrevia (com dados antigos) marcações feitas por
// outros operadores. Isso fazia status "não confirmado" voltar para
// "confirmado" de um dia para o outro. Agora o local é apenas cache de leitura.
function markMigrationDone() {
  try { localStorage.setItem(SYNCED_KEY, "1"); } catch { /* ignore */ }
}

let syncing: Promise<void> | null = null;
async function syncFromRemote() {
  if (syncing) return syncing;
  syncing = (async () => {
    markMigrationDone();
    try {
      const remote = await fetchAllRemote();
      saveSentMap(remote.sent);
      saveConfirmMap(remote.confirm);
      saveObsMap(remote.obs);
      saveObsAuthorMap(remote.authors);
      saveStatusAuthorMap(remote.statusAuthors);
      const ids = Array.from(new Set([...Object.values(remote.authors), ...Object.values(remote.statusAuthors)]));
      saveObsAuthorNames(await fetchAuthorNames(ids));
      window.dispatchEvent(new Event(EVT));
    } catch (e) {
      console.warn("[useLeadStatus] falha ao baixar do banco", e);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

async function fetchRemoteStatus(key: string): Promise<ConfirmStatus | null> {
  const { data, error } = await supabase
    .from("lead_contact_status" as never)
    .select("confirm_status")
    .eq("phone_key", key)
    .maybeSingle();
  if (error) throw error;
  return ((data as unknown as { confirm_status: ConfirmStatus | null } | null)?.confirm_status) ?? null;
}


export function useLeadStatus() {
  const [sentMap, setSentMap] = useState<Record<string, string>>({});
  const [confirmMap, setConfirmMap] = useState<Record<string, ConfirmStatus>>({});
  const [obsMap, setObsMap] = useState<Record<string, string>>({});
  const [obsAuthorMap, setObsAuthorMap] = useState<Record<string, string>>({});
  const [statusAuthorMap, setStatusAuthorMap] = useState<Record<string, string>>({});
  const [obsAuthorNames, setObsAuthorNames] = useState<Record<string, string>>({});
  const inited = useRef(false);

  const refresh = useCallback(() => {
    setSentMap(loadSentMap());
    setConfirmMap(loadConfirmMap());
    setObsMap(loadObsMap());
    setObsAuthorMap(loadObsAuthorMap());
    setStatusAuthorMap(loadStatusAuthorMap());
    setObsAuthorNames(loadObsAuthorNames());
  }, []);


  useEffect(() => {
    refresh();
    if (!inited.current) {
      inited.current = true;
      syncFromRemote().then(refresh);
    }
    const h = () => refresh();
    // Ao voltar para a aba, revalida com o banco (fonte de verdade)
    const onFocus = () => { syncFromRemote().then(refresh); };
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener(EVT, h);
      window.removeEventListener("storage", h);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);


  const markSent = useCallback((phone: string | null) => {
    const k = phoneKey(phone);
    if (!k) return;
    const ts = new Date().toISOString();
    const next = { ...loadSentMap(), [k]: ts };
    saveSentMap(next);
    window.dispatchEvent(new Event(EVT));
    upsertRemote(phone || "", { sent_at: ts });
  }, []);

  const recordStatusAuthor = useCallback(async (k: string, has: boolean) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const authors = { ...loadStatusAuthorMap() };
      if (has && uid) {
        authors[k] = uid;
        const names = { ...loadObsAuthorNames() };
        if (!names[uid]) saveObsAuthorNames({ ...names, ...(await fetchAuthorNames([uid])) });
      } else {
        delete authors[k];
      }
      saveStatusAuthorMap(authors);
      window.dispatchEvent(new Event(EVT));
    } catch { /* ignore */ }
  }, []);

  const applyLocalConfirm = useCallback((k: string, status: ConfirmStatus | null) => {
    const map = { ...loadConfirmMap() };
    if (status) map[k] = status; else delete map[k];
    saveConfirmMap(map);
    window.dispatchEvent(new Event(EVT));
  }, []);

  const setConfirm = useCallback(async (phone: string | null, status: ConfirmStatus | null) => {
    const k = phoneKey(phone);
    if (!k) return;
    applyLocalConfirm(k, status);
    await upsertRemote(phone || "", { confirm_status: status });
    recordStatusAuthor(k, !!status);
  }, [recordStatusAuthor, applyLocalConfirm]);

  // Sempre lê o valor atual no banco antes de alternar, para nunca
  // sobrescrever a marcação feita por outro operador com cache antigo.
  const cycleConfirm = useCallback(async (phone: string | null): Promise<ConfirmStatus | null> => {
    const k = phoneKey(phone);
    if (!k) return null;
    let cur: ConfirmStatus | null;
    try {
      cur = await fetchRemoteStatus(k);
    } catch {
      cur = loadConfirmMap()[k] ?? null;
    }
    const nextStatus: ConfirmStatus | null =
      !cur ? "confirmado" : cur === "confirmado" ? "nao_confirmado" : null;
    applyLocalConfirm(k, nextStatus);
    await upsertRemote(phone || "", { confirm_status: nextStatus });
    recordStatusAuthor(k, !!nextStatus);
    return nextStatus;
  }, [recordStatusAuthor, applyLocalConfirm]);


  const setObs = useCallback((phone: string | null, text: string) => {
    const k = phoneKey(phone);
    if (!k) return;
    const map = { ...loadObsMap() };
    const trimmed = (text || "").trim().slice(0, 1000);
    if (trimmed) map[k] = trimmed; else delete map[k];
    saveObsMap(map);
    // registra o operador que fez a anotação
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        const authors = { ...loadObsAuthorMap() };
        if (trimmed && uid) {
          authors[k] = uid;
          const names = { ...loadObsAuthorNames() };
          if (!names[uid]) {
            const fetched = await fetchAuthorNames([uid]);
            saveObsAuthorNames({ ...names, ...fetched });
          }
        } else {
          delete authors[k];
        }
        saveObsAuthorMap(authors);
        window.dispatchEvent(new Event(EVT));
      } catch { /* ignore */ }
    })();
    window.dispatchEvent(new Event(EVT));
    upsertRemote(phone || "", { observacao: trimmed || null });
  }, []);

  return { sentMap, confirmMap, obsMap, obsAuthorMap, statusAuthorMap, obsAuthorNames, markSent, setConfirm, cycleConfirm, setObs, refresh };
}

