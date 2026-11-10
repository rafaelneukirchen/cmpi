import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roleLoading: boolean;
  userRole: string | null;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  roleLoading: true,
  userRole: null,
  isSuperAdmin: false,
  signOut: async () => {},
});

const SUPER_ADMIN_ID = "b42bdfd7-26d3-4f0b-814b-766a29c9deaa";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    let initialSessionResolved = false;

    const clearAuthState = () => {
      setSession(null);
      setUser(null);
      setUserRole(null);
      setRoleLoading(false);
    };

    // IMPORTANT: subscribe first to avoid missing events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // If token refresh fails, clear stale session to avoid loops
      if (event === "TOKEN_REFRESHED" && !session) {
        clearAuthState();
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // fire-and-forget to avoid blocking auth event processing
        setTimeout(() => fetchRole(session.user.id), 0);
      } else {
        setUserRole(null);
        setRoleLoading(false);
      }

      // Avoid redirect loops on mobile: keep loading=true until getSession finishes
      if (initialSessionResolved || event !== "INITIAL_SESSION") {
        setLoading(false);
      }
    });

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        initialSessionResolved = true;
        if (!session) {
          clearAuthState();
          return;
        }

        // getSession() only reads local storage. Revalidate with the auth server
        // so old sessions revoked by password reset do not pass route protection.
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          try { await supabase.auth.signOut({ scope: "local" }); } catch {}
          clearAuthState();
          return;
        }

        setSession(session);
        setUser(userData.user);
        fetchRole(userData.user.id);
      })
      .catch(() => {
        // If getSession fails (e.g. stale refresh token), clear everything
        clearAuthState();
      })
      .finally(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, []);

  async function fetchRole(userId: string) {
    setRoleLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_user_role", { _user_id: userId });
      if (error) throw error;
      setUserRole(data ?? null);
    } catch {
      // If role lookup fails, don't break the app; treat as no role
      setUserRole(null);
    } finally {
      setRoleLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const isSuperAdmin = user?.id === SUPER_ADMIN_ID;

  return (
    <AuthContext.Provider value={{ user, session, loading, roleLoading, userRole, isSuperAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
