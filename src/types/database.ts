export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          barber_id: string
          business_id: string
          client_id: string
          created_at: string | null
          date: string
          end_time: string
          id: string
          notes: string | null
          service_id: string
          source: string
          start_time: string
          status: string
        }
        Insert: {
          barber_id: string
          business_id: string
          client_id: string
          created_at?: string | null
          date: string
          end_time: string
          id?: string
          notes?: string | null
          service_id: string
          source?: string
          start_time: string
          status?: string
        }
        Update: {
          barber_id?: string
          business_id?: string
          client_id?: string
          created_at?: string | null
          date?: string
          end_time?: string
          id?: string
          notes?: string | null
          service_id?: string
          source?: string
          start_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barber_commissions"
            referencedColumns: ["barber_id"]
          },
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_schedules: {
        Row: {
          barber_id: string
          date: string
          end_time: string
          id: string
          start_time: string
          type: string
        }
        Insert: {
          barber_id: string
          date: string
          end_time: string
          id?: string
          start_time: string
          type: string
        }
        Update: {
          barber_id?: string
          date?: string
          end_time?: string
          id?: string
          start_time?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_schedules_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barber_commissions"
            referencedColumns: ["barber_id"]
          },
          {
            foreignKeyName: "barber_schedules_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          business_id: string
          commission_pct: number
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          photo_url: string | null
          pin: string
          user_id: string | null
        }
        Insert: {
          business_id: string
          commission_pct?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          photo_url?: string | null
          pin: string
          user_id?: string | null
        }
        Update: {
          business_id?: string
          commission_pct?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          photo_url?: string | null
          pin?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barbers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          business_id: string
          close_time: string
          day_of_week: number
          id: string
          is_open: boolean | null
          open_time: string
        }
        Insert: {
          business_id: string
          close_time: string
          day_of_week: number
          id?: string
          is_open?: boolean | null
          open_time: string
        }
        Update: {
          business_id?: string
          close_time?: string
          day_of_week?: number
          id?: string
          is_open?: boolean | null
          open_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          slug: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          slug: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          slug?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          business_id: string
          created_at: string | null
          email: string | null
          id: string
          last_visit: string | null
          name: string
          notes: string | null
          phone: string
          visit_count: number | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          last_visit?: string | null
          name: string
          notes?: string | null
          phone: string
          visit_count?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          last_visit?: string | null
          name?: string
          notes?: string | null
          phone?: string
          visit_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          appointment_id: string
          barber_id: string
          commission_amount: number
          created_at: string | null
          id: string
          payment_method: string
        }
        Insert: {
          amount: number
          appointment_id: string
          barber_id: string
          commission_amount: number
          created_at?: string | null
          id?: string
          payment_method: string
        }
        Update: {
          amount?: number
          appointment_id?: string
          barber_id?: string
          commission_amount?: number
          created_at?: string | null
          id?: string
          payment_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barber_commissions"
            referencedColumns: ["barber_id"]
          },
          {
            foreignKeyName: "payments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          name: string
          price: number
          sort_order: number | null
        }
        Insert: {
          business_id: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          sort_order?: number | null
        }
        Update: {
          business_id?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      barber_commissions: {
        Row: {
          barber_id: string | null
          comision_total: number | null
          fecha: string | null
          ingreso_total: number | null
          name: string | null
          total_servicios: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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
