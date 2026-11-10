import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  MapPin, Users, Battery, Clock, RefreshCw, Loader2, AlertCircle,
  Link2, Copy, Search, UserCircle2, Shield, Pencil,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { EquipeMembroEditDialog } from "@/components/EquipeMembroEditDialog";

interface UserLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  battery_level: number | null;
  captured_at: string;
}

interface Profile {
  user_id: string;
  nome: string;
  email: string;
  cor: string | null;
  token_publico: string | null;
}

interface EquipeMembro {
  id: string;
  user_id: string;
  coordenador_user_id: string;
  nome: string;
  telefone: string;
  regiao: string | null;
}

export default function RastreamentoEquipe() {
  const { user, userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const queryClient = useQueryClient();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [editMembro, setEditMembro] = useState<EquipeMembro | null>(null);

  // Admin filters
  const [adminTab, setAdminTab] = useState<"coordenador" | "usuario">("coordenador");
  const [selectedCoord, setSelectedCoord] = useState<string | null>(null);
  const [searchTeam, setSearchTeam] = useState("");
  const [searchUser, setSearchUser] = useState("");

  const { data: locations = [], refetch, isFetching } = useQuery({
    queryKey: ["user-locations-latest"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_latest_user_locations");
      if (error) throw error;
      return (data || []) as UserLocation[];
    },
    refetchInterval: 60000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-tracking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome, email, cor, token_publico");
      if (error) throw error;
      return (data || []) as Profile[];
    },
  });

  const { data: equipeMembros = [] } = useQuery({
    queryKey: ["equipe-membros-tracking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipe_membros")
        .select("id, user_id, coordenador_user_id, nome, telefone, regiao");
      if (error) throw error;
      return (data || []) as EquipeMembro[];
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach((p) => map.set(p.user_id, p));
    return map;
  }, [profiles]);

  const membroMap = useMemo(() => {
    const map = new Map<string, EquipeMembro>();
    equipeMembros.forEach((m) => map.set(m.user_id, m));
    return map;
  }, [equipeMembros]);

  // Lista de coordenadores (apenas os que têm equipe cadastrada)
  const coordenadoresComEquipe = useMemo(() => {
    const ids = new Set(equipeMembros.map((m) => m.coordenador_user_id));
    return profiles.filter((p) => ids.has(p.user_id));
  }, [equipeMembros, profiles]);

  // Próprio perfil (para o coordenador atual)
  const myProfile = useMemo(() => profiles.find((p) => p.user_id === user?.id) || null, [profiles, user]);

  const myLink = useMemo(() => {
    if (!myProfile?.token_publico) return null;
    return `${window.location.origin}/equipe/cadastro/${myProfile.token_publico}`;
  }, [myProfile]);

  // Decide quais user_ids devem aparecer no mapa
  const visibleUserIds = useMemo(() => {
    if (!isAdmin) {
      // Coordenador: própria equipe + ele mesmo
      const myTeam = equipeMembros
        .filter((m) => m.coordenador_user_id === user?.id)
        .map((m) => m.user_id);
      return new Set<string>([...(user?.id ? [user.id] : []), ...myTeam]);
    }
    // Admin: filtro por aba
    if (adminTab === "coordenador") {
      if (!selectedCoord) {
        // Mostra todos os membros de equipe + coordenadores com equipe
        return new Set<string>([
          ...equipeMembros.map((m) => m.user_id),
          ...coordenadoresComEquipe.map((c) => c.user_id),
        ]);
      }
      const team = equipeMembros
        .filter((m) => m.coordenador_user_id === selectedCoord)
        .map((m) => m.user_id);
      return new Set<string>([selectedCoord, ...team]);
    }
    // Aba usuários: profiles que NÃO estão em equipe_membros
    const equipeIds = new Set(equipeMembros.map((m) => m.user_id));
    const userIds = profiles.filter((p) => !equipeIds.has(p.user_id)).map((p) => p.user_id);
    return new Set<string>(userIds);
  }, [isAdmin, adminTab, selectedCoord, equipeMembros, coordenadoresComEquipe, profiles, user]);

  const visibleLocations = useMemo(
    () => locations.filter((l) =>
      visibleUserIds.has(l.user_id) &&
      // Exclui usuários que foram removidos do sistema (sem profile e sem membro de equipe)
      (profileMap.has(l.user_id) || membroMap.has(l.user_id))
    ),
    [locations, visibleUserIds, profileMap, membroMap]
  );

  // Inicializa o mapa
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-23.55, -46.63],
      zoom: 9,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Atualiza marcadores
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seenIds = new Set<string>();
    const bounds: L.LatLngTuple[] = [];

    visibleLocations.forEach((loc) => {
      const profile = profileMap.get(loc.user_id);
      const membro = membroMap.get(loc.user_id);
      const name = membro?.nome || profile?.nome || "Usuário";
      const color = profile?.cor || (membro ? "#10b981" : "#3b82f6");
      seenIds.add(loc.user_id);

      const html = `<div style="background:${color};width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:11px">${name.substring(0, 2).toUpperCase()}</div>`;
      const icon = L.divIcon({
        html,
        className: "user-location-marker",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const sub = membro
        ? `Equipe • ${membro.regiao || ""}`
        : profile?.email || "";

      const popupHtml = `
        <div style="font-family:system-ui;min-width:160px">
          <strong>${name}</strong><br/>
          <small>${sub}</small><br/>
          <hr style="margin:6px 0"/>
          📍 ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}<br/>
          ${loc.accuracy ? `🎯 ±${Math.round(loc.accuracy)}m<br/>` : ""}
          ${loc.battery_level != null ? `🔋 ${loc.battery_level}%<br/>` : ""}
          🕒 ${formatDistanceToNow(new Date(loc.captured_at), { addSuffix: true, locale: ptBR })}
        </div>
      `;

      const existing = markersRef.current.get(loc.user_id);
      if (existing) {
        existing.setLatLng([loc.latitude, loc.longitude]);
        existing.setIcon(icon);
        existing.setPopupContent(popupHtml);
      } else {
        const marker = L.marker([loc.latitude, loc.longitude], { icon }).addTo(map);
        marker.bindPopup(popupHtml);
        markersRef.current.set(loc.user_id, marker);
      }

      bounds.push([loc.latitude, loc.longitude]);
    });

    markersRef.current.forEach((marker, id) => {
      if (!seenIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [visibleLocations, profileMap, membroMap]);

  function focusUser(loc: UserLocation) {
    setSelectedUser(loc.user_id);
    if (mapRef.current) {
      mapRef.current.flyTo([loc.latitude, loc.longitude], 15, { duration: 0.8 });
      const marker = markersRef.current.get(loc.user_id);
      marker?.openPopup();
    }
  }

  function copyLink() {
    if (!myLink) return;
    navigator.clipboard.writeText(myLink);
    toast.success("Link copiado!");
  }

  // Acesso negado se não é admin nem coordenador
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <AlertCircle className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">Acesso Restrito</h2>
      </div>
    );
  }

  function renderLocationCard(loc: UserLocation) {
    const profile = profileMap.get(loc.user_id);
    const membro = membroMap.get(loc.user_id);
    const isSelected = selectedUser === loc.user_id;
    const minutesAgo = (Date.now() - new Date(loc.captured_at).getTime()) / 60000;
    const isStale = minutesAgo > 30;
    const name = membro?.nome || profile?.nome || "Usuário";
    const color = profile?.cor || (membro ? "#10b981" : "#3b82f6");

    const canEditMembro = !!membro && (isAdmin || membro.coordenador_user_id === user?.id);
    return (
      <div
        key={loc.user_id}
        className={`w-full text-left p-3 rounded-lg border transition-all ${
          isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
        }`}
      >
        <button onClick={() => focusUser(loc)} className="w-full text-left">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="font-medium text-sm truncate">{name}</span>
            {membro && (
              <Badge variant="outline" className="ml-auto text-[10px]">equipe</Badge>
            )}
            {isStale && (
              <Badge variant="secondary" className="text-[10px]">offline</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground pl-5">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(loc.captured_at), { addSuffix: true, locale: ptBR })}
            </span>
            {loc.battery_level != null && (
              <span className="flex items-center gap-1">
                <Battery className="h-3 w-3" />
                {loc.battery_level}%
              </span>
            )}
          </div>
          {membro?.regiao && (
            <p className="text-xs text-muted-foreground pl-5 mt-1">📍 {membro.regiao}</p>
          )}
        </button>
        {canEditMembro && (
          <div className="pt-2 mt-2 border-t flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={(e) => { e.stopPropagation(); setEditMembro(membro!); }}
            >
              <Pencil className="h-3 w-3" /> Editar cadastro
            </Button>
          </div>
        )}
      </div>
    );
  }

  function renderMembroCardNoLocation(m: EquipeMembro) {
    const canEdit = isAdmin || m.coordenador_user_id === user?.id;
    return (
      <div key={m.id} className="w-full p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-3 w-3 rounded-full shrink-0 bg-muted-foreground/50" />
          <span className="font-medium text-sm truncate">{m.nome}</span>
          <Badge variant="outline" className="ml-auto text-[10px]">sem GPS</Badge>
        </div>
        <p className="text-xs text-muted-foreground pl-5">{m.telefone}{m.regiao ? ` • ${m.regiao}` : ""}</p>
        {canEdit && (
          <div className="pt-2 mt-2 border-t flex justify-end">
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setEditMembro(m)}>
              <Pencil className="h-3 w-3" /> Editar cadastro
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ====== ADMIN VIEW ======
  if (isAdmin) {
    // Filtra localizações para listagem por busca de nome
    const filteredTeam = visibleLocations.filter((l) => {
      const name = (membroMap.get(l.user_id)?.nome || profileMap.get(l.user_id)?.nome || "").toLowerCase();
      return adminTab === "coordenador" && (!searchTeam || name.includes(searchTeam.toLowerCase()));
    });
    const filteredUsers = visibleLocations.filter((l) => {
      const name = (profileMap.get(l.user_id)?.nome || "").toLowerCase();
      return adminTab === "usuario" && (!searchUser || name.includes(searchUser.toLowerCase()));
    });

    return (
      <>
      {editMembro && (
        <EquipeMembroEditDialog
          open={!!editMembro}
          onOpenChange={(v) => !v && setEditMembro(null)}
          membroId={editMembro.id}
          initialNome={editMembro.nome}
          initialTelefone={editMembro.telefone}
          initialRegiao={editMembro.regiao}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["equipe-membros-tracking"] })}
        />
      )}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              Rastreamento da Equipe
            </h1>
            <p className="text-muted-foreground">Localização em tempo real</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="lg:col-span-3">
            <CardContent className="p-0">
              <div ref={containerRef} className="h-[600px] w-full rounded-md" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Tabs value={adminTab} onValueChange={(v) => { setAdminTab(v as "coordenador" | "usuario"); setSelectedCoord(null); }}>
                <TabsList className="grid grid-cols-2 w-full rounded-none">
                  <TabsTrigger value="coordenador" className="text-xs gap-1">
                    <Shield className="h-3 w-3" /> Coordenador
                  </TabsTrigger>
                  <TabsTrigger value="usuario" className="text-xs gap-1">
                    <UserCircle2 className="h-3 w-3" /> Usuários
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="coordenador" className="p-3 space-y-3 mt-0">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Filtrar por coordenador</label>
                    <select
                      className="mt-1 w-full h-9 text-xs rounded-md border border-input bg-background px-2"
                      value={selectedCoord || ""}
                      onChange={(e) => setSelectedCoord(e.target.value || null)}
                    >
                      <option value="">Todos ({coordenadoresComEquipe.length})</option>
                      {coordenadoresComEquipe.map((c) => (
                        <option key={c.user_id} value={c.user_id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar nome..."
                      className="h-9 pl-7 text-xs"
                      value={searchTeam}
                      onChange={(e) => setSearchTeam(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2 pr-3">
                      {(() => {
                        const located = new Set(filteredTeam.map((l) => l.user_id));
                        const offlineMembros = equipeMembros.filter((m) => {
                          if (located.has(m.user_id)) return false;
                          if (selectedCoord && m.coordenador_user_id !== selectedCoord) return false;
                          if (searchTeam && !m.nome.toLowerCase().includes(searchTeam.toLowerCase())) return false;
                          return true;
                        });
                        if (filteredTeam.length === 0 && offlineMembros.length === 0) {
                          return <p className="text-xs text-muted-foreground text-center py-4">Nenhum membro cadastrado.</p>;
                        }
                        return <>{filteredTeam.map(renderLocationCard)}{offlineMembros.map(renderMembroCardNoLocation)}</>;
                      })()}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="usuario" className="p-3 space-y-3 mt-0">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar usuário..."
                      className="h-9 pl-7 text-xs"
                      value={searchUser}
                      onChange={(e) => setSearchUser(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-[440px]">
                    <div className="space-y-2 pr-3">
                      {filteredUsers.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Nenhum registro de localização.
                        </p>
                      )}
                      {filteredUsers.map(renderLocationCard)}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
      </>
    );
  }

  // ====== COORDENADOR VIEW ======
  const myTeam = equipeMembros.filter((m) => m.coordenador_user_id === user.id);

  const locatedTeamIds = new Set(visibleLocations.map((l) => l.user_id));
  const myTeamNoGps = myTeam.filter((m) => !locatedTeamIds.has(m.user_id));

  return (
    <>
    {editMembro && (
      <EquipeMembroEditDialog
        open={!!editMembro}
        onOpenChange={(v) => !v && setEditMembro(null)}
        membroId={editMembro.id}
        initialNome={editMembro.nome}
        initialTelefone={editMembro.telefone}
        initialRegiao={editMembro.regiao}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["equipe-membros-tracking"] })}
      />
    )}
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Rastreamento da Minha Equipe
          </h1>
          <p className="text-muted-foreground">Veja onde sua equipe está em tempo real</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      {/* Link para cadastrar equipe */}
      {myLink && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Link para cadastrar sua equipe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input value={myLink} readOnly className="font-mono text-xs h-9" />
              <Button onClick={copyLink} size="sm" variant="outline">
                <Copy className="h-4 w-4 mr-1" /> Copiar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Envie este link aos membros da sua equipe. Eles vão se cadastrar (nome, telefone, região) e aceitar o GPS para aparecer no seu mapa.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3">
          <CardContent className="p-0">
            <div ref={containerRef} className="h-[600px] w-full rounded-md" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Minha Equipe ({myTeam.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[540px]">
              <div className="space-y-2 p-4">
                {myTeam.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Nenhum membro cadastrado ainda. Compartilhe o link acima.
                  </p>
                )}
                {visibleLocations.map(renderLocationCard)}
                {myTeamNoGps.map(renderMembroCardNoLocation)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
