import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const token = String(body.token || "").trim().toLowerCase();
    const nome = String(body.nome || "").trim();
    const telefone = String(body.telefone || "").replace(/\D/g, "");
    const whatsapp = String(body.whatsapp || "").replace(/\D/g, "");
    const bairro = String(body.bairro || "").trim();

    if (!token) return json({ success: false, error: "Link inválido." });
    if (!nome || nome.length < 2 || nome.length > 200) return json({ success: false, error: "Informe o nome completo." });
    if (telefone.length !== 11) return json({ success: false, error: "Telefone precisa ter 11 dígitos (DDD + número)." });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Localiza a liderança pelo token
    const { data: lider, error: lErr } = await admin
      .from("liderancas")
      .select("id, nome, cidade_base_id, coordenador_user_id, permite_cadastro_cabos")
      .eq("token_publico", token)
      .maybeSingle();

    if (lErr || !lider) return json({ success: false, error: "Link inválido ou expirado." });
    if (!lider.permite_cadastro_cabos) return json({ success: false, error: "Esta liderança não liberou cadastro de cabos." });

    // Cria usuário auth (para o cabo poder captar apoiadores também)
    const email = `cabo.${telefone}@equipe.interno`;
    const genPassword = () => {
      const buf = new Uint8Array(18);
      crypto.getRandomValues(buf);
      const b64 = btoa(String.fromCharCode(...buf)).replace(/[+/=]/g, "");
      return `Cb!${b64}`;
    };
    const password = genPassword();

    // Se já existe cabo com esse telefone vinculado a este líder → apenas retorna credenciais atualizadas
    const { data: existingCabo } = await admin
      .from("cabos_eleitorais")
      .select("id, lider_id")
      .eq("telefone", telefone)
      .maybeSingle();

    let userId: string | null = null;

    if (existingCabo) {
      // procura user pelo email
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list?.users?.find((u) => u.email === email);
      if (found) {
        userId = found.id;
        await admin.auth.admin.updateUserById(userId, { password });
      }
    }

    if (!userId) {
      const { data: userRes, error: userErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: nome, telefone, role: "cabo_captador" },
      });
      if (userErr || !userRes?.user) {
        // pode já existir por email → tenta recuperar
        const { data: list } = await admin.auth.admin.listUsers();
        const found = list?.users?.find((u) => u.email === email);
        if (!found) return json({ success: false, error: userErr?.message || "Não foi possível criar o acesso." });
        userId = found.id;
        await admin.auth.admin.updateUserById(userId, { password });
      } else {
        userId = userRes.user.id;
      }
    }

    // Garante profile + token_publico
    const tokenPub = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toLowerCase();
    await admin
      .from("profiles")
      .update({ nome, token_publico: tokenPub })
      .eq("user_id", userId);

    // Cria/atualiza registro de cabo vinculado ao líder
    if (existingCabo) {
      await admin.from("cabos_eleitorais").update({
        nome,
        whatsapp: whatsapp || null,
        bairro: bairro || null,
        lider_id: lider.id,
      }).eq("id", existingCabo.id);
    } else {
      const { error: insErr } = await admin.from("cabos_eleitorais").insert({
        nome,
        telefone,
        whatsapp: whatsapp || null,
        bairro: bairro || null,
        lider_id: lider.id,
        cidade_base_id: lider.cidade_base_id,
        coordenador_user_id: lider.coordenador_user_id,
        status: "ativa",
        forca_politica: "media",
      });
      if (insErr) {
        return json({ success: false, error: insErr.message });
      }
    }

    // Vincula como membro de equipe do coordenador da liderança (para captações rolarem para o coord)
    if (lider.coordenador_user_id) {
      await admin.from("equipe_membros").upsert(
        {
          user_id: userId,
          coordenador_user_id: lider.coordenador_user_id,
          nome,
          telefone,
          regiao: "Cabo Eleitoral",
        },
        { onConflict: "user_id" },
      );
    }

    // Role + permissões mínimas
    await admin.from("user_roles").upsert(
      { user_id: userId, role: "operador_cadastro" },
      { onConflict: "user_id,role" },
    );
    await admin.from("user_permissions").upsert(
      [
        { user_id: userId, module: "mapa" },
        { user_id: userId, module: "leads" },
      ],
      { onConflict: "user_id,module" },
    );
    await admin.from("user_permissions").delete().eq("user_id", userId).eq("module", "painel");

    return json({
      success: true,
      email,
      password,
      lideranca_nome: lider.nome,
    });
  } catch (e: any) {
    console.error("[register-cabo-captador]", e);
    return json({ success: false, error: String(e?.message || e) });
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
