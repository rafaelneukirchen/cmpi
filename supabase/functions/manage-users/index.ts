import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Não autenticado");
    }
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) throw new Error("Não autenticado");
    const callerId = claimsData.claims.sub as string;

    // Only the super admin (Gel Cardoso) can manage users
    const SUPER_ADMIN_ID = "b42bdfd7-26d3-4f0b-814b-766a29c9deaa";
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores podem gerenciar usuários");
    
    const isSuperAdmin = callerId === SUPER_ADMIN_ID;

    const { action, ...params } = await req.json();

    if (action === "list") {
      const fetchAll = async (table: string) => {
        const all: any[] = [];
        const size = 1000;
        for (let from = 0; ; from += size) {
          const { data, error } = await supabase.from(table).select("*").range(from, from + size - 1);
          if (error) throw new Error(error.message);
          all.push(...(data || []));
          if (!data || data.length < size) break;
        }
        return all;
      };
      const profiles = await fetchAll("profiles");
      const roles = await fetchAll("user_roles");
      const coordCidades = await fetchAll("coordenador_cidades");
      const permissions = await fetchAll("user_permissions");
      
      const users = (profiles || []).map((p: any) => ({
        ...p,
        role: roles?.find((r: any) => r.user_id === p.user_id)?.role || null,
        cidades_ids: (coordCidades || []).filter((cc: any) => cc.user_id === p.user_id).map((cc: any) => cc.cidade_id),
        permissions: (permissions || []).filter((perm: any) => perm.user_id === p.user_id).map((perm: any) => perm.module),
      }));

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      // Qualquer admin do sistema pode criar usuários no seu próprio ambiente
      const { email, password, nome, role, cidades_ids, permissions } = params;

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: nome },
      });
      if (createError) {
        if (createError.message?.includes("already been registered")) {
          throw new Error("Este e-mail já está cadastrado no sistema");
        }
        throw new Error(createError.message || "Erro ao criar usuário");
      }

      if (role && newUser.user) {
        await supabase.from("user_roles").insert({ user_id: newUser.user.id, role });
      }

      // Assign cities
      if (cidades_ids?.length && newUser.user) {
        const rows = cidades_ids.map((cidade_id: string) => ({
          user_id: newUser.user!.id,
          cidade_id,
        }));
        await supabase.from("coordenador_cidades").insert(rows);
      }

      // Assign permissions
      if (permissions?.length && newUser.user) {
        const rows = permissions.map((module: string) => ({
          user_id: newUser.user!.id,
          module,
        }));
        await supabase.from("user_permissions").insert(rows);
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { user_id } = params;
      if (user_id === callerId) throw new Error("Não é possível excluir seu próprio usuário");

      // Super admin + delegados podem excluir usuários; apenas o super admin pode excluir ADMs
      const DELETE_ALLOWED_IDS = [
        SUPER_ADMIN_ID,
        "9c357e92-8a22-423c-a951-f28cd9996346", // Waiton Souza Oliveira
        "abd8f3d1-51be-4060-b04f-2c2dd6288bb1", // Felipe Carmona
      ];
      if (!DELETE_ALLOWED_IDS.includes(callerId)) {
        throw new Error("Você não tem permissão para excluir usuários");
      }

      const { data: targetIsAdmin } = await supabase.rpc("has_role", { _user_id: user_id, _role: "admin" });
      if (targetIsAdmin && !isSuperAdmin) {
        throw new Error("Apenas o super admin pode excluir usuários administradores");
      }

      await supabase.from("coordenador_cidades").delete().eq("user_id", user_id);
      await supabase.from("user_permissions").delete().eq("user_id", user_id);

      const { error } = await supabase.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (action === "update_role") {
      const { user_id, role } = params;

      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (existing) {
        await supabase.from("user_roles").update({ role }).eq("user_id", user_id);
      } else {
        await supabase.from("user_roles").insert({ user_id, role });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_nome") {
      const { user_id, nome } = params;
      if (!nome || nome.trim().length < 2) throw new Error("Nome deve ter pelo menos 2 caracteres");

      const { error } = await supabase.from("profiles").update({ nome: nome.trim() }).eq("user_id", user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_email") {
      const { user_id, email } = params;
      const newEmail = String(email || "").trim().toLowerCase();
      if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        throw new Error("E-mail inválido");
      }

      // Atualiza no Auth (já confirma o novo e-mail para evitar fluxo de verificação)
      const { error: authErr } = await supabase.auth.admin.updateUserById(user_id, {
        email: newEmail,
        email_confirm: true,
      });
      if (authErr) {
        if (authErr.message?.includes("already been registered") || (authErr as any).code === "email_exists") {
          throw new Error("Este e-mail já está cadastrado para outro usuário");
        }
        throw new Error(authErr.message || "Erro ao atualizar e-mail");
      }

      // Reflete também na tabela de perfis
      await supabase.from("profiles").update({ email: newEmail }).eq("user_id", user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_invite") {
      const { user_id } = params;

      // Busca o e-mail do usuário no Auth
      const { data: userInfo, error: getErr } = await supabase.auth.admin.getUserById(user_id);
      if (getErr || !userInfo?.user?.email) {
        throw new Error(getErr?.message || "Usuário não encontrado");
      }
      const targetEmail = userInfo.user.email;

      // Garante que o e-mail está confirmado para liberar acesso após definir a senha
      try {
        await supabase.auth.admin.updateUserById(user_id, { email_confirm: true });
      } catch (_) { /* ignore */ }

      // Gera link de redefinição de senha (funciona como ativação do cadastro)
      const origin = req.headers.get("origin") || req.headers.get("referer") || "";
      const redirectTo = origin
        ? `${origin.replace(/\/$/, "")}/reset-password`
        : undefined;

      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email: targetEmail,
        options: redirectTo ? { redirectTo } : undefined,
      });
      if (linkErr) {
        throw new Error(linkErr.message || "Erro ao gerar link de ativação");
      }

      return new Response(
        JSON.stringify({
          success: true,
          email: targetEmail,
          action_link: linkData?.properties?.action_link || null,
          message:
            "E-mail de ativação disparado. O usuário receberá um link para definir a senha e acessar o sistema.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reset_password") {
      if (!isSuperAdmin) throw new Error("Apenas o super admin pode redefinir senhas");
      const { user_id } = params;
      const newPassword = Deno.env.get("TEMPORARY_RESET_PASSWORD");
      if (!newPassword) throw new Error("Configure TEMPORARY_RESET_PASSWORD na nova instalação.");
      const { error } = await supabase.auth.admin.updateUserById(user_id, {
        password: newPassword,
      });
      if (error) throw new Error(error.message || "Erro ao redefinir senha");

      // Marca o usuário para trocar a senha no próximo login
      await supabase
        .from("profiles")
        .update({ must_change_password: true })
        .eq("user_id", user_id);

      return new Response(
        JSON.stringify({ success: true, password: newPassword, message: `Senha redefinida para ${newPassword}. O usuário será obrigado a criar uma nova senha no próximo login.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "impersonate") {
      if (!isSuperAdmin) throw new Error("Apenas o super admin pode acessar o suporte (entrar como usuário)");
      const { user_id } = params;
      if (user_id === callerId) throw new Error("Você já está logado como esse usuário");

      const { data: userInfo, error: getErr } = await supabase.auth.admin.getUserById(user_id);
      if (getErr || !userInfo?.user?.email) {
        throw new Error(getErr?.message || "Usuário não encontrado");
      }
      const targetEmail = userInfo.user.email;

      // Para evitar que a sessão do admin seja sobrescrita ao abrir o magic link,
      // redirecionamos para um DOMÍNIO DIFERENTE daquele em que o admin está logado.
      // Origens isoladas no navegador = localStorage isolado = duas sessões simultâneas.
      const SUPPORT_ORIGINS = [
        "https://inteligenciadecampanha.com.br",
        "https://campanhainteligente.lovable.app",
      ];
      const reqOrigin = (req.headers.get("origin") || "").replace(/\/$/, "").toLowerCase();
      const target = SUPPORT_ORIGINS.find(o => o.toLowerCase() !== reqOrigin) || SUPPORT_ORIGINS[0];
      const redirectTo = `${target}/`;

      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
        options: { redirectTo },
      });
      if (linkErr) throw new Error(linkErr.message || "Erro ao gerar link de suporte");

      return new Response(
        JSON.stringify({
          success: true,
          email: targetEmail,
          target_origin: target,
          action_link: linkData?.properties?.action_link || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_cor") {
      const { user_id, cor } = params;

      const { error } = await supabase.from("profiles").update({ cor: cor || null }).eq("user_id", user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_cidades") {
      const { user_id, cidades_ids } = params;

      await supabase.from("coordenador_cidades").delete().eq("user_id", user_id);

      if (cidades_ids?.length) {
        const rows = cidades_ids.map((cidade_id: string) => ({ user_id, cidade_id }));
        await supabase.from("coordenador_cidades").insert(rows);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_permissions") {
      const { user_id, permissions } = params;

      const { error: delErr } = await supabase.from("user_permissions").delete().eq("user_id", user_id);
      if (delErr) throw new Error(delErr.message);

      if (permissions?.length) {
        const rows = permissions.map((module: string) => ({ user_id, module }));
        const { error: insErr } = await supabase.from("user_permissions").insert(rows);
        if (insErr) throw new Error(insErr.message);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida");
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
