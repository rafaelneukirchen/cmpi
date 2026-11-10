import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const token = String(body.token || "").trim().toLowerCase();
    const nome = String(body.nome || "").trim();
    const telefone = String(body.telefone || "").replace(/\D/g, "");
    const regiao = String(body.regiao || "").trim();

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Link inválido." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!nome || nome.length < 2 || nome.length > 200) {
      return new Response(JSON.stringify({ success: false, error: "Informe o nome completo." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (telefone.length !== 11) {
      return new Response(JSON.stringify({ success: false, error: "Telefone precisa ter 11 dígitos (DDD + número)." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!regiao) {
      return new Response(JSON.stringify({ success: false, error: "Selecione uma região." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Encontra coordenador pelo token público no profile
    const { data: coord, error: coordErr } = await admin
      .from("profiles")
      .select("user_id, nome")
      .eq("token_publico", token)
      .maybeSingle();

    if (coordErr || !coord) {
      return new Response(JSON.stringify({ success: false, error: "Link inválido ou expirado." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = `equipe.${telefone}@equipe.interno`;
    // Strong random password (≥24 chars, mixed). Never derived from phone.
    const genPassword = () => {
      const buf = new Uint8Array(18);
      crypto.getRandomValues(buf);
      const b64 = btoa(String.fromCharCode(...buf)).replace(/[+/=]/g, "");
      return `Eq!${b64}`;
    };
    const password = genPassword();

    // Verifica se telefone já cadastrado
    const { data: existing } = await admin
      .from("equipe_membros")
      .select("id, user_id")
      .eq("telefone", telefone)
      .maybeSingle();

    if (existing) {
      // Backfill: garante token_publico, role e permissão para liberar acesso
      let targetUserId = (existing as { user_id?: string }).user_id;
      // Se o usuário de auth não existe mais (órfão), remove o registro e segue para recriar
      if (targetUserId) {
        const { data: authUser } = await admin.auth.admin.getUserById(targetUserId);
        if (!authUser?.user) {
          await admin.from("equipe_membros").delete().eq("id", (existing as { id: string }).id);
          targetUserId = undefined as unknown as string;
        }
      }
      if (targetUserId) {
        // Reset da senha para uma nova senha aleatória (necessário para auto-login).
        await admin.auth.admin.updateUserById(targetUserId, { password });


        const { data: prof } = await admin
          .from("profiles")
          .select("token_publico")
          .eq("user_id", targetUserId)
          .maybeSingle();
        if (!prof?.token_publico) {
          const tokenPub = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toLowerCase();
          await admin.from("profiles").update({ token_publico: tokenPub }).eq("user_id", targetUserId);
        }
        // Garante role
        await admin.from("user_roles").upsert(
          { user_id: targetUserId, role: "operador_cadastro" },
          { onConflict: "user_id,role" },
        );
        // Garante permissões mínimas: Mapa e Leads (Eleitores Captados é livre)
        await admin.from("user_permissions").upsert(
          [
            { user_id: targetUserId, module: "mapa" },
            { user_id: targetUserId, module: "leads" },
          ],
          { onConflict: "user_id,module" },
        );
        // Remove permissão de painel (não deve aparecer para equipe)
        await admin.from("user_permissions").delete()
          .eq("user_id", targetUserId).eq("module", "painel");
      }
      if (targetUserId) {
        // Já cadastrado: retorna credenciais como sucesso para login automático
        return new Response(JSON.stringify({
          success: true,
          already_registered: true,
          email,
          password,
          coordenador_nome: coord.nome,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Se chegou aqui, o registro estava órfão e foi removido — segue o fluxo de criação abaixo.
    }


    // Cria usuário no auth (já confirmado)
    const { data: userRes, error: userErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome, telefone, regiao },
    });

    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({
        success: false,
        error: userErr?.message || "Não foi possível criar o acesso.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = userRes.user.id;

    // Garante token_publico no profile para liberar o botão VOTO de captação
    const tokenPub = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toLowerCase();
    await admin
      .from("profiles")
      .update({ nome, token_publico: tokenPub })
      .eq("user_id", newUserId);

    // Insere registro de equipe
    const { error: insErr } = await admin.from("equipe_membros").insert({
      user_id: newUserId,
      coordenador_user_id: coord.user_id,
      nome,
      telefone,
      regiao,
    });

    if (insErr) {
      // Rollback: remove auth user
      await admin.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ success: false, error: insErr.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atribui role e permissões: Mapa + Leads (Eleitores Captados é livre, VOTO via token_publico)
    await admin.from("user_roles").upsert(
      { user_id: newUserId, role: "operador_cadastro" },
      { onConflict: "user_id,role" },
    );
    await admin.from("user_permissions").upsert(
      [
        { user_id: newUserId, module: "mapa" },
        { user_id: newUserId, module: "leads" },
      ],
      { onConflict: "user_id,module" },
    );

    return new Response(JSON.stringify({
      success: true,
      email,
      password,
      coordenador_nome: coord.nome,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[register-equipe-membro]", e);
    return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
