export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      acoes_execucao: {
        Row: {
          acao_planejada_id: string | null
          bairro_execucao: string | null
          cidade_execucao: string | null
          cidade_id: string | null
          created_at: string
          distancia_metros: number | null
          encerrado_em: string | null
          id: string
          iniciado_em: string
          iniciado_por_user_id: string | null
          lat_fim: number | null
          lat_inicio: number | null
          lng_fim: number | null
          lng_inicio: number | null
          observacoes: string | null
          participantes_reais: number | null
          planejamento_id: string | null
          tipo_acao: Database["public"]["Enums"]["tipo_acao_campo"]
          updated_at: string
        }
        Insert: {
          acao_planejada_id?: string | null
          bairro_execucao?: string | null
          cidade_execucao?: string | null
          cidade_id?: string | null
          created_at?: string
          distancia_metros?: number | null
          encerrado_em?: string | null
          id?: string
          iniciado_em?: string
          iniciado_por_user_id?: string | null
          lat_fim?: number | null
          lat_inicio?: number | null
          lng_fim?: number | null
          lng_inicio?: number | null
          observacoes?: string | null
          participantes_reais?: number | null
          planejamento_id?: string | null
          tipo_acao: Database["public"]["Enums"]["tipo_acao_campo"]
          updated_at?: string
        }
        Update: {
          acao_planejada_id?: string | null
          bairro_execucao?: string | null
          cidade_execucao?: string | null
          cidade_id?: string | null
          created_at?: string
          distancia_metros?: number | null
          encerrado_em?: string | null
          id?: string
          iniciado_em?: string
          iniciado_por_user_id?: string | null
          lat_fim?: number | null
          lat_inicio?: number | null
          lng_fim?: number | null
          lng_inicio?: number | null
          observacoes?: string | null
          participantes_reais?: number | null
          planejamento_id?: string | null
          tipo_acao?: Database["public"]["Enums"]["tipo_acao_campo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acoes_execucao_acao_planejada_id_fkey"
            columns: ["acao_planejada_id"]
            isOneToOne: false
            referencedRelation: "acoes_planejadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acoes_execucao_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acoes_execucao_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "planejamento_semanal"
            referencedColumns: ["id"]
          },
        ]
      }
      acoes_midias: {
        Row: {
          created_at: string
          criado_por: string | null
          execucao_id: string
          id: string
          tipo: string
          url: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          execucao_id: string
          id?: string
          tipo?: string
          url: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          execucao_id?: string
          id?: string
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "acoes_midias_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "acoes_execucao"
            referencedColumns: ["id"]
          },
        ]
      }
      acoes_planejadas: {
        Row: {
          created_at: string
          data_prevista: string | null
          hora_prevista: string | null
          id: string
          local_previsto: string | null
          participantes_previstos: number | null
          planejamento_id: string
          tipo_acao: Database["public"]["Enums"]["tipo_acao_campo"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_prevista?: string | null
          hora_prevista?: string | null
          id?: string
          local_previsto?: string | null
          participantes_previstos?: number | null
          planejamento_id: string
          tipo_acao: Database["public"]["Enums"]["tipo_acao_campo"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_prevista?: string | null
          hora_prevista?: string | null
          id?: string
          local_previsto?: string | null
          participantes_previstos?: number | null
          planejamento_id?: string
          tipo_acao?: Database["public"]["Enums"]["tipo_acao_campo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acoes_planejadas_planejamento_id_fkey"
            columns: ["planejamento_id"]
            isOneToOne: false
            referencedRelation: "planejamento_semanal"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_campanha: {
        Row: {
          aprovado_em: string | null
          aprovado_por_user_id: string | null
          bairro: string | null
          cidade_id: string
          created_at: string
          criado_por_user_id: string | null
          data: string
          endereco: string | null
          evento: string
          finalidade: string | null
          id: string
          local_referencia: string | null
          motivo_rejeicao: string | null
          observacoes: string | null
          responsavel: string | null
          status: string
          tipo_evento: Database["public"]["Enums"]["tipo_evento"]
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por_user_id?: string | null
          bairro?: string | null
          cidade_id: string
          created_at?: string
          criado_por_user_id?: string | null
          data: string
          endereco?: string | null
          evento: string
          finalidade?: string | null
          id?: string
          local_referencia?: string | null
          motivo_rejeicao?: string | null
          observacoes?: string | null
          responsavel?: string | null
          status?: string
          tipo_evento?: Database["public"]["Enums"]["tipo_evento"]
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por_user_id?: string | null
          bairro?: string | null
          cidade_id?: string
          created_at?: string
          criado_por_user_id?: string | null
          data?: string
          endereco?: string | null
          evento?: string
          finalidade?: string | null
          id?: string
          local_referencia?: string | null
          motivo_rejeicao?: string | null
          observacoes?: string | null
          responsavel?: string | null
          status?: string
          tipo_evento?: Database["public"]["Enums"]["tipo_evento"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_campanha_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          executor_name: string | null
          id: string
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          executor_name?: string | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          executor_name?: string | null
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cabos_eleitorais: {
        Row: {
          bairro: string | null
          bairros: string[]
          cidade_base_id: string | null
          cidades_representadas: string[]
          coordenador_user_id: string | null
          created_at: string
          forca_politica: string
          historico_politico: string | null
          id: string
          lider_id: string
          nome: string
          observacoes: string | null
          promoted_from_id: string | null
          promoted_from_origem: string | null
          status: string
          telefone: string | null
          updated_at: string
          votos_estimados: number
          votos_por_cidade: Json
          whatsapp: string | null
          zonas_por_cidade: Json
        }
        Insert: {
          bairro?: string | null
          bairros?: string[]
          cidade_base_id?: string | null
          cidades_representadas?: string[]
          coordenador_user_id?: string | null
          created_at?: string
          forca_politica?: string
          historico_politico?: string | null
          id?: string
          lider_id: string
          nome: string
          observacoes?: string | null
          promoted_from_id?: string | null
          promoted_from_origem?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          votos_estimados?: number
          votos_por_cidade?: Json
          whatsapp?: string | null
          zonas_por_cidade?: Json
        }
        Update: {
          bairro?: string | null
          bairros?: string[]
          cidade_base_id?: string | null
          cidades_representadas?: string[]
          coordenador_user_id?: string | null
          created_at?: string
          forca_politica?: string
          historico_politico?: string | null
          id?: string
          lider_id?: string
          nome?: string
          observacoes?: string | null
          promoted_from_id?: string | null
          promoted_from_origem?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          votos_estimados?: number
          votos_por_cidade?: Json
          whatsapp?: string | null
          zonas_por_cidade?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cabos_eleitorais_cidade_base_id_fkey"
            columns: ["cidade_base_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cabos_eleitorais_lider_id_fkey"
            columns: ["lider_id"]
            isOneToOne: false
            referencedRelation: "liderancas"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          ano: number
          created_at: string
          id: string
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      campanhas_arquivo: {
        Row: {
          campanha_id: string
          created_at: string
          dados: Json
          id: string
          tabela: string
        }
        Insert: {
          campanha_id: string
          created_at?: string
          dados: Json
          id?: string
          tabela: string
        }
        Update: {
          campanha_id?: string
          created_at?: string
          dados?: Json
          id?: string
          tabela?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_arquivo_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      cidades: {
        Row: {
          area_territorial: number | null
          coordenador_cor: string | null
          coordenador_funcao: string | null
          coordenador_nome: string | null
          coordenador_telefone: string | null
          coordenador_whatsapp: string | null
          created_at: string
          densidade_populacional: number | null
          eleitores: number | null
          endereco_entrega: string | null
          entrega_contato_nome: string | null
          entrega_contato_telefone: string | null
          estado_id: string
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          observacoes: string | null
          pib_municipal: number | null
          populacao: number | null
          regiao_administrativa: string | null
          updated_at: string
        }
        Insert: {
          area_territorial?: number | null
          coordenador_cor?: string | null
          coordenador_funcao?: string | null
          coordenador_nome?: string | null
          coordenador_telefone?: string | null
          coordenador_whatsapp?: string | null
          created_at?: string
          densidade_populacional?: number | null
          eleitores?: number | null
          endereco_entrega?: string | null
          entrega_contato_nome?: string | null
          entrega_contato_telefone?: string | null
          estado_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          observacoes?: string | null
          pib_municipal?: number | null
          populacao?: number | null
          regiao_administrativa?: string | null
          updated_at?: string
        }
        Update: {
          area_territorial?: number | null
          coordenador_cor?: string | null
          coordenador_funcao?: string | null
          coordenador_nome?: string | null
          coordenador_telefone?: string | null
          coordenador_whatsapp?: string | null
          created_at?: string
          densidade_populacional?: number | null
          eleitores?: number | null
          endereco_entrega?: string | null
          entrega_contato_nome?: string | null
          entrega_contato_telefone?: string | null
          estado_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          observacoes?: string | null
          pib_municipal?: number | null
          populacao?: number | null
          regiao_administrativa?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cidades_estado_id_fkey"
            columns: ["estado_id"]
            isOneToOne: false
            referencedRelation: "estados"
            referencedColumns: ["id"]
          },
        ]
      }
      contatos_coordenacao: {
        Row: {
          assunto: string
          coordenador_user_id: string
          created_at: string
          data_contato: string
          id: string
          proximos_passos: string | null
          registrado_por_user_id: string
          relatorio: string | null
          tipo_contato: string
          updated_at: string
        }
        Insert: {
          assunto: string
          coordenador_user_id: string
          created_at?: string
          data_contato?: string
          id?: string
          proximos_passos?: string | null
          registrado_por_user_id: string
          relatorio?: string | null
          tipo_contato?: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          coordenador_user_id?: string
          created_at?: string
          data_contato?: string
          id?: string
          proximos_passos?: string | null
          registrado_por_user_id?: string
          relatorio?: string | null
          tipo_contato?: string
          updated_at?: string
        }
        Relationships: []
      }
      coordenador_cidades: {
        Row: {
          cidade_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          cidade_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          cidade_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordenador_cidades_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
        ]
      }
      dobradinhas: {
        Row: {
          cabo_id: string | null
          candidato_parceiro: string
          cargo_parceiro: string | null
          cidade_id: string | null
          coordenador_user_id: string | null
          created_at: string
          id: string
          lideranca_id: string | null
          observacoes: string | null
          updated_at: string
          votos_estimados: number | null
        }
        Insert: {
          cabo_id?: string | null
          candidato_parceiro: string
          cargo_parceiro?: string | null
          cidade_id?: string | null
          coordenador_user_id?: string | null
          created_at?: string
          id?: string
          lideranca_id?: string | null
          observacoes?: string | null
          updated_at?: string
          votos_estimados?: number | null
        }
        Update: {
          cabo_id?: string | null
          candidato_parceiro?: string
          cargo_parceiro?: string | null
          cidade_id?: string | null
          coordenador_user_id?: string | null
          created_at?: string
          id?: string
          lideranca_id?: string | null
          observacoes?: string | null
          updated_at?: string
          votos_estimados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dobradinhas_cabo_id_fkey"
            columns: ["cabo_id"]
            isOneToOne: false
            referencedRelation: "cabos_eleitorais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dobradinhas_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dobradinhas_lideranca_id_fkey"
            columns: ["lideranca_id"]
            isOneToOne: false
            referencedRelation: "liderancas"
            referencedColumns: ["id"]
          },
        ]
      }
      eleitores_captados: {
        Row: {
          accuracy: number | null
          bairro: string | null
          captado_por_user_id: string | null
          cidade_id: string | null
          cidade_nome: string | null
          created_at: string
          id: string
          latitude: number | null
          lideranca_id: string | null
          longitude: number | null
          nome_completo: string
          observacoes: string | null
          origem: string
          telefone: string | null
          tipo_captador: string
          updated_at: string
          zona_eleitoral: string | null
        }
        Insert: {
          accuracy?: number | null
          bairro?: string | null
          captado_por_user_id?: string | null
          cidade_id?: string | null
          cidade_nome?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          lideranca_id?: string | null
          longitude?: number | null
          nome_completo: string
          observacoes?: string | null
          origem?: string
          telefone?: string | null
          tipo_captador?: string
          updated_at?: string
          zona_eleitoral?: string | null
        }
        Update: {
          accuracy?: number | null
          bairro?: string | null
          captado_por_user_id?: string | null
          cidade_id?: string | null
          cidade_nome?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          lideranca_id?: string | null
          longitude?: number | null
          nome_completo?: string
          observacoes?: string | null
          origem?: string
          telefone?: string | null
          tipo_captador?: string
          updated_at?: string
          zona_eleitoral?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eleitores_captados_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eleitores_captados_lideranca_id_fkey"
            columns: ["lideranca_id"]
            isOneToOne: false
            referencedRelation: "liderancas"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe_membros: {
        Row: {
          coordenador_user_id: string
          created_at: string
          id: string
          nome: string
          regiao: string | null
          telefone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coordenador_user_id: string
          created_at?: string
          id?: string
          nome: string
          regiao?: string | null
          telefone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coordenador_user_id?: string
          created_at?: string
          id?: string
          nome?: string
          regiao?: string | null
          telefone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      estados: {
        Row: {
          created_at: string
          id: string
          nome: string
          sigla: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          sigla: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          sigla?: string
        }
        Relationships: []
      }
      estrutura_campanha: {
        Row: {
          apoiadores: number | null
          cabos_eleitorais: number | null
          cidade_id: string
          created_at: string
          id: string
          materiais_distribuidos: number | null
          updated_at: string
          veiculos: number | null
        }
        Insert: {
          apoiadores?: number | null
          cabos_eleitorais?: number | null
          cidade_id: string
          created_at?: string
          id?: string
          materiais_distribuidos?: number | null
          updated_at?: string
          veiculos?: number | null
        }
        Update: {
          apoiadores?: number | null
          cabos_eleitorais?: number | null
          cidade_id?: string
          created_at?: string
          id?: string
          materiais_distribuidos?: number | null
          updated_at?: string
          veiculos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estrutura_campanha_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: true
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          criado_por_nome: string | null
          criado_por_user_id: string | null
          date: string
          description: string
          id: string
          notes: string | null
          payment_method: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string | null
          date?: string
          description: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string | null
          date?: string
          description?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      instagram_daily_snapshots: {
        Row: {
          avg_engagement: number
          created_at: string
          followers: number
          following: number
          id: string
          media_count: number
          profile_views: number
          snapshot_date: string
          total_comments: number
          total_impressions: number
          total_likes: number
          total_posts: number
          total_reach: number
          total_saves: number
          total_shares: number
          updated_at: string
        }
        Insert: {
          avg_engagement?: number
          created_at?: string
          followers?: number
          following?: number
          id?: string
          media_count?: number
          profile_views?: number
          snapshot_date?: string
          total_comments?: number
          total_impressions?: number
          total_likes?: number
          total_posts?: number
          total_reach?: number
          total_saves?: number
          total_shares?: number
          updated_at?: string
        }
        Update: {
          avg_engagement?: number
          created_at?: string
          followers?: number
          following?: number
          id?: string
          media_count?: number
          profile_views?: number
          snapshot_date?: string
          total_comments?: number
          total_impressions?: number
          total_likes?: number
          total_posts?: number
          total_reach?: number
          total_saves?: number
          total_shares?: number
          updated_at?: string
        }
        Relationships: []
      }
      integration_secrets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key_name: string
          key_value: string | null
          service: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key_name: string
          key_value?: string | null
          service: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key_name?: string
          key_value?: string | null
          service?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_contact_status: {
        Row: {
          confirm_status: string | null
          created_at: string
          observacao: string | null
          phone_key: string
          sent_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          confirm_status?: string | null
          created_at?: string
          observacao?: string | null
          phone_key: string
          sent_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          confirm_status?: string | null
          created_at?: string
          observacao?: string | null
          phone_key?: string
          sent_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      leads_centralizados: {
        Row: {
          bairro: string | null
          captador_nome: string | null
          captured_at: string
          chave_licenca: string
          cidade_nome: string | null
          cliente_nome: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          nome_completo: string
          origem_lead_id: string | null
          raw_payload: Json | null
          telefone: string | null
          tipo_captador: string | null
          url_origem: string | null
          zona_eleitoral: string | null
        }
        Insert: {
          bairro?: string | null
          captador_nome?: string | null
          captured_at?: string
          chave_licenca: string
          cidade_nome?: string | null
          cliente_nome?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome_completo: string
          origem_lead_id?: string | null
          raw_payload?: Json | null
          telefone?: string | null
          tipo_captador?: string | null
          url_origem?: string | null
          zona_eleitoral?: string | null
        }
        Update: {
          bairro?: string | null
          captador_nome?: string | null
          captured_at?: string
          chave_licenca?: string
          cidade_nome?: string | null
          cliente_nome?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome_completo?: string
          origem_lead_id?: string | null
          raw_payload?: Json | null
          telefone?: string | null
          tipo_captador?: string | null
          url_origem?: string | null
          zona_eleitoral?: string | null
        }
        Relationships: []
      }
      licencas: {
        Row: {
          chave_licenca: string
          cliente_email: string | null
          cliente_empresa: string | null
          cliente_nome: string
          cliente_telefone: string | null
          created_at: string
          created_by: string | null
          data_inicio: string
          data_validade: string | null
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          plano: string
          status: string
          updated_at: string
          url_projeto: string | null
          valor_pago: number | null
        }
        Insert: {
          chave_licenca: string
          cliente_email?: string | null
          cliente_empresa?: string | null
          cliente_nome: string
          cliente_telefone?: string | null
          created_at?: string
          created_by?: string | null
          data_inicio?: string
          data_validade?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          plano?: string
          status?: string
          updated_at?: string
          url_projeto?: string | null
          valor_pago?: number | null
        }
        Update: {
          chave_licenca?: string
          cliente_email?: string | null
          cliente_empresa?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string
          created_by?: string | null
          data_inicio?: string
          data_validade?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          plano?: string
          status?: string
          updated_at?: string
          url_projeto?: string | null
          valor_pago?: number | null
        }
        Relationships: []
      }
      liderancas: {
        Row: {
          bairros: string[] | null
          cidade_base_id: string | null
          cidades_representadas: string[] | null
          coordenador_cidade_id: string | null
          coordenador_user_id: string | null
          created_at: string
          forca_politica: Database["public"]["Enums"]["forca_politica"]
          historico_politico: string | null
          id: string
          nome: string
          observacoes: string | null
          permite_cadastro_cabos: boolean
          promoted_from_id: string | null
          promoted_from_origem: string | null
          status: Database["public"]["Enums"]["status_lideranca"]
          telefone: string | null
          token_publico: string | null
          updated_at: string
          votos_estimados: number | null
          votos_por_cidade: Json | null
          whatsapp: string | null
          zonas_por_cidade: Json | null
        }
        Insert: {
          bairros?: string[] | null
          cidade_base_id?: string | null
          cidades_representadas?: string[] | null
          coordenador_cidade_id?: string | null
          coordenador_user_id?: string | null
          created_at?: string
          forca_politica?: Database["public"]["Enums"]["forca_politica"]
          historico_politico?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          permite_cadastro_cabos?: boolean
          promoted_from_id?: string | null
          promoted_from_origem?: string | null
          status?: Database["public"]["Enums"]["status_lideranca"]
          telefone?: string | null
          token_publico?: string | null
          updated_at?: string
          votos_estimados?: number | null
          votos_por_cidade?: Json | null
          whatsapp?: string | null
          zonas_por_cidade?: Json | null
        }
        Update: {
          bairros?: string[] | null
          cidade_base_id?: string | null
          cidades_representadas?: string[] | null
          coordenador_cidade_id?: string | null
          coordenador_user_id?: string | null
          created_at?: string
          forca_politica?: Database["public"]["Enums"]["forca_politica"]
          historico_politico?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          permite_cadastro_cabos?: boolean
          promoted_from_id?: string | null
          promoted_from_origem?: string | null
          status?: Database["public"]["Enums"]["status_lideranca"]
          telefone?: string | null
          token_publico?: string | null
          updated_at?: string
          votos_estimados?: number | null
          votos_por_cidade?: Json | null
          whatsapp?: string | null
          zonas_por_cidade?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "liderancas_cidade_base_id_fkey"
            columns: ["cidade_base_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liderancas_coordenador_cidade_id_fkey"
            columns: ["coordenador_cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_profiles: {
        Row: {
          city: string | null
          cpf: string | null
          created_at: string
          full_name: string
          id: string
          management: string | null
          neighborhood: string | null
          phone: string | null
          region: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          cpf?: string | null
          created_at?: string
          full_name: string
          id?: string
          management?: string | null
          neighborhood?: string | null
          phone?: string | null
          region?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string
          id?: string
          management?: string | null
          neighborhood?: string | null
          phone?: string | null
          region?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      material_requests: {
        Row: {
          cidade_destino: string
          cidade_id: string | null
          coordenador_nome: string
          created_at: string
          id: string
          lideranca_id: string | null
          lideranca_nome: string | null
          material_id: string | null
          material_nome: string | null
          numero_pedido: number
          observacoes: string | null
          prioridade: string
          quantidade_atendida: number
          quantidade_solicitada: number
          resposta_logistica: string | null
          solicitante_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cidade_destino: string
          cidade_id?: string | null
          coordenador_nome: string
          created_at?: string
          id?: string
          lideranca_id?: string | null
          lideranca_nome?: string | null
          material_id?: string | null
          material_nome?: string | null
          numero_pedido?: number
          observacoes?: string | null
          prioridade?: string
          quantidade_atendida?: number
          quantidade_solicitada?: number
          resposta_logistica?: string | null
          solicitante_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cidade_destino?: string
          cidade_id?: string | null
          coordenador_nome?: string
          created_at?: string
          id?: string
          lideranca_id?: string | null
          lideranca_nome?: string | null
          material_id?: string | null
          material_nome?: string | null
          numero_pedido?: number
          observacoes?: string | null
          prioridade?: string
          quantidade_atendida?: number
          quantidade_solicitada?: number
          resposta_logistica?: string | null
          solicitante_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_lideranca_id_fkey"
            columns: ["lideranca_id"]
            isOneToOne: false
            referencedRelation: "liderancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_requests_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          available_qty: number
          city: string | null
          created_at: string
          distributed_qty: number
          id: string
          management: string | null
          min_stock_qty: number
          model: string | null
          name: string
          sent_date: string | null
          serial_number: string | null
          status: string
          total_price: number | null
          total_qty: number
          type: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          available_qty?: number
          city?: string | null
          created_at?: string
          distributed_qty?: number
          id?: string
          management?: string | null
          min_stock_qty?: number
          model?: string | null
          name: string
          sent_date?: string | null
          serial_number?: string | null
          status?: string
          total_price?: number | null
          total_qty?: number
          type: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          available_qty?: number
          city?: string | null
          created_at?: string
          distributed_qty?: number
          id?: string
          management?: string | null
          min_stock_qty?: number
          model?: string | null
          name?: string
          sent_date?: string | null
          serial_number?: string | null
          status?: string
          total_price?: number | null
          total_qty?: number
          type?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      movements: {
        Row: {
          city: string | null
          coordinator_name: string | null
          created_at: string
          id: string
          leader_name: string | null
          material_id: string
          model: string | null
          notes: string | null
          quantity: number
          responsible_id: string | null
          serial_number: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          coordinator_name?: string | null
          created_at?: string
          id?: string
          leader_name?: string | null
          material_id: string
          model?: string | null
          notes?: string | null
          quantity?: number
          responsible_id?: string | null
          serial_number?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          coordinator_name?: string | null
          created_at?: string
          id?: string
          leader_name?: string | null
          material_id?: string
          model?: string | null
          notes?: string | null
          quantity?: number
          responsible_id?: string | null
          serial_number?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "logistics_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedule: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          criado_por_nome: string | null
          criado_por_user_id: string | null
          description: string
          due_date: string
          id: string
          notes: string | null
          payee: string
          payment_method: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string | null
          description: string
          due_date: string
          id?: string
          notes?: string | null
          payee: string
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string | null
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          payee?: string
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      planejamento_logistico: {
        Row: {
          adesivo_parachoque: number | null
          adesivo_perfurado: number | null
          cidade_id: string
          coordenador_user_id: string | null
          created_at: string
          flayer: number | null
          id: string
          observacoes: string | null
          panfleto: number | null
          praguinha: number | null
          santinhos: number | null
          updated_at: string
          wind_banner: number | null
        }
        Insert: {
          adesivo_parachoque?: number | null
          adesivo_perfurado?: number | null
          cidade_id: string
          coordenador_user_id?: string | null
          created_at?: string
          flayer?: number | null
          id?: string
          observacoes?: string | null
          panfleto?: number | null
          praguinha?: number | null
          santinhos?: number | null
          updated_at?: string
          wind_banner?: number | null
        }
        Update: {
          adesivo_parachoque?: number | null
          adesivo_perfurado?: number | null
          cidade_id?: string
          coordenador_user_id?: string | null
          created_at?: string
          flayer?: number | null
          id?: string
          observacoes?: string | null
          panfleto?: number | null
          praguinha?: number | null
          santinhos?: number | null
          updated_at?: string
          wind_banner?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planejamento_logistico_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
        ]
      }
      planejamento_semanal: {
        Row: {
          bairro_principal: string | null
          bairros_secundarios: string[] | null
          cidade_id: string | null
          coordenador_user_id: string | null
          created_at: string
          criado_por_user_id: string | null
          equipe_prevista: number | null
          id: string
          lideranca_id: string | null
          meta_semana: string | null
          semana_fim: string
          semana_inicio: string
          status: string
          updated_at: string
        }
        Insert: {
          bairro_principal?: string | null
          bairros_secundarios?: string[] | null
          cidade_id?: string | null
          coordenador_user_id?: string | null
          created_at?: string
          criado_por_user_id?: string | null
          equipe_prevista?: number | null
          id?: string
          lideranca_id?: string | null
          meta_semana?: string | null
          semana_fim: string
          semana_inicio: string
          status?: string
          updated_at?: string
        }
        Update: {
          bairro_principal?: string | null
          bairros_secundarios?: string[] | null
          cidade_id?: string | null
          coordenador_user_id?: string | null
          created_at?: string
          criado_por_user_id?: string | null
          equipe_prevista?: number | null
          id?: string
          lideranca_id?: string | null
          meta_semana?: string | null
          semana_fim?: string
          semana_inicio?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planejamento_semanal_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planejamento_semanal_lideranca_id_fkey"
            columns: ["lideranca_id"]
            isOneToOne: false
            referencedRelation: "liderancas"
            referencedColumns: ["id"]
          },
        ]
      }
      pontos_entrega: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade_id: string | null
          coordenador_user_id: string | null
          created_at: string
          endereco: string
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          observacoes: string | null
          referencia: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade_id?: string | null
          coordenador_user_id?: string | null
          created_at?: string
          endereco: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          observacoes?: string | null
          referencia?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade_id?: string | null
          coordenador_user_id?: string | null
          created_at?: string
          endereco?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          observacoes?: string | null
          referencia?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontos_entrega_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cor: string | null
          created_at: string
          email: string
          id: string
          lideranca_vinculada_id: string | null
          must_change_password: boolean
          nome: string
          token_publico: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cor?: string | null
          created_at?: string
          email: string
          id?: string
          lideranca_vinculada_id?: string | null
          must_change_password?: boolean
          nome: string
          token_publico?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cor?: string | null
          created_at?: string
          email?: string
          id?: string
          lideranca_vinculada_id?: string | null
          must_change_password?: boolean
          nome?: string
          token_publico?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_lideranca_vinculada_id_fkey"
            columns: ["lideranca_vinculada_id"]
            isOneToOne: false
            referencedRelation: "liderancas"
            referencedColumns: ["id"]
          },
        ]
      }
      projecao_votos: {
        Row: {
          cidade_id: string
          created_at: string
          data_atualizacao: string | null
          id: string
          lideranca_id: string | null
          meta_votos: number | null
          nivel_confianca: Database["public"]["Enums"]["nivel_confianca"]
          observacoes: string | null
          responsavel: string | null
          updated_at: string
          votos_confirmados: number | null
          votos_projetados: number | null
        }
        Insert: {
          cidade_id: string
          created_at?: string
          data_atualizacao?: string | null
          id?: string
          lideranca_id?: string | null
          meta_votos?: number | null
          nivel_confianca?: Database["public"]["Enums"]["nivel_confianca"]
          observacoes?: string | null
          responsavel?: string | null
          updated_at?: string
          votos_confirmados?: number | null
          votos_projetados?: number | null
        }
        Update: {
          cidade_id?: string
          created_at?: string
          data_atualizacao?: string | null
          id?: string
          lideranca_id?: string | null
          meta_votos?: number | null
          nivel_confianca?: Database["public"]["Enums"]["nivel_confianca"]
          observacoes?: string | null
          responsavel?: string | null
          updated_at?: string
          votos_confirmados?: number | null
          votos_projetados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projecao_votos_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projecao_votos_lideranca_id_fkey"
            columns: ["lideranca_id"]
            isOneToOne: false
            referencedRelation: "liderancas"
            referencedColumns: ["id"]
          },
        ]
      }
      public_map_links: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          label: string | null
          token: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          token: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          label?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      reimbursements: {
        Row: {
          amount: number
          created_at: string
          criado_por_nome: string | null
          criado_por_user_id: string | null
          date: string
          description: string
          id: string
          notes: string | null
          payment_method: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string | null
          date?: string
          description: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          criado_por_nome?: string | null
          criado_por_user_id?: string | null
          date?: string
          description?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rota_parada_itens: {
        Row: {
          created_at: string
          id: string
          material_id: string | null
          material_nome: string
          parada_id: string
          quantidade: number
        }
        Insert: {
          created_at?: string
          id?: string
          material_id?: string | null
          material_nome: string
          parada_id: string
          quantidade?: number
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string | null
          material_nome?: string
          parada_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "rota_parada_itens_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_parada_itens_parada_id_fkey"
            columns: ["parada_id"]
            isOneToOne: false
            referencedRelation: "rota_paradas"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_paradas: {
        Row: {
          cidade_id: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string
          distancia_metros: number | null
          duracao_segundos: number | null
          endereco: string
          entregue: boolean
          entregue_em: string | null
          id: string
          latitude: number | null
          longitude: number | null
          material_request_id: string | null
          observacoes: string | null
          ordem: number
          ponto_entrega_id: string | null
          rota_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          cidade_id?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          distancia_metros?: number | null
          duracao_segundos?: number | null
          endereco: string
          entregue?: boolean
          entregue_em?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          material_request_id?: string | null
          observacoes?: string | null
          ordem?: number
          ponto_entrega_id?: string | null
          rota_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          cidade_id?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string
          distancia_metros?: number | null
          duracao_segundos?: number | null
          endereco?: string
          entregue?: boolean
          entregue_em?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          material_request_id?: string | null
          observacoes?: string | null
          ordem?: number
          ponto_entrega_id?: string | null
          rota_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_paradas_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_paradas_material_request_id_fkey"
            columns: ["material_request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_paradas_ponto_entrega_id_fkey"
            columns: ["ponto_entrega_id"]
            isOneToOne: false
            referencedRelation: "pontos_entrega"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_paradas_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas_entrega"
            referencedColumns: ["id"]
          },
        ]
      }
      rotas_entrega: {
        Row: {
          created_at: string
          criado_por_user_id: string | null
          data_saida: string
          distancia_total_metros: number | null
          duracao_total_segundos: number | null
          id: string
          motorista: string | null
          nome: string
          observacoes: string | null
          origem_endereco: string
          origem_latitude: number | null
          origem_longitude: number | null
          status: string
          updated_at: string
          veiculo: string | null
        }
        Insert: {
          created_at?: string
          criado_por_user_id?: string | null
          data_saida?: string
          distancia_total_metros?: number | null
          duracao_total_segundos?: number | null
          id?: string
          motorista?: string | null
          nome: string
          observacoes?: string | null
          origem_endereco?: string
          origem_latitude?: number | null
          origem_longitude?: number | null
          status?: string
          updated_at?: string
          veiculo?: string | null
        }
        Update: {
          created_at?: string
          criado_por_user_id?: string | null
          data_saida?: string
          distancia_total_metros?: number | null
          duracao_total_segundos?: number | null
          id?: string
          motorista?: string | null
          nome?: string
          observacoes?: string | null
          origem_endereco?: string
          origem_latitude?: number | null
          origem_longitude?: number | null
          status?: string
          updated_at?: string
          veiculo?: string | null
        }
        Relationships: []
      }
      santinho_geracoes: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      social_competitor_snapshots: {
        Row: {
          avg_engagement: number
          biography: string | null
          competitor_id: string
          created_at: string
          followers: number
          follows: number
          id: string
          media_count: number
          profile_picture_url: string | null
          snapshot_date: string
          themes: Json
          top_posts: Json
          total_comments: number
          total_likes: number
        }
        Insert: {
          avg_engagement?: number
          biography?: string | null
          competitor_id: string
          created_at?: string
          followers?: number
          follows?: number
          id?: string
          media_count?: number
          profile_picture_url?: string | null
          snapshot_date?: string
          themes?: Json
          top_posts?: Json
          total_comments?: number
          total_likes?: number
        }
        Update: {
          avg_engagement?: number
          biography?: string | null
          competitor_id?: string
          created_at?: string
          followers?: number
          follows?: number
          id?: string
          media_count?: number
          profile_picture_url?: string | null
          snapshot_date?: string
          themes?: Json
          top_posts?: Json
          total_comments?: number
          total_likes?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_competitor_snapshots_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "social_competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      social_competitors: {
        Row: {
          ativo: boolean
          cargo: string | null
          created_at: string
          display_name: string | null
          id: string
          observacoes: string | null
          partido: string | null
          updated_at: string
          username: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          observacoes?: string | null
          partido?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          observacoes?: string | null
          partido?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      social_discovery_profiles: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          created_at: string
          foto_url: string | null
          id: string
          nome: string
          plataforma: string
          score: number | null
          updated_at: string
          url_perfil: string | null
          username: string
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          nome: string
          plataforma: string
          score?: number | null
          updated_at?: string
          url_perfil?: string | null
          username: string
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string
          foto_url?: string | null
          id?: string
          nome?: string
          plataforma?: string
          score?: number | null
          updated_at?: string
          url_perfil?: string | null
          username?: string
        }
        Relationships: []
      }
      social_engagers: {
        Row: {
          created_at: string
          frequencia_interacao: string | null
          id: string
          profile_id: string
          total_comentarios: number | null
          ultima_interacao: string | null
          username: string
        }
        Insert: {
          created_at?: string
          frequencia_interacao?: string | null
          id?: string
          profile_id: string
          total_comentarios?: number | null
          ultima_interacao?: string | null
          username: string
        }
        Update: {
          created_at?: string
          frequencia_interacao?: string | null
          id?: string
          profile_id?: string
          total_comentarios?: number | null
          ultima_interacao?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_engagers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "social_discovery_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_metrics: {
        Row: {
          crescimento: number | null
          data_coleta: string
          engajamento: number | null
          id: string
          profile_id: string
          seguidores: number | null
          total_posts: number | null
        }
        Insert: {
          crescimento?: number | null
          data_coleta?: string
          engajamento?: number | null
          id?: string
          profile_id: string
          seguidores?: number | null
          total_posts?: number | null
        }
        Update: {
          crescimento?: number | null
          data_coleta?: string
          engajamento?: number | null
          id?: string
          profile_id?: string
          seguidores?: number | null
          total_posts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_metrics_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "social_discovery_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_api_credentials: {
        Row: {
          access_token: string
          created_at: string
          expiracao_token: string | null
          id: string
          plataforma: string
          refresh_token: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expiracao_token?: string | null
          id?: string
          plataforma: string
          refresh_token?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expiracao_token?: string | null
          id?: string
          plataforma?: string
          refresh_token?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      tse_candidatos: {
        Row: {
          ano_eleicao: number
          cargo: string
          codigo_municipio: string | null
          created_at: string
          id: string
          municipio: string | null
          nome_completo: string | null
          nome_partido: string | null
          nome_urna: string
          numero_candidato: string
          sigla_partido: string | null
          situacao: string | null
          total_votos: number | null
        }
        Insert: {
          ano_eleicao?: number
          cargo: string
          codigo_municipio?: string | null
          created_at?: string
          id?: string
          municipio?: string | null
          nome_completo?: string | null
          nome_partido?: string | null
          nome_urna: string
          numero_candidato: string
          sigla_partido?: string | null
          situacao?: string | null
          total_votos?: number | null
        }
        Update: {
          ano_eleicao?: number
          cargo?: string
          codigo_municipio?: string | null
          created_at?: string
          id?: string
          municipio?: string | null
          nome_completo?: string | null
          nome_partido?: string | null
          nome_urna?: string
          numero_candidato?: string
          sigla_partido?: string | null
          situacao?: string | null
          total_votos?: number | null
        }
        Relationships: []
      }
      tse_votos_municipio: {
        Row: {
          ano_eleicao: number
          candidato_id: string | null
          codigo_municipio: string | null
          created_at: string
          id: string
          municipio: string
          total_votos: number | null
          zona_eleitoral: string | null
        }
        Insert: {
          ano_eleicao?: number
          candidato_id?: string | null
          codigo_municipio?: string | null
          created_at?: string
          id?: string
          municipio: string
          total_votos?: number | null
          zona_eleitoral?: string | null
        }
        Update: {
          ano_eleicao?: number
          candidato_id?: string | null
          codigo_municipio?: string | null
          created_at?: string
          id?: string
          municipio?: string
          total_votos?: number | null
          zona_eleitoral?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tse_votos_municipio_candidato_id_fkey"
            columns: ["candidato_id"]
            isOneToOne: false
            referencedRelation: "tse_candidatos"
            referencedColumns: ["id"]
          },
        ]
      }
      tse_zona_bairros: {
        Row: {
          bairros: string
          created_at: string
          id: string
          municipio: string
          zona: number
        }
        Insert: {
          bairros: string
          created_at?: string
          id?: string
          municipio: string
          zona: number
        }
        Update: {
          bairros?: string
          created_at?: string
          id?: string
          municipio?: string
          zona?: number
        }
        Relationships: []
      }
      user_location_consent: {
        Row: {
          consented_at: string
          created_at: string
          device_info: string | null
          frequency_minutes: number
          id: string
          is_active: boolean
          revoked_at: string | null
          terms_text: string | null
          terms_version: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consented_at?: string
          created_at?: string
          device_info?: string | null
          frequency_minutes?: number
          id?: string
          is_active?: boolean
          revoked_at?: string | null
          terms_text?: string | null
          terms_version?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consented_at?: string
          created_at?: string
          device_info?: string | null
          frequency_minutes?: number
          id?: string
          is_active?: boolean
          revoked_at?: string | null
          terms_text?: string | null
          terms_version?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_locations: {
        Row: {
          accuracy: number | null
          altitude: number | null
          battery_level: number | null
          captured_at: string
          created_at: string
          heading: number | null
          id: string
          is_moving: boolean | null
          latitude: number
          longitude: number
          speed: number | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          battery_level?: number | null
          captured_at?: string
          created_at?: string
          heading?: number | null
          id?: string
          is_moving?: boolean | null
          latitude: number
          longitude: number
          speed?: number | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          battery_level?: number | null
          captured_at?: string
          created_at?: string
          heading?: number | null
          id?: string
          is_moving?: boolean | null
          latitude?: number
          longitude?: number
          speed?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          id: string
          module: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitas_campanha: {
        Row: {
          bairro: string | null
          cidade_id: string
          created_at: string
          data_visita: string
          endereco: string | null
          equipe_responsavel: string | null
          id: string
          lideranca_id: string | null
          local_referencia: string | null
          objetivo: string | null
          relatorio: string | null
          resultado: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cidade_id: string
          created_at?: string
          data_visita: string
          endereco?: string | null
          equipe_responsavel?: string | null
          id?: string
          lideranca_id?: string | null
          local_referencia?: string | null
          objetivo?: string | null
          relatorio?: string | null
          resultado?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cidade_id?: string
          created_at?: string
          data_visita?: string
          endereco?: string | null
          equipe_responsavel?: string | null
          id?: string
          lideranca_id?: string | null
          local_referencia?: string | null
          objetivo?: string | null
          relatorio?: string | null
          resultado?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitas_campanha_cidade_id_fkey"
            columns: ["cidade_id"]
            isOneToOne: false
            referencedRelation: "cidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_campanha_lideranca_id_fkey"
            columns: ["lideranca_id"]
            isOneToOne: false
            referencedRelation: "liderancas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          battery: number | null
          connected: boolean
          created_at: string
          id: string
          instance_name: string
          last_connection: string | null
          phone: string | null
          profile_name: string | null
          profile_picture: string | null
          qr_code: string | null
          status: string
          updated_at: string
          user_id: string
          webhook_status: string | null
        }
        Insert: {
          battery?: number | null
          connected?: boolean
          created_at?: string
          id?: string
          instance_name: string
          last_connection?: string | null
          phone?: string | null
          profile_name?: string | null
          profile_picture?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
          webhook_status?: string | null
        }
        Update: {
          battery?: number | null
          connected?: boolean
          created_at?: string
          id?: string
          instance_name?: string
          last_connection?: string | null
          phone?: string | null
          profile_name?: string | null
          profile_picture?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          webhook_status?: string | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          caption: string | null
          content: string | null
          created_at: string
          direction: string
          error: string | null
          external_id: string | null
          from_number: string | null
          id: string
          instance_id: string | null
          media_url: string | null
          message_type: string
          raw: Json | null
          status: string
          to_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          content?: string | null
          created_at?: string
          direction?: string
          error?: string | null
          external_id?: string | null
          from_number?: string | null
          id?: string
          instance_id?: string | null
          media_url?: string | null
          message_type?: string
          raw?: Json | null
          status?: string
          to_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          content?: string | null
          created_at?: string
          direction?: string
          error?: string | null
          external_id?: string | null
          from_number?: string | null
          id?: string
          instance_id?: string | null
          media_url?: string | null
          message_type?: string
          raw?: Json | null
          status?: string
          to_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          created_at: string
          event: string | null
          id: string
          instance_name: string | null
          payload: Json | null
        }
        Insert: {
          created_at?: string
          event?: string | null
          id?: string
          instance_name?: string | null
          payload?: Json | null
        }
        Update: {
          created_at?: string
          event?: string | null
          id?: string
          instance_name?: string | null
          payload?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calc_acao_distancia: { Args: { p_exec_id: string }; Returns: number }
      can_access_planejamento: {
        Args: { _coord: string; _criado: string; _lider: string }
        Returns: boolean
      }
      can_manage_lead_status: { Args: never; Returns: boolean }
      can_write: { Args: never; Returns: boolean }
      captar_eleitor_publico: {
        Args: {
          p_accuracy?: number
          p_bairro?: string
          p_cidade_nome?: string
          p_latitude?: number
          p_longitude?: number
          p_nome_completo: string
          p_observacoes?: string
          p_telefone?: string
          p_token: string
          p_zona_eleitoral?: string
        }
        Returns: Json
      }
      captar_eleitor_publico_v2: {
        Args: {
          p_accuracy?: number
          p_bairro?: string
          p_cidade_nome?: string
          p_latitude?: number
          p_longitude?: number
          p_nome_completo: string
          p_observacoes?: string
          p_telefone?: string
          p_token: string
          p_zona_eleitoral?: string
        }
        Returns: Json
      }
      generate_license_key: { Args: never; Returns: string }
      generate_lideranca_token: { Args: never; Returns: string }
      generate_profile_token: { Args: never; Returns: string }
      generate_public_map_token: { Args: never; Returns: string }
      get_bairros_por_cidade: {
        Args: never
        Returns: {
          bairros: string[]
          cidade_id: string
          cidade_nome: string
          regiao_administrativa: string
          total_bairros: number
        }[]
      }
      get_captador_publico: {
        Args: { p_token: string }
        Returns: {
          cidade_nome: string
          nome: string
          tipo: string
        }[]
      }
      get_captados_hierarchy: {
        Args: never
        Returns: {
          captado_id: string
          captador_user_id: string
          coord_id: string
          lider_id: string
          tipo_captador: string
        }[]
      }
      get_captados_ranking: {
        Args: never
        Returns: {
          nome: string
          total: number
          user_id: string
        }[]
      }
      get_captados_ranking_cabos: {
        Args: never
        Returns: {
          cabo_id: string
          nome: string
          total: number
        }[]
      }
      get_captados_ranking_coordenacao: {
        Args: never
        Returns: {
          nome: string
          total: number
          user_id: string
        }[]
      }
      get_captados_ranking_coordenacao_for: {
        Args: { _user_id: string }
        Returns: {
          nome: string
          total: number
          user_id: string
        }[]
      }
      get_captados_ranking_for: {
        Args: { _user_id: string }
        Returns: {
          nome: string
          total: number
          user_id: string
        }[]
      }
      get_captados_ranking_liderancas: {
        Args: never
        Returns: {
          nome: string
          total: number
          user_id: string
        }[]
      }
      get_captados_ranking_liderancas_for: {
        Args: { _user_id: string }
        Returns: {
          nome: string
          total: number
          user_id: string
        }[]
      }
      get_captados_scope: {
        Args: never
        Returns: {
          captado_id: string
          captador_user_id: string
          coord_id: string
          lider_id: string
          tipo_captador: string
        }[]
      }
      get_captados_scope_for: {
        Args: { _user_id: string }
        Returns: {
          captado_id: string
          captador_user_id: string
          coord_id: string
          lider_id: string
          tipo_captador: string
        }[]
      }
      get_captados_total: { Args: never; Returns: number }
      get_captados_total_coordenacao: { Args: never; Returns: number }
      get_captados_total_for: { Args: { _user_id: string }; Returns: number }
      get_cidades_options: {
        Args: never
        Returns: {
          id: string
          nome: string
          regiao_administrativa: string
        }[]
      }
      get_cidades_representantes: {
        Args: never
        Returns: {
          cabo_count: number
          cidade_id: string
          cidade_nome: string
          coordenador_ids: string[]
          coordenador_nomes: string[]
          lider_count: number
          regiao_administrativa: string
          tem_cabo: boolean
          tem_coordenador: boolean
          tem_lider: boolean
        }[]
      }
      get_conferencias_leads_por_dia: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          confirmados: number
          dia: string
          nao_confirmados: number
          nome: string
          nomes_conferidos: number
          observacoes: number
          sem_resposta: number
          total_acoes: number
          user_id: string
        }[]
      }
      get_coordenadores_regionais: {
        Args: never
        Returns: {
          cor: string
          email: string
          nome: string
          total_cabos: number
          total_cidades: number
          total_lideres: number
          total_votos_estimados: number
          user_id: string
        }[]
      }
      get_integration_secret: {
        Args: { p_key_name: string; p_service: string }
        Returns: string
      }
      get_latest_user_locations: {
        Args: never
        Returns: {
          accuracy: number
          battery_level: number
          captured_at: string
          latitude: number
          longitude: number
          user_id: string
        }[]
      }
      get_lideranca_para_cadastro_cabo: {
        Args: { p_token: string }
        Returns: {
          cidade_nome: string
          coordenador_user_id: string
          lideranca_id: string
          lideranca_nome: string
          permite: boolean
        }[]
      }
      get_lideranca_publica: {
        Args: { p_token: string }
        Returns: {
          cidade_nome: string
          nome: string
        }[]
      }
      get_mapa_geral_cidades: {
        Args: never
        Returns: {
          cor: string
          id: string
          latitude: number
          longitude: number
          nome: string
          qtd_liderancas: number
          regiao_administrativa: string
          tem_dobradinha: boolean
          tem_lideranca: boolean
        }[]
      }
      get_public_map_data: { Args: { p_token: string }; Returns: Json }
      get_user_permissions: { Args: { _user_id: string }; Returns: string[] }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_full_leads_access: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_coordinator: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      list_cidades_publicas: {
        Args: never
        Returns: {
          nome: string
        }[]
      }
      normalize_bairro: { Args: { p: string }; Returns: string }
      normalize_city_name: { Args: { p: string }; Returns: string }
      normalize_person_name: { Args: { p_name: string }; Returns: string }
      normalize_phone: { Args: { p: string }; Returns: string }
      resolve_cidade_nome: {
        Args: { p_cidade_id?: string; p_nome: string }
        Returns: {
          cidade_id: string
          cidade_nome: string
        }[]
      }
      user_can_access_cidade: { Args: { _cidade_id: string }; Returns: boolean }
      user_has_agenda_conjunta: { Args: never; Returns: boolean }
      user_has_campo_planejamento: { Args: never; Returns: boolean }
      user_has_financial_access: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "coordenador_estadual"
        | "coordenador_regional"
        | "operador_cadastro"
        | "analista_eleitoral"
      forca_politica: "baixa" | "media" | "alta"
      nivel_confianca: "baixo" | "medio" | "alto"
      status_lideranca: "ativa" | "potencial" | "em_negociacao"
      tipo_acao_campo:
        | "panfletagem_semaforo"
        | "panfletagem_feira"
        | "corpo_a_corpo_residencial"
        | "corpo_a_corpo_comercial"
        | "bandeiraco"
        | "adesivaco"
        | "caminhada"
        | "carreata"
        | "motociata"
        | "reuniao_comunitaria"
        | "evento_liderancas"
        | "visita_institucional"
      tipo_evento: "reuniao" | "comicio" | "visita" | "carreata" | "debate"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "coordenador_estadual",
        "coordenador_regional",
        "operador_cadastro",
        "analista_eleitoral",
      ],
      forca_politica: ["baixa", "media", "alta"],
      nivel_confianca: ["baixo", "medio", "alto"],
      status_lideranca: ["ativa", "potencial", "em_negociacao"],
      tipo_acao_campo: [
        "panfletagem_semaforo",
        "panfletagem_feira",
        "corpo_a_corpo_residencial",
        "corpo_a_corpo_comercial",
        "bandeiraco",
        "adesivaco",
        "caminhada",
        "carreata",
        "motociata",
        "reuniao_comunitaria",
        "evento_liderancas",
        "visita_institucional",
      ],
      tipo_evento: ["reuniao", "comicio", "visita", "carreata", "debate"],
    },
  },
} as const
