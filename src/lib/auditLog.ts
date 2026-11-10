import { supabase } from "@/integrations/supabase/client";

export async function logAudit(action: string, tableName: string, recordId?: string, details?: Record<string, any>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("user_id", user.id)
      .maybeSingle();

    await supabase.from("audit_log" as any).insert({
      action,
      table_name: tableName,
      record_id: recordId || null,
      user_id: user.id,
      details: details || null,
      executor_name: profile?.nome || user.email || null,
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}
