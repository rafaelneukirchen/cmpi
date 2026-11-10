// Evolution API webhook - receives events and updates instances/messages.
// Public endpoint (no JWT required).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  try {
    const payload = await req.json();
    const event = String(payload.event || payload.type || "").toLowerCase();
    const instanceName = payload.instance || payload.instanceName || payload.data?.instance || null;

    // Persist raw
    await admin.from("whatsapp_webhook_events").insert({
      instance_name: instanceName, event, payload,
    });

    if (!instanceName) return new Response("ok", { headers: corsHeaders });

    const { data: inst } = await admin
      .from("whatsapp_instances")
      .select("*")
      .eq("instance_name", instanceName)
      .maybeSingle();
    if (!inst) return new Response("ok", { headers: corsHeaders });

    const d = payload.data || {};

    if (event.includes("qrcode")) {
      const qr = d.qrcode?.base64 || d.base64 || d.qrcode || null;
      await admin.from("whatsapp_instances").update({
        qr_code: qr, status: "connecting",
      }).eq("id", inst.id);
    }

    if (event.includes("connection.update") || event.includes("connection_update")) {
      const state = d.state || d.status || "unknown";
      const connected = state === "open";
      const phone = d.wuid?.split("@")[0] || d.phone || inst.phone;
      const profileName = d.profileName || d.pushName || inst.profile_name;
      const profilePic = d.profilePictureUrl || inst.profile_picture;
      await admin.from("whatsapp_instances").update({
        status: state,
        connected,
        phone,
        profile_name: profileName,
        profile_picture: profilePic,
        last_connection: connected ? new Date().toISOString() : inst.last_connection,
        qr_code: connected ? null : inst.qr_code,
      }).eq("id", inst.id);
    }

    if (event.includes("messages.upsert") || event.includes("messages_upsert")) {
      const msgs = Array.isArray(d.messages) ? d.messages : (d.key ? [d] : []);
      for (const m of msgs) {
        const fromMe = !!m.key?.fromMe;
        if (fromMe) continue; // outbound already logged
        const from = m.key?.remoteJid?.split("@")[0] || null;
        const text =
          m.message?.conversation ||
          m.message?.extendedTextMessage?.text ||
          m.message?.imageMessage?.caption ||
          m.message?.videoMessage?.caption ||
          "";
        await admin.from("whatsapp_messages").insert({
          instance_id: inst.id,
          user_id: inst.user_id,
          direction: "inbound",
          from_number: from,
          message_type: m.messageType || "text",
          content: text,
          external_id: m.key?.id || null,
          status: "received",
          raw: m,
        });
      }
    }

    if (event.includes("messages.update") || event.includes("messages_update")) {
      const upd = Array.isArray(d) ? d : [d];
      for (const u of upd) {
        const extId = u.key?.id;
        const status = u.update?.status || u.status;
        if (extId && status) {
          await admin.from("whatsapp_messages").update({
            status: String(status).toLowerCase(),
          }).eq("external_id", extId);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("whatsapp-webhook error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
