export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      alerts: {
        Row: {
          confidence: number;
          contributions: Json;
          created_at: string;
          id: string;
          narrative: string | null;
          raised_at: string;
          rul_minutes: number | null;
          session_id: string;
          severity: string;
          subsystem: string;
          title: string;
        };
        Insert: {
          confidence?: number;
          contributions?: Json;
          created_at?: string;
          id?: string;
          narrative?: string | null;
          raised_at?: string;
          rul_minutes?: number | null;
          session_id: string;
          severity: string;
          subsystem: string;
          title: string;
        };
        Update: {
          confidence?: number;
          contributions?: Json;
          created_at?: string;
          id?: string;
          narrative?: string | null;
          raised_at?: string;
          rul_minutes?: number | null;
          session_id?: string;
          severity?: string;
          subsystem?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alerts_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "telemetry_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      blackbox_entries: {
        Row: {
          created_at: string;
          hash: string;
          id: number;
          kind: string;
          logged_at: string;
          payload: Json;
          prev_hash: string;
          seq: number;
          session_id: string;
        };
        Insert: {
          created_at?: string;
          hash: string;
          id?: number;
          kind: string;
          logged_at?: string;
          payload: Json;
          prev_hash: string;
          seq: number;
          session_id: string;
        };
        Update: {
          created_at?: string;
          hash?: string;
          id?: number;
          kind?: string;
          logged_at?: string;
          payload?: Json;
          prev_hash?: string;
          seq?: number;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blackbox_entries_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "telemetry_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      fault_events: {
        Row: {
          cleared_at: string | null;
          created_at: string;
          id: string;
          injected_at: string;
          label: string;
          scenario_key: string;
          session_id: string;
          severity: string;
          subsystem: string;
        };
        Insert: {
          cleared_at?: string | null;
          created_at?: string;
          id?: string;
          injected_at?: string;
          label: string;
          scenario_key: string;
          session_id: string;
          severity?: string;
          subsystem: string;
        };
        Update: {
          cleared_at?: string | null;
          created_at?: string;
          id?: string;
          injected_at?: string;
          label?: string;
          scenario_key?: string;
          session_id?: string;
          severity?: string;
          subsystem?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fault_events_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "telemetry_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      self_heal_actions: {
        Row: {
          acted_at: string;
          action: string;
          created_at: string;
          detail: string | null;
          id: string;
          session_id: string;
          status: string;
          trigger_key: string;
        };
        Insert: {
          acted_at?: string;
          action: string;
          created_at?: string;
          detail?: string | null;
          id?: string;
          session_id: string;
          status?: string;
          trigger_key: string;
        };
        Update: {
          acted_at?: string;
          action?: string;
          created_at?: string;
          detail?: string | null;
          id?: string;
          session_id?: string;
          status?: string;
          trigger_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "self_heal_actions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "telemetry_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      telemetry_sessions: {
        Row: {
          airframe: string;
          created_at: string;
          ended_at: string | null;
          flight_profile: string;
          id: string;
          mission_name: string;
          started_at: string;
          synthetic: boolean;
        };
        Insert: {
          airframe?: string;
          created_at?: string;
          ended_at?: string | null;
          flight_profile?: string;
          id?: string;
          mission_name: string;
          started_at?: string;
          synthetic?: boolean;
        };
        Update: {
          airframe?: string;
          created_at?: string;
          ended_at?: string | null;
          flight_profile?: string;
          id?: string;
          mission_name?: string;
          started_at?: string;
          synthetic?: boolean;
        };
        Relationships: [];
      };
      telemetry_snapshots: {
        Row: {
          created_at: string;
          flight_profile: string;
          health: Json;
          id: number;
          params: Json;
          session_id: string;
          t: string;
        };
        Insert: {
          created_at?: string;
          flight_profile?: string;
          health: Json;
          id?: number;
          params: Json;
          session_id: string;
          t?: string;
        };
        Update: {
          created_at?: string;
          flight_profile?: string;
          health?: Json;
          id?: number;
          params?: Json;
          session_id?: string;
          t?: string;
        };
        Relationships: [
          {
            foreignKeyName: "telemetry_snapshots_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "telemetry_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
