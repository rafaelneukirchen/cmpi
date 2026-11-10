// Evolution API proxy - manages instances and sends messages.
// verify_jwt = false; JWT validated manually via getClaims.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface EvolutionCfg {
  baseUrl: string;
  apiKey: string;
  webhookUrl: string;
  maxInstances: number;
}

async function loadCfg(admin: any): Promise<EvolutionCfg> {
  const { data: settings } = await admin
    .from("app_settings")
    .select("key,value")
    .in("key", [
      "evolution_api_url",
      "evolution_webhook_url",
      "evolution_max_instances_per_user",
    ]);
  const s: Record<string, string> = {};
  (settings || []).forEach((r: any) => (s[r.key] = r.value || ""));
  const { data: secret } = await admin
    .from("integration_secrets")
    .select("key_value")
    .eq("service", "evolution")
    .eq("key_name", "EVOLUTION_API_KEY")
    .maybeSingle();
  return {
    baseUrl: (s.evolution_api_url || "").replace(/\/+$/, ""),
    apiKey: secret?.key_value || "",
    webhookUrl: s.evolution_webhook_url || `${SUPABASE_URL}/functions/v1/whatsapp-webhook`,
    maxInstances: Number(s.evolution_max_instances_per_user) || 3,
  };
}

async function evo(cfg: EvolutionCfg, path: string, method = "GET", body?: any) {
  if (!cfg.baseUrl || !cfg.apiKey) {
    throw new Error("Evolution API não configurada. Defina URL e API Key em Configurações → WhatsApp.");
  }
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: cfg.apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.response?.message || data?.message || text || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ success: false, error: "Não autenticado" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return json({ success: false, error: "Token inválido" }, 401);
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const cfg = await loadCfg(admin);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // Helper to load instance owned by user
    async function loadInstance(id: string) {
      const { data, error } = await admin
        .from("whatsapp_instances")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) throw new Error("Instância não encontrada");
      // Admin bypass
      const { data: adminCheck } = await admin.rpc("is_admin");
      if (data.user_id !== userId && !adminCheck) {
        throw new Error("Sem permissão para esta instância");
      }
      return data;
    }

    switch (action) {
      case "create": {
        const { count } = await admin
          .from("whatsapp_instances")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);
        if ((count || 0) >= cfg.maxInstances) {
          return json({ success: false, error: `Limite de ${cfg.maxInstances} conexões atingido.` });
        }
        const instanceName = `u_${userId.slice(0, 8)}_${Date.now().toString(36)}`;
        const evoRes = await evo(cfg, "/instance/create", "POST", {
          instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook: {
            url: cfg.webhookUrl,
            byEvents: false,
            base64: true,
            events: [
              "QRCODE_UPDATED",
              "CONNECTION_UPDATE",
              "MESSAGES_UPSERT",
              "MESSAGES_UPDATE",
              "PRESENCE_UPDATE",
            ],
          },
        });
        const qr = evoRes?.qrcode?.base64 || evoRes?.qrcode?.code || null;
        const { data: inserted, error: insErr } = await admin
          .from("whatsapp_instances")
          .insert({
            user_id: userId,
            instance_name: instanceName,
            status: "connecting",
            qr_code: qr,
            connected: false,
          })
          .select()
          .single();
        if (insErr) throw insErr;
        return json({ success: true, instance: inserted });
      }

      case "qr":
      case "connect": {
        const inst = await loadInstance(body.id);
        const evoRes = await evo(cfg, `/instance/connect/${inst.instance_name}`, "GET");
        const qr = evoRes?.base64 || evoRes?.qrcode?.base64 || evoRes?.code || null;
        await admin
          .from("whatsapp_instances")
          .update({ qr_code: qr, status: "connecting" })
          .eq("id", inst.id);
        return json({ success: true, qr });
      }

      case "status": {
        const inst = await loadInstance(body.id);
        const evoRes = await evo(cfg, `/instance/connectionState/${inst.instance_name}`, "GET");
        const state = evoRes?.instance?.state || evoRes?.state || "unknown";
        const connected = state === "open";
        await admin
          .from("whatsapp_instances")
          .update({
            status: state,
            connected,
            last_connection: connected ? new Date().toISOString() : inst.last_connection,
          })
          .eq("id", inst.id);
        return json({ success: true, state, connected });
      }

      case "logout": {
        const inst = await loadInstance(body.id);
        try { await evo(cfg, `/instance/logout/${inst.instance_name}`, "DELETE"); } catch {}
        await admin
          .from("whatsapp_instances")
          .update({ connected: false, status: "disconnected", qr_code: null })
          .eq("id", inst.id);
        return json({ success: true });
      }

      case "delete": {
        const inst = await loadInstance(body.id);
        try { await evo(cfg, `/instance/logout/${inst.instance_name}`, "DELETE"); } catch {}
        try { await evo(cfg, `/instance/delete/${inst.instance_name}`, "DELETE"); } catch {}
        await admin.from("whatsapp_instances").delete().eq("id", inst.id);
        return json({ success: true });
      }

      case "send-text": {
        const inst = await loadInstance(body.id);
        if (!inst.connected) return json({ success: false, error: "Instância desconectada" });
        const to = String(body.to || "").replace(/\D/g, "");
        const text = String(body.text || "");
        if (!to || !text) return json({ success: false, error: "Destinatário e texto obrigatórios" });
        const { data: msg } = await admin
          .from("whatsapp_messages")
          .insert({
            instance_id: inst.id, user_id: userId,
            direction: "outbound", to_number: to,
            message_type: "text", content: text, status: "sending",
          })
          .select().single();
        try {
          const r = await evo(cfg, `/message/sendText/${inst.instance_name}`, "POST", {
            number: to, text, delay: Number(body.delay || 0) || undefined,
          });
          await admin.from("whatsapp_messages").update({
            status: "sent",
            external_id: r?.key?.id || r?.messageId || null,
            raw: r,
          }).eq("id", msg!.id);
          return json({ success: true, id: msg!.id });
        } catch (e: any) {
          await admin.from("whatsapp_messages").update({
            status: "failed", error: String(e.message || e),
          }).eq("id", msg!.id);
          throw e;
        }
      }

      case "send-media": {
        const inst = await loadInstance(body.id);
        if (!inst.connected) return json({ success: false, error: "Instância desconectada" });
        const to = String(body.to || "").replace(/\D/g, "");
        const mediaUrl = String(body.mediaUrl || "");
        const mediaType = String(body.mediaType || "image"); // image | video | document | audio
        const caption = body.caption ? String(body.caption) : undefined;
        const fileName = body.fileName ? String(body.fileName) : undefined;
        if (!to || !mediaUrl) return json({ success: false, error: "Destinatário e mídia obrigatórios" });

        const { data: msg } = await admin.from("whatsapp_messages").insert({
          instance_id: inst.id, user_id: userId,
          direction: "outbound", to_number: to,
          message_type: mediaType, media_url: mediaUrl, caption, status: "sending",
        }).select().single();
        try {
          const path = mediaType === "audio"
            ? `/message/sendWhatsAppAudio/${inst.instance_name}`
            : `/message/sendMedia/${inst.instance_name}`;
          const payload: any = mediaType === "audio"
            ? { number: to, audio: mediaUrl }
            : { number: to, mediatype: mediaType, media: mediaUrl, caption, fileName };
          const r = await evo(cfg, path, "POST", payload);
          await admin.from("whatsapp_messages").update({
            status: "sent",
            external_id: r?.key?.id || r?.messageId || null,
            raw: r,
          }).eq("id", msg!.id);
          return json({ success: true, id: msg!.id });
        } catch (e: any) {
          await admin.from("whatsapp_messages").update({
            status: "failed", error: String(e.message || e),
          }).eq("id", msg!.id);
          throw e;
        }
      }

      case "send-location": {
        const inst = await loadInstance(body.id);
        if (!inst.connected) return json({ success: false, error: "Instância desconectada" });
        const to = String(body.to || "").replace(/\D/g, "");
        const r = await evo(cfg, `/message/sendLocation/${inst.instance_name}`, "POST", {
          number: to,
          latitude: Number(body.latitude),
          longitude: Number(body.longitude),
          name: body.name || "",
          address: body.address || "",
        });
        await admin.from("whatsapp_messages").insert({
          instance_id: inst.id, user_id: userId, direction: "outbound",
          to_number: to, message_type: "location", status: "sent",
          content: `${body.latitude},${body.longitude}`, raw: r,
        });
        return json({ success: true });
      }

      case "send-contact": {
        const inst = await loadInstance(body.id);
        if (!inst.connected) return json({ success: false, error: "Instância desconectada" });
        const to = String(body.to || "").replace(/\D/g, "");
        const contact = body.contact || {};
        const r = await evo(cfg, `/message/sendContact/${inst.instance_name}`, "POST", {
          number: to,
          contact: [{
            fullName: contact.name,
            wuid: (contact.phone || "").replace(/\D/g, ""),
            phoneNumber: contact.phone,
          }],
        });
        await admin.from("whatsapp_messages").insert({
          instance_id: inst.id, user_id: userId, direction: "outbound",
          to_number: to, message_type: "contact", status: "sent",
          content: contact.name, raw: r,
        });
        return json({ success: true });
      }

      case "test-connection": {
        // simple ping - list instances
        await evo(cfg, "/instance/fetchInstances", "GET");
        return json({ success: true });
      }

      default:
        return json({ success: false, error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e: any) {
    console.error("whatsapp-evolution error:", e);
    return json({ success: false, error: String(e.message || e) }, 200);
  }
});
