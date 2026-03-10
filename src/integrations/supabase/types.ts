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
      case_documents: {
        Row: {
          case_id: string
          created_at: string
          document_status: Database["public"]["Enums"]["document_status"]
          document_type: Database["public"]["Enums"]["document_type"]
          extracted_at: string | null
          extracted_text: string | null
          file_name: string
          file_size_bytes: number
          file_type: string
          id: string
          page_count: number | null
          pipeline_stage: Database["public"]["Enums"]["pipeline_stage"]
          storage_path: string | null
          tenant_id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          case_id: string
          created_at?: string
          document_status?: Database["public"]["Enums"]["document_status"]
          document_type?: Database["public"]["Enums"]["document_type"]
          extracted_at?: string | null
          extracted_text?: string | null
          file_name: string
          file_size_bytes?: number
          file_type?: string
          id?: string
          page_count?: number | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          storage_path?: string | null
          tenant_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          case_id?: string
          created_at?: string
          document_status?: Database["public"]["Enums"]["document_status"]
          document_type?: Database["public"]["Enums"]["document_type"]
          extracted_at?: string | null
          extracted_text?: string | null
          file_name?: string
          file_size_bytes?: number
          file_type?: string
          id?: string
          page_count?: number | null
          pipeline_stage?: Database["public"]["Enums"]["pipeline_stage"]
          storage_path?: string | null
          tenant_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          assigned_to: string | null
          case_number: string
          case_status: Database["public"]["Enums"]["case_status"]
          claim_number: string
          claimant: string
          created_at: string
          created_by: string
          date_of_loss: string | null
          defendant: string
          external_reference: string
          id: string
          insured: string
          jurisdiction_state: string
          priority: Database["public"]["Enums"]["case_priority"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          case_number?: string
          case_status?: Database["public"]["Enums"]["case_status"]
          claim_number?: string
          claimant?: string
          created_at?: string
          created_by: string
          date_of_loss?: string | null
          defendant?: string
          external_reference?: string
          id?: string
          insured?: string
          jurisdiction_state?: string
          priority?: Database["public"]["Enums"]["case_priority"]
          tenant_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          case_number?: string
          case_status?: Database["public"]["Enums"]["case_status"]
          claim_number?: string
          claimant?: string
          created_at?: string
          created_by?: string
          date_of_loss?: string | null
          defendant?: string
          external_reference?: string
          id?: string
          insured?: string
          jurisdiction_state?: string
          priority?: Database["public"]["Enums"]["case_priority"]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          case_id: string
          completed_at: string | null
          created_at: string
          document_id: string | null
          error_message: string | null
          id: string
          job_status: Database["public"]["Enums"]["job_status"]
          job_type: Database["public"]["Enums"]["job_type"]
          max_retries: number
          retry_count: number
          started_at: string | null
          tenant_id: string
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          error_message?: string | null
          id?: string
          job_status?: Database["public"]["Enums"]["job_status"]
          job_type: Database["public"]["Enums"]["job_type"]
          max_retries?: number
          retry_count?: number
          started_at?: string | null
          tenant_id: string
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          error_message?: string | null
          id?: string
          job_status?: Database["public"]["Enums"]["job_status"]
          job_type?: Database["public"]["Enums"]["job_type"]
          max_retries?: number
          retry_count?: number
          started_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email: string
          id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_user_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: undefined
      }
      complete_signup: {
        Args: { _display_name?: string; _org_code?: string; _org_name?: string }
        Returns: Json
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "reviewer" | "adjuster" | "readonly"
      case_priority: "low" | "normal" | "high" | "urgent"
      case_status:
        | "draft"
        | "intake_in_progress"
        | "intake_complete"
        | "processing_in_progress"
        | "complete"
        | "exported"
        | "closed"
        | "failed"
      document_status:
        | "uploaded"
        | "queued"
        | "ocr_in_progress"
        | "classified"
        | "extracted"
        | "needs_attention"
        | "complete"
        | "failed"
      document_type:
        | "medical_record"
        | "police_report"
        | "legal_filing"
        | "correspondence"
        | "billing_record"
        | "imaging_report"
        | "insurance_document"
        | "employment_record"
        | "expert_report"
        | "photograph"
        | "other"
      job_status: "queued" | "running" | "completed" | "failed"
      job_type:
        | "document_extraction"
        | "chronology_generation"
        | "issue_flagging"
        | "package_export"
        | "ocr"
        | "classification"
      pipeline_stage:
        | "upload_received"
        | "ocr_queued"
        | "ocr_complete"
        | "document_classified"
        | "extraction_complete"
        | "evidence_links_created"
        | "review_items_generated"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "manager", "reviewer", "adjuster", "readonly"],
      case_priority: ["low", "normal", "high", "urgent"],
      case_status: [
        "draft",
        "intake_in_progress",
        "intake_complete",
        "processing_in_progress",
        "complete",
        "exported",
        "closed",
        "failed",
      ],
      document_status: [
        "uploaded",
        "queued",
        "ocr_in_progress",
        "classified",
        "extracted",
        "needs_attention",
        "complete",
        "failed",
      ],
      document_type: [
        "medical_record",
        "police_report",
        "legal_filing",
        "correspondence",
        "billing_record",
        "imaging_report",
        "insurance_document",
        "employment_record",
        "expert_report",
        "photograph",
        "other",
      ],
      job_status: ["queued", "running", "completed", "failed"],
      job_type: [
        "document_extraction",
        "chronology_generation",
        "issue_flagging",
        "package_export",
        "ocr",
        "classification",
      ],
      pipeline_stage: [
        "upload_received",
        "ocr_queued",
        "ocr_complete",
        "document_classified",
        "extraction_complete",
        "evidence_links_created",
        "review_items_generated",
      ],
    },
  },
} as const
