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
      audit_events: {
        Row: {
          action_type: string
          actor_user_id: string
          after_value: Json | null
          before_value: Json | null
          case_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          tenant_id: string
        }
        Insert: {
          action_type: string
          actor_user_id: string
          after_value?: Json | null
          before_value?: Json | null
          case_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          tenant_id: string
        }
        Update: {
          action_type?: string
          actor_user_id?: string
          after_value?: Json | null
          before_value?: Json | null
          case_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          adjusted_amount: number | null
          bill_date: string | null
          bill_status: Database["public"]["Enums"]["bill_status"]
          billed_amount: number
          case_id: string
          cpt_codes: string[]
          created_at: string
          description: string
          document_id: string | null
          id: string
          paid_amount: number | null
          provider_party_id: string | null
          tenant_id: string
          treatment_id: string | null
          updated_at: string
        }
        Insert: {
          adjusted_amount?: number | null
          bill_date?: string | null
          bill_status?: Database["public"]["Enums"]["bill_status"]
          billed_amount?: number
          case_id: string
          cpt_codes?: string[]
          created_at?: string
          description?: string
          document_id?: string | null
          id?: string
          paid_amount?: number | null
          provider_party_id?: string | null
          tenant_id: string
          treatment_id?: string | null
          updated_at?: string
        }
        Update: {
          adjusted_amount?: number | null
          bill_date?: string | null
          bill_status?: Database["public"]["Enums"]["bill_status"]
          billed_amount?: number
          case_id?: string
          cpt_codes?: string[]
          created_at?: string
          description?: string
          document_id?: string | null
          id?: string
          paid_amount?: number | null
          provider_party_id?: string | null
          tenant_id?: string
          treatment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_provider_party_id_fkey"
            columns: ["provider_party_id"]
            isOneToOne: false
            referencedRelation: "case_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "treatment_records"
            referencedColumns: ["id"]
          },
        ]
      }
      case_documents: {
        Row: {
          case_id: string
          created_at: string
          document_status: Database["public"]["Enums"]["document_status"]
          document_type: Database["public"]["Enums"]["document_type"]
          extracted_at: string | null
          extracted_text: string | null
          file_hash: string | null
          file_name: string
          file_size_bytes: number
          file_type: string
          id: string
          intake_status: Database["public"]["Enums"]["intake_status"]
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
          file_hash?: string | null
          file_name: string
          file_size_bytes?: number
          file_type?: string
          id?: string
          intake_status?: Database["public"]["Enums"]["intake_status"]
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
          file_hash?: string | null
          file_name?: string
          file_size_bytes?: number
          file_type?: string
          id?: string
          intake_status?: Database["public"]["Enums"]["intake_status"]
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
      case_parties: {
        Row: {
          address: string
          case_id: string
          contact_email: string
          contact_phone: string
          created_at: string
          full_name: string
          id: string
          notes: string
          organization: string
          party_role: Database["public"]["Enums"]["party_role"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string
          case_id: string
          contact_email?: string
          contact_phone?: string
          created_at?: string
          full_name?: string
          id?: string
          notes?: string
          organization?: string
          party_role: Database["public"]["Enums"]["party_role"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          case_id?: string
          contact_email?: string
          contact_phone?: string
          created_at?: string
          full_name?: string
          id?: string
          notes?: string
          organization?: string
          party_role?: Database["public"]["Enums"]["party_role"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_parties_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_parties_tenant_id_fkey"
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
      document_pages: {
        Row: {
          case_id: string
          confidence_score: number | null
          created_at: string
          document_id: string
          extracted_text: string | null
          height_px: number | null
          id: string
          image_storage_path: string | null
          page_number: number
          tenant_id: string
          width_px: number | null
        }
        Insert: {
          case_id: string
          confidence_score?: number | null
          created_at?: string
          document_id: string
          extracted_text?: string | null
          height_px?: number | null
          id?: string
          image_storage_path?: string | null
          page_number: number
          tenant_id: string
          width_px?: number | null
        }
        Update: {
          case_id?: string
          confidence_score?: number | null
          created_at?: string
          document_id?: string
          extracted_text?: string | null
          height_px?: number | null
          id?: string
          image_storage_path?: string | null
          page_number?: number
          tenant_id?: string
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_pages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_pages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_document_flags: {
        Row: {
          case_id: string
          created_at: string
          document_id: string
          duplicate_of_document_id: string
          flag_status: Database["public"]["Enums"]["duplicate_flag_status"]
          flagged_at: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          similarity_score: number
          tenant_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          document_id: string
          duplicate_of_document_id: string
          flag_status?: Database["public"]["Enums"]["duplicate_flag_status"]
          flagged_at?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          similarity_score?: number
          tenant_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          document_id?: string
          duplicate_of_document_id?: string
          flag_status?: Database["public"]["Enums"]["duplicate_flag_status"]
          flagged_at?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          similarity_score?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_document_flags_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_document_flags_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_document_flags_duplicate_of_document_id_fkey"
            columns: ["duplicate_of_document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_document_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      extracted_facts: {
        Row: {
          case_id: string
          confidence_score: number | null
          created_at: string
          document_id: string
          fact_text: string
          fact_type: Database["public"]["Enums"]["fact_type"]
          id: string
          needs_review: boolean
          page_id: string | null
          page_number: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_anchor: string | null
          source_snippet: string
          structured_data: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          case_id: string
          confidence_score?: number | null
          created_at?: string
          document_id: string
          fact_text?: string
          fact_type?: Database["public"]["Enums"]["fact_type"]
          id?: string
          needs_review?: boolean
          page_id?: string | null
          page_number?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_anchor?: string | null
          source_snippet?: string
          structured_data?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          confidence_score?: number | null
          created_at?: string
          document_id?: string
          fact_text?: string
          fact_type?: Database["public"]["Enums"]["fact_type"]
          id?: string
          needs_review?: boolean
          page_id?: string | null
          page_number?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_anchor?: string | null
          source_snippet?: string
          structured_data?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extracted_facts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_facts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_facts_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "document_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_facts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fact_evidence_links: {
        Row: {
          case_id: string
          created_at: string
          fact_id: string
          id: string
          linked_entity_id: string
          linked_entity_type: string
          notes: string
          relevance_type: string
          tenant_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          fact_id: string
          id?: string
          linked_entity_id: string
          linked_entity_type: string
          notes?: string
          relevance_type?: string
          tenant_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          fact_id?: string
          id?: string
          linked_entity_id?: string
          linked_entity_type?: string
          notes?: string
          relevance_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_evidence_links_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_evidence_links_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "extracted_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fact_evidence_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_artifacts: {
        Row: {
          artifact_type: Database["public"]["Enums"]["artifact_type"]
          case_id: string
          content_json: Json
          created_at: string
          created_by: string | null
          id: string
          module_id: string
          storage_path: string | null
          tenant_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          artifact_type: Database["public"]["Enums"]["artifact_type"]
          case_id: string
          content_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          module_id?: string
          storage_path?: string | null
          tenant_id: string
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          artifact_type?: Database["public"]["Enums"]["artifact_type"]
          case_id?: string
          content_json?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          module_id?: string
          storage_path?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "generated_artifacts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_artifacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      injuries: {
        Row: {
          body_part: string
          case_id: string
          created_at: string
          date_of_onset: string | null
          diagnosis_code: string
          diagnosis_description: string
          id: string
          is_pre_existing: boolean
          notes: string
          party_id: string | null
          severity: Database["public"]["Enums"]["injury_severity"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body_part?: string
          case_id: string
          created_at?: string
          date_of_onset?: string | null
          diagnosis_code?: string
          diagnosis_description?: string
          id?: string
          is_pre_existing?: boolean
          notes?: string
          party_id?: string | null
          severity?: Database["public"]["Enums"]["injury_severity"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body_part?: string
          case_id?: string
          created_at?: string
          date_of_onset?: string | null
          diagnosis_code?: string
          diagnosis_description?: string
          id?: string
          is_pre_existing?: boolean
          notes?: string
          party_id?: string | null
          severity?: Database["public"]["Enums"]["injury_severity"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "injuries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injuries_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "case_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injuries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_policies: {
        Row: {
          carrier_name: string
          case_id: string
          coverage_limit: number | null
          created_at: string
          deductible: number | null
          effective_date: string | null
          expiration_date: string | null
          id: string
          notes: string
          policy_number: string
          policy_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          carrier_name?: string
          case_id: string
          coverage_limit?: number | null
          created_at?: string
          deductible?: number | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          notes?: string
          policy_number?: string
          policy_type?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          carrier_name?: string
          case_id?: string
          coverage_limit?: number | null
          created_at?: string
          deductible?: number | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          notes?: string
          policy_number?: string
          policy_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_policies_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_jobs: {
        Row: {
          case_id: string
          completed_at: string | null
          created_at: string
          document_id: string | null
          error_message: string | null
          id: string
          job_type: Database["public"]["Enums"]["intake_job_type"]
          max_retries: number
          metadata: Json
          retry_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["intake_job_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          error_message?: string | null
          id?: string
          job_type: Database["public"]["Enums"]["intake_job_type"]
          max_retries?: number
          metadata?: Json
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["intake_job_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          error_message?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["intake_job_type"]
          max_retries?: number
          metadata?: Json
          retry_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["intake_job_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_jobs_tenant_id_fkey"
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
      liability_facts: {
        Row: {
          case_id: string
          confidence_score: number | null
          created_at: string
          fact_text: string
          id: string
          notes: string
          source_document_id: string | null
          source_page: number | null
          supports_liability: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          case_id: string
          confidence_score?: number | null
          created_at?: string
          fact_text?: string
          id?: string
          notes?: string
          source_document_id?: string | null
          source_page?: number | null
          supports_liability?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          confidence_score?: number | null
          created_at?: string
          fact_text?: string
          id?: string
          notes?: string
          source_document_id?: string | null
          source_page?: number | null
          supports_liability?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "liability_facts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liability_facts_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liability_facts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      module_completion_snapshots: {
        Row: {
          case_id: string
          completion_id: string
          created_at: string
          created_by: string | null
          id: string
          module_id: string
          snapshot_json: Json
          tenant_id: string
          version: number
        }
        Insert: {
          case_id: string
          completion_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          module_id: string
          snapshot_json?: Json
          tenant_id: string
          version?: number
        }
        Update: {
          case_id?: string
          completion_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          module_id?: string
          snapshot_json?: Json
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "module_completion_snapshots_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_completion_snapshots_completion_id_fkey"
            columns: ["completion_id"]
            isOneToOne: false
            referencedRelation: "module_completions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_completion_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      module_completions: {
        Row: {
          case_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          module_id: string
          reopened_at: string | null
          reopened_by: string | null
          status: Database["public"]["Enums"]["module_completion_status"]
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          module_id: string
          reopened_at?: string | null
          reopened_by?: string | null
          status?: Database["public"]["Enums"]["module_completion_status"]
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          module_id?: string
          reopened_at?: string | null
          reopened_by?: string | null
          status?: Database["public"]["Enums"]["module_completion_status"]
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "module_completions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_completions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      module_dependencies: {
        Row: {
          created_at: string
          downstream_module_id: string
          id: string
          upstream_module_id: string
        }
        Insert: {
          created_at?: string
          downstream_module_id: string
          id?: string
          upstream_module_id: string
        }
        Update: {
          created_at?: string
          downstream_module_id?: string
          id?: string
          upstream_module_id?: string
        }
        Relationships: []
      }
      module_dependency_state: {
        Row: {
          case_id: string
          created_at: string
          dependency_status: Database["public"]["Enums"]["dependency_status"]
          downstream_module_id: string
          id: string
          last_synced_at: string | null
          stale_since: string | null
          tenant_id: string
          updated_at: string
          upstream_module_id: string
          upstream_snapshot_id: string | null
          upstream_snapshot_version: number | null
        }
        Insert: {
          case_id: string
          created_at?: string
          dependency_status?: Database["public"]["Enums"]["dependency_status"]
          downstream_module_id: string
          id?: string
          last_synced_at?: string | null
          stale_since?: string | null
          tenant_id: string
          updated_at?: string
          upstream_module_id: string
          upstream_snapshot_id?: string | null
          upstream_snapshot_version?: number | null
        }
        Update: {
          case_id?: string
          created_at?: string
          dependency_status?: Database["public"]["Enums"]["dependency_status"]
          downstream_module_id?: string
          id?: string
          last_synced_at?: string | null
          stale_since?: string | null
          tenant_id?: string
          updated_at?: string
          upstream_module_id?: string
          upstream_snapshot_id?: string | null
          upstream_snapshot_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "module_dependency_state_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_dependency_state_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_dependency_state_upstream_snapshot_id_fkey"
            columns: ["upstream_snapshot_id"]
            isOneToOne: false
            referencedRelation: "module_completion_snapshots"
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
      tenant_module_entitlements: {
        Row: {
          created_at: string
          enabled_at: string | null
          enabled_by: string | null
          id: string
          module_id: string
          notes: string
          status: Database["public"]["Enums"]["module_entitlement_status"]
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled_at?: string | null
          enabled_by?: string | null
          id?: string
          module_id: string
          notes?: string
          status?: Database["public"]["Enums"]["module_entitlement_status"]
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled_at?: string | null
          enabled_by?: string | null
          id?: string
          module_id?: string
          notes?: string
          status?: Database["public"]["Enums"]["module_entitlement_status"]
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_module_entitlements_tenant_id_fkey"
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
      treatment_records: {
        Row: {
          case_id: string
          created_at: string
          description: string
          document_id: string | null
          facility_name: string
          id: string
          injury_id: string | null
          procedure_codes: string[]
          provider_name: string
          provider_party_id: string | null
          source_page: number | null
          tenant_id: string
          treatment_date: string | null
          treatment_end_date: string | null
          treatment_type: Database["public"]["Enums"]["treatment_type"]
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          description?: string
          document_id?: string | null
          facility_name?: string
          id?: string
          injury_id?: string | null
          procedure_codes?: string[]
          provider_name?: string
          provider_party_id?: string | null
          source_page?: number | null
          tenant_id: string
          treatment_date?: string | null
          treatment_end_date?: string | null
          treatment_type?: Database["public"]["Enums"]["treatment_type"]
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          description?: string
          document_id?: string | null
          facility_name?: string
          id?: string
          injury_id?: string | null
          procedure_codes?: string[]
          provider_name?: string
          provider_party_id?: string | null
          source_page?: number | null
          tenant_id?: string
          treatment_date?: string | null
          treatment_end_date?: string | null
          treatment_type?: Database["public"]["Enums"]["treatment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_records_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_records_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_records_injury_id_fkey"
            columns: ["injury_id"]
            isOneToOne: false
            referencedRelation: "injuries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_records_provider_party_id_fkey"
            columns: ["provider_party_id"]
            isOneToOne: false
            referencedRelation: "case_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      artifact_type:
        | "demand_package"
        | "chronology_report"
        | "medical_summary"
        | "valuation_report"
        | "settlement_memo"
        | "negotiation_letter"
        | "litigation_brief"
      bill_status:
        | "submitted"
        | "under_review"
        | "approved"
        | "reduced"
        | "denied"
        | "paid"
        | "appealed"
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
      dependency_status:
        | "current"
        | "stale_due_to_upstream_change"
        | "refresh_needed"
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
      duplicate_flag_status: "flagged" | "dismissed" | "confirmed"
      fact_type:
        | "medical_diagnosis"
        | "treatment"
        | "medication"
        | "date_of_event"
        | "injury_description"
        | "provider_info"
        | "billing_amount"
        | "liability_statement"
        | "witness_statement"
        | "policy_detail"
        | "employment_info"
        | "other"
      injury_severity:
        | "minor"
        | "moderate"
        | "severe"
        | "catastrophic"
        | "fatal"
      intake_job_status:
        | "queued"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      intake_job_type:
        | "text_extraction"
        | "document_parsing"
        | "fact_extraction"
        | "duplicate_detection"
      intake_status:
        | "uploaded"
        | "queued_for_text_extraction"
        | "extracting_text"
        | "text_extracted"
        | "queued_for_parsing"
        | "parsing"
        | "parsed"
        | "needs_review"
        | "failed"
      job_status: "queued" | "running" | "completed" | "failed"
      job_type:
        | "document_extraction"
        | "chronology_generation"
        | "issue_flagging"
        | "package_export"
        | "ocr"
        | "classification"
      module_completion_status:
        | "not_started"
        | "in_progress"
        | "completed"
        | "reopened"
      module_entitlement_status: "enabled" | "disabled" | "trial" | "suspended"
      party_role:
        | "claimant"
        | "insured"
        | "defendant"
        | "witness"
        | "employer"
        | "provider"
        | "expert"
        | "attorney"
        | "adjuster"
      pipeline_stage:
        | "upload_received"
        | "ocr_queued"
        | "ocr_complete"
        | "document_classified"
        | "extraction_complete"
        | "evidence_links_created"
        | "review_items_generated"
      treatment_type:
        | "emergency"
        | "inpatient"
        | "outpatient"
        | "surgery"
        | "physical_therapy"
        | "chiropractic"
        | "diagnostic_imaging"
        | "prescription"
        | "dme"
        | "mental_health"
        | "other"
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
      artifact_type: [
        "demand_package",
        "chronology_report",
        "medical_summary",
        "valuation_report",
        "settlement_memo",
        "negotiation_letter",
        "litigation_brief",
      ],
      bill_status: [
        "submitted",
        "under_review",
        "approved",
        "reduced",
        "denied",
        "paid",
        "appealed",
      ],
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
      dependency_status: [
        "current",
        "stale_due_to_upstream_change",
        "refresh_needed",
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
      duplicate_flag_status: ["flagged", "dismissed", "confirmed"],
      fact_type: [
        "medical_diagnosis",
        "treatment",
        "medication",
        "date_of_event",
        "injury_description",
        "provider_info",
        "billing_amount",
        "liability_statement",
        "witness_statement",
        "policy_detail",
        "employment_info",
        "other",
      ],
      injury_severity: ["minor", "moderate", "severe", "catastrophic", "fatal"],
      intake_job_status: [
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      intake_job_type: [
        "text_extraction",
        "document_parsing",
        "fact_extraction",
        "duplicate_detection",
      ],
      intake_status: [
        "uploaded",
        "queued_for_text_extraction",
        "extracting_text",
        "text_extracted",
        "queued_for_parsing",
        "parsing",
        "parsed",
        "needs_review",
        "failed",
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
      module_completion_status: [
        "not_started",
        "in_progress",
        "completed",
        "reopened",
      ],
      module_entitlement_status: ["enabled", "disabled", "trial", "suspended"],
      party_role: [
        "claimant",
        "insured",
        "defendant",
        "witness",
        "employer",
        "provider",
        "expert",
        "attorney",
        "adjuster",
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
      treatment_type: [
        "emergency",
        "inpatient",
        "outpatient",
        "surgery",
        "physical_therapy",
        "chiropractic",
        "diagnostic_imaging",
        "prescription",
        "dme",
        "mental_health",
        "other",
      ],
    },
  },
} as const
