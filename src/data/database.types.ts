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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      day_history: {
        Row: {
          created: number
          day: string
          deleted: number
          done: number
          gained: number
          lost: number
          net: number
          paused: boolean
          prom: number
          prom_kept: number
          reps: number
          reps_done: number
          undone: number
          user_id: string
        }
        Insert: {
          created?: number
          day: string
          deleted?: number
          done?: number
          gained?: number
          lost?: number
          net?: number
          paused?: boolean
          prom?: number
          prom_kept?: number
          reps?: number
          reps_done?: number
          undone?: number
          user_id?: string
        }
        Update: {
          created?: number
          day?: string
          deleted?: number
          done?: number
          gained?: number
          lost?: number
          net?: number
          paused?: boolean
          prom?: number
          prom_kept?: number
          reps?: number
          reps_done?: number
          undone?: number
          user_id?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          day: string
          id: string
          item_id: string | null
          kind: string | null
          meta: Json | null
          title: string | null
          ts: string
          type: string
          user_id: string
          xp: number
        }
        Insert: {
          day: string
          id: string
          item_id?: string | null
          kind?: string | null
          meta?: Json | null
          title?: string | null
          ts?: string
          type: string
          user_id?: string
          xp?: number
        }
        Update: {
          day?: string
          id?: string
          item_id?: string | null
          kind?: string | null
          meta?: Json | null
          title?: string | null
          ts?: string
          type?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      ideas: {
        Row: {
          created_on: string
          deleted_at: string | null
          id: string
          position: number
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_on: string
          deleted_at?: string | null
          id?: string
          position?: number
          text: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_on?: string
          deleted_at?: string | null
          id?: string
          position?: number
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          created_on: string
          deleted_at: string | null
          done: boolean
          done_count: number
          done_on: string | null
          due: string | null
          due_penalized: string | null
          effort: number
          gain: number | null
          id: string
          kind: string
          note: string | null
          penalized_on: string | null
          position: number
          promise_date: string | null
          recur: Json
          times: number
          title: string
          updated_at: string
          user_id: string
          window_from: string | null
          window_to: string | null
        }
        Insert: {
          created_on: string
          deleted_at?: string | null
          done?: boolean
          done_count?: number
          done_on?: string | null
          due?: string | null
          due_penalized?: string | null
          effort?: number
          gain?: number | null
          id?: string
          kind: string
          note?: string | null
          penalized_on?: string | null
          position?: number
          promise_date?: string | null
          recur?: Json
          times?: number
          title: string
          updated_at?: string
          user_id?: string
          window_from?: string | null
          window_to?: string | null
        }
        Update: {
          created_on?: string
          deleted_at?: string | null
          done?: boolean
          done_count?: number
          done_on?: string | null
          due?: string | null
          due_penalized?: string | null
          effort?: number
          gain?: number | null
          id?: string
          kind?: string
          note?: string | null
          penalized_on?: string | null
          position?: number
          promise_date?: string | null
          recur?: Json
          times?: number
          title?: string
          updated_at?: string
          user_id?: string
          window_from?: string | null
          window_to?: string | null
        }
        Relationships: []
      }
      notif_sent: {
        Row: {
          day: string
          key: string
          user_id: string
        }
        Insert: {
          day: string
          key: string
          user_id: string
        }
        Update: {
          day?: string
          key?: string
          user_id?: string
        }
        Relationships: []
      }
      pauses: {
        Row: {
          from_day: string
          id: string
          reason: string
          until_day: string | null
          user_id: string
        }
        Insert: {
          from_day: string
          id?: string
          reason: string
          until_day?: string | null
          user_id?: string
        }
        Update: {
          from_day?: string
          id?: string
          reason?: string
          until_day?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          last_date: string | null
          notif: Json
          timezone: string
          xp: number
        }
        Insert: {
          created_at?: string
          id: string
          last_date?: string | null
          notif?: Json
          timezone?: string
          xp?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_date?: string | null
          notif?: Json
          timezone?: string
          xp?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_xp: { Args: { evs: Json }; Returns: number }
      commit_rollover: {
        Args: {
          p_events: Json
          p_from: string
          p_history: Json
          p_items: Json
          p_today: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
