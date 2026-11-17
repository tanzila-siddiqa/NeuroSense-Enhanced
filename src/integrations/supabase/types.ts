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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          chat_session_id: string
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          chat_session_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          chat_session_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_session_id_fkey"
            columns: ["chat_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dataset_samples: {
        Row: {
          class_label: string
          created_at: string
          dataset_version_id: string
          file_hash: string | null
          file_name: string
          file_size: number
          id: string
          status: string
        }
        Insert: {
          class_label?: string
          created_at?: string
          dataset_version_id: string
          file_hash?: string | null
          file_name: string
          file_size?: number
          id?: string
          status?: string
        }
        Update: {
          class_label?: string
          created_at?: string
          dataset_version_id?: string
          file_hash?: string | null
          file_name?: string
          file_size?: number
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dataset_samples_dataset_version_id_fkey"
            columns: ["dataset_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      dataset_versions: {
        Row: {
          class_counts: Json
          created_at: string
          duplicate_files: number
          error_message: string | null
          id: string
          invalid_files: number
          is_current: boolean
          modality: string
          notes: string | null
          original_filename: string | null
          status: string
          storage_path: string
          total_files: number
          uploaded_by: string | null
          valid_files: number
          version: number
        }
        Insert: {
          class_counts?: Json
          created_at?: string
          duplicate_files?: number
          error_message?: string | null
          id?: string
          invalid_files?: number
          is_current?: boolean
          modality: string
          notes?: string | null
          original_filename?: string | null
          status?: string
          storage_path: string
          total_files?: number
          uploaded_by?: string | null
          valid_files?: number
          version: number
        }
        Update: {
          class_counts?: Json
          created_at?: string
          duplicate_files?: number
          error_message?: string | null
          id?: string
          invalid_files?: number
          is_current?: boolean
          modality?: string
          notes?: string | null
          original_filename?: string | null
          status?: string
          storage_path?: string
          total_files?: number
          uploaded_by?: string | null
          valid_files?: number
          version?: number
        }
        Relationships: []
      }
      drawing_results: {
        Row: {
          confidence: number
          created_at: string
          drawing_session_id: string
          id: string
          is_demo: boolean
          model_version: string | null
          probability: number
          user_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          drawing_session_id: string
          id?: string
          is_demo?: boolean
          model_version?: string | null
          probability: number
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          drawing_session_id?: string
          id?: string
          is_demo?: boolean
          model_version?: string | null
          probability?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawing_results_drawing_session_id_fkey"
            columns: ["drawing_session_id"]
            isOneToOne: false
            referencedRelation: "drawing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      drawing_sessions: {
        Row: {
          avg_speed: number
          created_at: string
          duration_ms: number
          id: string
          image_path: string | null
          point_count: number
          screening_session_id: string | null
          stroke_count: number
          task: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_speed?: number
          created_at?: string
          duration_ms?: number
          id?: string
          image_path?: string | null
          point_count?: number
          screening_session_id?: string | null
          stroke_count?: number
          task: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_speed?: number
          created_at?: string
          duration_ms?: number
          id?: string
          image_path?: string | null
          point_count?: number
          screening_session_id?: string | null
          stroke_count?: number
          task?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drawing_sessions_screening_session_id_fkey"
            columns: ["screening_session_id"]
            isOneToOne: false
            referencedRelation: "screening_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      fusion_results: {
        Row: {
          confidence: number
          created_at: string
          drawing_probability: number | null
          drawing_result_id: string | null
          drawing_weight: number
          id: string
          is_demo: boolean
          overall_probability: number
          risk_category: string
          screening_session_id: string | null
          updated_at: string
          user_id: string
          voice_probability: number | null
          voice_result_id: string | null
          voice_weight: number
        }
        Insert: {
          confidence: number
          created_at?: string
          drawing_probability?: number | null
          drawing_result_id?: string | null
          drawing_weight?: number
          id?: string
          is_demo?: boolean
          overall_probability: number
          risk_category?: string
          screening_session_id?: string | null
          updated_at?: string
          user_id: string
          voice_probability?: number | null
          voice_result_id?: string | null
          voice_weight?: number
        }
        Update: {
          confidence?: number
          created_at?: string
          drawing_probability?: number | null
          drawing_result_id?: string | null
          drawing_weight?: number
          id?: string
          is_demo?: boolean
          overall_probability?: number
          risk_category?: string
          screening_session_id?: string | null
          updated_at?: string
          user_id?: string
          voice_probability?: number | null
          voice_result_id?: string | null
          voice_weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "fusion_results_drawing_result_id_fkey"
            columns: ["drawing_result_id"]
            isOneToOne: false
            referencedRelation: "drawing_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fusion_results_screening_session_id_fkey"
            columns: ["screening_session_id"]
            isOneToOne: false
            referencedRelation: "screening_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fusion_results_voice_result_id_fkey"
            columns: ["voice_result_id"]
            isOneToOne: false
            referencedRelation: "voice_results"
            referencedColumns: ["id"]
          },
        ]
      }
      model_versions: {
        Row: {
          activated_at: string | null
          created_at: string
          created_by: string | null
          dataset_version_id: string | null
          id: string
          metrics: Json | null
          modality: string
          status: string
          training_job_id: string | null
          version: number
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          created_by?: string | null
          dataset_version_id?: string | null
          id?: string
          metrics?: Json | null
          modality: string
          status?: string
          training_job_id?: string | null
          version: number
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          created_by?: string | null
          dataset_version_id?: string | null
          id?: string
          metrics?: Json | null
          modality?: string
          status?: string
          training_job_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "model_versions_dataset_version_id_fkey"
            columns: ["dataset_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_versions_training_job_id_fkey"
            columns: ["training_job_id"]
            isOneToOne: false
            referencedRelation: "training_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          data_sharing_enabled: boolean
          email: string | null
          full_name: string | null
          id: string
          notifications_enabled: boolean
          onboarding_completed: boolean
          reminder_time: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          data_sharing_enabled?: boolean
          email?: string | null
          full_name?: string | null
          id: string
          notifications_enabled?: boolean
          onboarding_completed?: boolean
          reminder_time?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          data_sharing_enabled?: boolean
          email?: string | null
          full_name?: string | null
          id?: string
          notifications_enabled?: boolean
          onboarding_completed?: boolean
          reminder_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      screening_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_demo: boolean
          notes: string | null
          session_type: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          session_type?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          notes?: string | null
          session_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      training_jobs: {
        Row: {
          architecture: string
          augmentation: boolean
          batch_size: number
          class_balancing: string
          created_at: string
          created_by: string | null
          curves: Json | null
          dataset_version_id: string | null
          epochs: number
          error_message: string | null
          external_job_id: string | null
          id: string
          metrics: Json | null
          modality: string
          status: string
          test_split: number
          train_split: number
          updated_at: string
          val_split: number
        }
        Insert: {
          architecture: string
          augmentation?: boolean
          batch_size?: number
          class_balancing?: string
          created_at?: string
          created_by?: string | null
          curves?: Json | null
          dataset_version_id?: string | null
          epochs?: number
          error_message?: string | null
          external_job_id?: string | null
          id?: string
          metrics?: Json | null
          modality: string
          status?: string
          test_split?: number
          train_split?: number
          updated_at?: string
          val_split?: number
        }
        Update: {
          architecture?: string
          augmentation?: boolean
          batch_size?: number
          class_balancing?: string
          created_at?: string
          created_by?: string | null
          curves?: Json | null
          dataset_version_id?: string | null
          epochs?: number
          error_message?: string | null
          external_job_id?: string | null
          id?: string
          metrics?: Json | null
          modality?: string
          status?: string
          test_split?: number
          train_split?: number
          updated_at?: string
          val_split?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_jobs_dataset_version_id_fkey"
            columns: ["dataset_version_id"]
            isOneToOne: false
            referencedRelation: "dataset_versions"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      voice_results: {
        Row: {
          confidence: number
          created_at: string
          id: string
          is_demo: boolean
          model_version: string | null
          probability: number
          user_id: string
          voice_session_id: string
        }
        Insert: {
          confidence: number
          created_at?: string
          id?: string
          is_demo?: boolean
          model_version?: string | null
          probability: number
          user_id: string
          voice_session_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          is_demo?: boolean
          model_version?: string | null
          probability?: number
          user_id?: string
          voice_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_results_voice_session_id_fkey"
            columns: ["voice_session_id"]
            isOneToOne: false
            referencedRelation: "voice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_sessions: {
        Row: {
          amplitude_rms: number | null
          audio_path: string | null
          created_at: string
          duration_ms: number
          id: string
          sample_rate: number | null
          screening_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amplitude_rms?: number | null
          audio_path?: string | null
          created_at?: string
          duration_ms?: number
          id?: string
          sample_rate?: number | null
          screening_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amplitude_rms?: number | null
          audio_path?: string | null
          created_at?: string
          duration_ms?: number
          id?: string
          sample_rate?: number | null
          screening_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_sessions_screening_session_id_fkey"
            columns: ["screening_session_id"]
            isOneToOne: false
            referencedRelation: "screening_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
