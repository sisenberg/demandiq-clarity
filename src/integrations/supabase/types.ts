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
      calibration_configs: {
        Row: {
          change_reason: string
          change_summary: string
          changed_by: string
          clinical_adjustments: Json
          confidence_rules: Json
          created_at: string
          id: string
          is_active: boolean
          reliability_reductions: Json
          rounding_rules: Json
          severity_multipliers: Json
          tenant_id: string
          venue_multipliers: Json
          version: number
        }
        Insert: {
          change_reason?: string
          change_summary?: string
          changed_by: string
          clinical_adjustments?: Json
          confidence_rules?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          reliability_reductions?: Json
          rounding_rules?: Json
          severity_multipliers?: Json
          tenant_id: string
          venue_multipliers?: Json
          version?: number
        }
        Update: {
          change_reason?: string
          change_summary?: string
          changed_by?: string
          clinical_adjustments?: Json
          confidence_rules?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          reliability_reductions?: Json
          rounding_rules?: Json
          severity_multipliers?: Json
          tenant_id?: string
          venue_multipliers?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "calibration_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      calibration_imports: {
        Row: {
          completed_at: string | null
          created_at: string
          error_count: number
          error_log: Json
          file_name: string
          id: string
          import_type: string
          imported_by: string
          record_count: number
          status: string
          success_count: number
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_count?: number
          error_log?: Json
          file_name?: string
          id?: string
          import_type?: string
          imported_by: string
          record_count?: number
          status?: string
          success_count?: number
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_count?: number
          error_log?: Json
          file_name?: string
          id?: string
          import_type?: string
          imported_by?: string
          record_count?: number
          status?: string
          success_count?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calibration_imports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      chronology_event_candidates: {
        Row: {
          case_id: string
          category: Database["public"]["Enums"]["chronology_event_category"]
          confidence: number | null
          created_at: string
          description: string
          event_date: string
          event_date_end: string | null
          id: string
          label: string
          machine_category: string | null
          machine_date: string | null
          machine_description: string | null
          machine_label: string | null
          merged_into_id: string | null
          source_document_id: string | null
          source_page: number | null
          source_type: string
          status: Database["public"]["Enums"]["chronology_candidate_status"]
          tenant_id: string
          updated_at: string
          user_corrected_category: string | null
          user_corrected_date: string | null
          user_corrected_description: string | null
          user_corrected_label: string | null
        }
        Insert: {
          case_id: string
          category?: Database["public"]["Enums"]["chronology_event_category"]
          confidence?: number | null
          created_at?: string
          description?: string
          event_date?: string
          event_date_end?: string | null
          id?: string
          label?: string
          machine_category?: string | null
          machine_date?: string | null
          machine_description?: string | null
          machine_label?: string | null
          merged_into_id?: string | null
          source_document_id?: string | null
          source_page?: number | null
          source_type?: string
          status?: Database["public"]["Enums"]["chronology_candidate_status"]
          tenant_id: string
          updated_at?: string
          user_corrected_category?: string | null
          user_corrected_date?: string | null
          user_corrected_description?: string | null
          user_corrected_label?: string | null
        }
        Update: {
          case_id?: string
          category?: Database["public"]["Enums"]["chronology_event_category"]
          confidence?: number | null
          created_at?: string
          description?: string
          event_date?: string
          event_date_end?: string | null
          id?: string
          label?: string
          machine_category?: string | null
          machine_date?: string | null
          machine_description?: string | null
          machine_label?: string | null
          merged_into_id?: string | null
          source_document_id?: string | null
          source_page?: number | null
          source_type?: string
          status?: Database["public"]["Enums"]["chronology_candidate_status"]
          tenant_id?: string
          updated_at?: string
          user_corrected_category?: string | null
          user_corrected_date?: string | null
          user_corrected_description?: string | null
          user_corrected_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chronology_event_candidates_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chronology_event_candidates_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "chronology_event_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chronology_event_candidates_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chronology_event_candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chronology_evidence_links: {
        Row: {
          candidate_id: string
          case_id: string
          confidence: number | null
          created_at: string
          document_id: string
          id: string
          page_number: number | null
          quoted_text: string
          relevance_type: string
          tenant_id: string
        }
        Insert: {
          candidate_id: string
          case_id: string
          confidence?: number | null
          created_at?: string
          document_id: string
          id?: string
          page_number?: number | null
          quoted_text?: string
          relevance_type?: string
          tenant_id: string
        }
        Update: {
          candidate_id?: string
          case_id?: string
          confidence?: number | null
          created_at?: string
          document_id?: string
          id?: string
          page_number?: number | null
          quoted_text?: string
          relevance_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chronology_evidence_links_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "chronology_event_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chronology_evidence_links_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chronology_evidence_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chronology_evidence_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_metadata_extractions: {
        Row: {
          case_id: string
          confidence: number | null
          created_at: string
          document_id: string
          extracted_value: string
          field_type: string
          id: string
          is_accepted: boolean
          source_page: number | null
          source_snippet: string
          tenant_id: string
          user_corrected_value: string | null
        }
        Insert: {
          case_id: string
          confidence?: number | null
          created_at?: string
          document_id: string
          extracted_value: string
          field_type: string
          id?: string
          is_accepted?: boolean
          source_page?: number | null
          source_snippet?: string
          tenant_id: string
          user_corrected_value?: string | null
        }
        Update: {
          case_id?: string
          confidence?: number | null
          created_at?: string
          document_id?: string
          extracted_value?: string
          field_type?: string
          id?: string
          is_accepted?: boolean
          source_page?: number | null
          source_snippet?: string
          tenant_id?: string
          user_corrected_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_metadata_extractions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_metadata_extractions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_metadata_extractions_tenant_id_fkey"
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
      document_type_suggestions: {
        Row: {
          case_id: string
          confidence: number | null
          created_at: string
          document_id: string
          id: string
          is_accepted: boolean
          reasoning: string
          source_page: number | null
          source_snippet: string
          suggested_type: string
          tenant_id: string
        }
        Insert: {
          case_id: string
          confidence?: number | null
          created_at?: string
          document_id: string
          id?: string
          is_accepted?: boolean
          reasoning?: string
          source_page?: number | null
          source_snippet?: string
          suggested_type: string
          tenant_id: string
        }
        Update: {
          case_id?: string
          confidence?: number | null
          created_at?: string
          document_id?: string
          id?: string
          is_accepted?: boolean
          reasoning?: string
          source_page?: number | null
          source_snippet?: string
          suggested_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_type_suggestions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_type_suggestions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_type_suggestions_tenant_id_fkey"
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
      entity_cluster_members: {
        Row: {
          cluster_id: string
          created_at: string
          document_id: string | null
          extraction_id: string | null
          id: string
          match_score: number | null
          raw_value: string
          source_page: number | null
          source_snippet: string
          tenant_id: string
        }
        Insert: {
          cluster_id: string
          created_at?: string
          document_id?: string | null
          extraction_id?: string | null
          id?: string
          match_score?: number | null
          raw_value: string
          source_page?: number | null
          source_snippet?: string
          tenant_id: string
        }
        Update: {
          cluster_id?: string
          created_at?: string
          document_id?: string | null
          extraction_id?: string | null
          id?: string
          match_score?: number | null
          raw_value?: string
          source_page?: number | null
          source_snippet?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_cluster_members_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "entity_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_cluster_members_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_cluster_members_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "document_metadata_extractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_cluster_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_clusters: {
        Row: {
          canonical_value: string | null
          case_id: string
          confidence: number | null
          created_at: string
          display_value: string
          entity_type: string
          id: string
          is_primary: boolean
          source_count: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          canonical_value?: string | null
          case_id: string
          confidence?: number | null
          created_at?: string
          display_value?: string
          entity_type: string
          id?: string
          is_primary?: boolean
          source_count?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          canonical_value?: string | null
          case_id?: string
          confidence?: number | null
          created_at?: string
          display_value?: string
          entity_type?: string
          id?: string
          is_primary?: boolean
          source_count?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_clusters_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_clusters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_cases: {
        Row: {
          active_snapshot_id: string | null
          active_valuation_id: string | null
          case_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          module_status: Database["public"]["Enums"]["evaluation_case_status"]
          started_at: string | null
          started_by: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active_snapshot_id?: string | null
          active_valuation_id?: string | null
          case_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          module_status?: Database["public"]["Enums"]["evaluation_case_status"]
          started_at?: string | null
          started_by?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active_snapshot_id?: string | null
          active_valuation_id?: string | null
          case_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          module_status?: Database["public"]["Enums"]["evaluation_case_status"]
          started_at?: string | null
          started_by?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_cases_active_snapshot_id_fkey"
            columns: ["active_snapshot_id"]
            isOneToOne: false
            referencedRelation: "evaluation_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_cases_active_valuation_id_fkey"
            columns: ["active_valuation_id"]
            isOneToOne: false
            referencedRelation: "valuation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_cases_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_cases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_packages: {
        Row: {
          case_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          package_payload: Json
          selection_id: string | null
          snapshot_id: string | null
          tenant_id: string
          valuation_run_id: string | null
          version: number
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          package_payload?: Json
          selection_id?: string | null
          snapshot_id?: string | null
          tenant_id: string
          valuation_run_id?: string | null
          version?: number
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          package_payload?: Json
          selection_id?: string | null
          snapshot_id?: string | null
          tenant_id?: string
          valuation_run_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_packages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_packages_selection_id_fkey"
            columns: ["selection_id"]
            isOneToOne: false
            referencedRelation: "valuation_selections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_packages_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "evaluation_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_packages_valuation_run_id_fkey"
            columns: ["valuation_run_id"]
            isOneToOne: false
            referencedRelation: "valuation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_snapshots: {
        Row: {
          case_id: string
          completeness_score: number | null
          completeness_warnings: Json
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          snapshot_payload: Json
          source_module: string
          source_package_version: number
          source_snapshot_id: string | null
          tenant_id: string
        }
        Insert: {
          case_id: string
          completeness_score?: number | null
          completeness_warnings?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          snapshot_payload?: Json
          source_module: string
          source_package_version?: number
          source_snapshot_id?: string | null
          tenant_id: string
        }
        Update: {
          case_id?: string
          completeness_score?: number | null
          completeness_warnings?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          snapshot_payload?: Json
          source_module?: string
          source_package_version?: number
          source_snapshot_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_snapshots_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_snapshots_tenant_id_fkey"
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
      historical_claims: {
        Row: {
          attorney_firm: string
          attorney_name: string
          billed_specials: number | null
          claim_number: string
          comparative_negligence_pct: number | null
          completeness_score: number
          confidence_flags: Json
          corpus_type: string
          created_at: string
          final_settlement_amount: number | null
          has_hospitalization: boolean
          has_imaging: boolean
          has_injections: boolean
          has_permanency: boolean
          has_surgery: boolean
          id: string
          import_id: string | null
          injury_categories: string[]
          jurisdiction: string
          liability_posture: string
          loss_date: string | null
          outcome_notes: string
          policy_limits: number | null
          policy_type: string
          primary_body_parts: string[]
          provider_names: string[]
          raw_source: Json
          reviewed_specials: number | null
          tenant_id: string
          treatment_duration_days: number | null
          treatment_provider_count: number | null
          updated_at: string
          venue_county: string
          venue_state: string
          wage_loss: number | null
        }
        Insert: {
          attorney_firm?: string
          attorney_name?: string
          billed_specials?: number | null
          claim_number?: string
          comparative_negligence_pct?: number | null
          completeness_score?: number
          confidence_flags?: Json
          corpus_type?: string
          created_at?: string
          final_settlement_amount?: number | null
          has_hospitalization?: boolean
          has_imaging?: boolean
          has_injections?: boolean
          has_permanency?: boolean
          has_surgery?: boolean
          id?: string
          import_id?: string | null
          injury_categories?: string[]
          jurisdiction?: string
          liability_posture?: string
          loss_date?: string | null
          outcome_notes?: string
          policy_limits?: number | null
          policy_type?: string
          primary_body_parts?: string[]
          provider_names?: string[]
          raw_source?: Json
          reviewed_specials?: number | null
          tenant_id: string
          treatment_duration_days?: number | null
          treatment_provider_count?: number | null
          updated_at?: string
          venue_county?: string
          venue_state?: string
          wage_loss?: number | null
        }
        Update: {
          attorney_firm?: string
          attorney_name?: string
          billed_specials?: number | null
          claim_number?: string
          comparative_negligence_pct?: number | null
          completeness_score?: number
          confidence_flags?: Json
          corpus_type?: string
          created_at?: string
          final_settlement_amount?: number | null
          has_hospitalization?: boolean
          has_imaging?: boolean
          has_injections?: boolean
          has_permanency?: boolean
          has_surgery?: boolean
          id?: string
          import_id?: string | null
          injury_categories?: string[]
          jurisdiction?: string
          liability_posture?: string
          loss_date?: string | null
          outcome_notes?: string
          policy_limits?: number | null
          policy_type?: string
          primary_body_parts?: string[]
          provider_names?: string[]
          raw_source?: Json
          reviewed_specials?: number | null
          tenant_id?: string
          treatment_duration_days?: number | null
          treatment_provider_count?: number | null
          updated_at?: string
          venue_county?: string
          venue_state?: string
          wage_loss?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "historical_claims_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "calibration_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historical_claims_tenant_id_fkey"
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
      negotiate_strategies: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          eval_package_id: string
          eval_package_version: number
          generated_strategy: Json
          id: string
          overrides: Json
          tenant_id: string
          version: number
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          eval_package_id: string
          eval_package_version?: number
          generated_strategy?: Json
          id?: string
          overrides?: Json
          tenant_id: string
          version?: number
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          eval_package_id?: string
          eval_package_version?: number
          generated_strategy?: Json
          id?: string
          overrides?: Json
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "negotiate_strategies_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiate_strategies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      phi_readiness_config: {
        Row: {
          ai_retention_confirmed_at: string | null
          ai_retention_confirmed_by: string | null
          ai_retention_notes: string
          ai_retention_terms_finalized: boolean
          baa_confirmed_at: string | null
          baa_confirmed_by: string | null
          baa_executed: boolean
          baa_vendor_list: string
          created_at: string
          environment_designation: Database["public"]["Enums"]["environment_designation"]
          id: string
          last_status_change_at: string
          last_status_change_by: string | null
          logging_masking_confirmed_at: string | null
          logging_masking_confirmed_by: string | null
          logging_masking_hardened: boolean
          overall_status: Database["public"]["Enums"]["phi_readiness_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ai_retention_confirmed_at?: string | null
          ai_retention_confirmed_by?: string | null
          ai_retention_notes?: string
          ai_retention_terms_finalized?: boolean
          baa_confirmed_at?: string | null
          baa_confirmed_by?: string | null
          baa_executed?: boolean
          baa_vendor_list?: string
          created_at?: string
          environment_designation?: Database["public"]["Enums"]["environment_designation"]
          id?: string
          last_status_change_at?: string
          last_status_change_by?: string | null
          logging_masking_confirmed_at?: string | null
          logging_masking_confirmed_by?: string | null
          logging_masking_hardened?: boolean
          overall_status?: Database["public"]["Enums"]["phi_readiness_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ai_retention_confirmed_at?: string | null
          ai_retention_confirmed_by?: string | null
          ai_retention_notes?: string
          ai_retention_terms_finalized?: boolean
          baa_confirmed_at?: string | null
          baa_confirmed_by?: string | null
          baa_executed?: boolean
          baa_vendor_list?: string
          created_at?: string
          environment_designation?: Database["public"]["Enums"]["environment_designation"]
          id?: string
          last_status_change_at?: string
          last_status_change_by?: string | null
          logging_masking_confirmed_at?: string | null
          logging_masking_confirmed_by?: string | null
          logging_masking_hardened?: boolean
          overall_status?: Database["public"]["Enums"]["phi_readiness_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phi_readiness_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
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
      reviewer_bill_links: {
        Row: {
          ai_confidence: number | null
          assessed_reasonable_amount: number | null
          billed_amount: number
          case_id: string
          created_at: string
          id: string
          is_reviewed: boolean
          linkage_status: Database["public"]["Enums"]["bill_linkage_status"]
          reduction_reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          tenant_id: string
          treatment_review_id: string | null
          updated_at: string
          upstream_bill_id: string
          upstream_treatment_id: string | null
        }
        Insert: {
          ai_confidence?: number | null
          assessed_reasonable_amount?: number | null
          billed_amount?: number
          case_id: string
          created_at?: string
          id?: string
          is_reviewed?: boolean
          linkage_status?: Database["public"]["Enums"]["bill_linkage_status"]
          reduction_reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          tenant_id: string
          treatment_review_id?: string | null
          updated_at?: string
          upstream_bill_id: string
          upstream_treatment_id?: string | null
        }
        Update: {
          ai_confidence?: number | null
          assessed_reasonable_amount?: number | null
          billed_amount?: number
          case_id?: string
          created_at?: string
          id?: string
          is_reviewed?: boolean
          linkage_status?: Database["public"]["Enums"]["bill_linkage_status"]
          reduction_reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          tenant_id?: string
          treatment_review_id?: string | null
          updated_at?: string
          upstream_bill_id?: string
          upstream_treatment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_bill_links_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_bill_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_bill_links_treatment_review_id_fkey"
            columns: ["treatment_review_id"]
            isOneToOne: false
            referencedRelation: "reviewer_treatment_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_case_state: {
        Row: {
          bills_reviewed: number
          case_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          open_flags: number
          providers_confirmed: number
          review_status: Database["public"]["Enums"]["reviewer_case_status"]
          started_at: string | null
          started_by: string | null
          tenant_id: string
          total_bills: number
          total_providers: number
          total_treatments: number
          treatments_reviewed: number
          updated_at: string
          upstream_snapshot_id: string | null
          upstream_snapshot_version: number | null
        }
        Insert: {
          bills_reviewed?: number
          case_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          open_flags?: number
          providers_confirmed?: number
          review_status?: Database["public"]["Enums"]["reviewer_case_status"]
          started_at?: string | null
          started_by?: string | null
          tenant_id: string
          total_bills?: number
          total_providers?: number
          total_treatments?: number
          treatments_reviewed?: number
          updated_at?: string
          upstream_snapshot_id?: string | null
          upstream_snapshot_version?: number | null
        }
        Update: {
          bills_reviewed?: number
          case_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          open_flags?: number
          providers_confirmed?: number
          review_status?: Database["public"]["Enums"]["reviewer_case_status"]
          started_at?: string | null
          started_by?: string | null
          tenant_id?: string
          total_bills?: number
          total_providers?: number
          total_treatments?: number
          treatments_reviewed?: number
          updated_at?: string
          upstream_snapshot_id?: string | null
          upstream_snapshot_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_case_state_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_case_state_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_case_state_upstream_snapshot_id_fkey"
            columns: ["upstream_snapshot_id"]
            isOneToOne: false
            referencedRelation: "module_completion_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_extraction_jobs: {
        Row: {
          case_id: string
          completed_at: string | null
          created_at: string
          document_id: string | null
          duplicates_flagged: number
          error_message: string | null
          extraction_model: string
          id: string
          metadata: Json
          records_extracted: number
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          duplicates_flagged?: number
          error_message?: string | null
          extraction_model?: string
          id?: string
          metadata?: Json
          records_extracted?: number
          started_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          duplicates_flagged?: number
          error_message?: string | null
          extraction_model?: string
          id?: string
          metadata?: Json
          records_extracted?: number
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_extraction_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_extraction_jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_extraction_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_medical_flags: {
        Row: {
          case_id: string
          category: Database["public"]["Enums"]["medical_flag_category"]
          created_at: string
          description: string
          flagged_by: string
          id: string
          related_entity_id: string | null
          related_entity_type: string | null
          resolution_notes: string
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["medical_flag_severity"]
          source_document_id: string | null
          source_page: number | null
          source_snippet: string
          status: Database["public"]["Enums"]["medical_flag_status"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          case_id: string
          category?: Database["public"]["Enums"]["medical_flag_category"]
          created_at?: string
          description?: string
          flagged_by?: string
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolution_notes?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["medical_flag_severity"]
          source_document_id?: string | null
          source_page?: number | null
          source_snippet?: string
          status?: Database["public"]["Enums"]["medical_flag_status"]
          tenant_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          category?: Database["public"]["Enums"]["medical_flag_category"]
          created_at?: string
          description?: string
          flagged_by?: string
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolution_notes?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["medical_flag_severity"]
          source_document_id?: string | null
          source_page?: number | null
          source_snippet?: string
          status?: Database["public"]["Enums"]["medical_flag_status"]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_medical_flags_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_medical_flags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_provider_reviews: {
        Row: {
          canonical_name: string | null
          canonical_npi: string | null
          canonical_specialty: string | null
          case_id: string
          created_at: string
          entity_cluster_id: string | null
          id: string
          is_reviewed: boolean
          normalization_status: Database["public"]["Enums"]["provider_normalization_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          tenant_id: string
          updated_at: string
          upstream_provider_id: string
        }
        Insert: {
          canonical_name?: string | null
          canonical_npi?: string | null
          canonical_specialty?: string | null
          case_id: string
          created_at?: string
          entity_cluster_id?: string | null
          id?: string
          is_reviewed?: boolean
          normalization_status?: Database["public"]["Enums"]["provider_normalization_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          tenant_id: string
          updated_at?: string
          upstream_provider_id: string
        }
        Update: {
          canonical_name?: string | null
          canonical_npi?: string | null
          canonical_specialty?: string | null
          case_id?: string
          created_at?: string
          entity_cluster_id?: string | null
          id?: string
          is_reviewed?: boolean
          normalization_status?: Database["public"]["Enums"]["provider_normalization_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          tenant_id?: string
          updated_at?: string
          upstream_provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_provider_reviews_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_provider_reviews_entity_cluster_id_fkey"
            columns: ["entity_cluster_id"]
            isOneToOne: false
            referencedRelation: "entity_clusters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_provider_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_treatment_records: {
        Row: {
          assessment_summary: string
          body_parts: Json
          case_id: string
          confidence_details: Json
          confidence_tier: Database["public"]["Enums"]["extraction_confidence_tier"]
          created_at: string
          diagnoses: Json
          duplicate_of_record_id: string | null
          duplicate_reason: string
          duplicate_similarity: number | null
          extracted_at: string
          extraction_model: string
          extraction_version: string
          facility_name: string
          follow_up_recommendations: string
          id: string
          is_date_ambiguous: boolean
          is_duplicate_suspect: boolean
          medications: Json
          objective_findings: string
          overall_confidence: number | null
          plan_summary: string
          procedures: Json
          provider_name_normalized: string | null
          provider_name_raw: string
          provider_npi: string | null
          provider_specialty: string
          restrictions: Json
          review_state: Database["public"]["Enums"]["extraction_review_state"]
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string
          service_date_end: string | null
          service_date_start: string | null
          source_document_id: string | null
          source_page_end: number | null
          source_page_start: number | null
          source_snippet: string
          subjective_summary: string
          tenant_id: string
          total_billed: number | null
          total_paid: number | null
          updated_at: string
          upstream_bill_ids: string[]
          upstream_injury_ids: string[]
          upstream_provider_id: string | null
          visit_date: string | null
          visit_date_text: string
          visit_type: Database["public"]["Enums"]["reviewer_visit_type"]
        }
        Insert: {
          assessment_summary?: string
          body_parts?: Json
          case_id: string
          confidence_details?: Json
          confidence_tier?: Database["public"]["Enums"]["extraction_confidence_tier"]
          created_at?: string
          diagnoses?: Json
          duplicate_of_record_id?: string | null
          duplicate_reason?: string
          duplicate_similarity?: number | null
          extracted_at?: string
          extraction_model?: string
          extraction_version?: string
          facility_name?: string
          follow_up_recommendations?: string
          id?: string
          is_date_ambiguous?: boolean
          is_duplicate_suspect?: boolean
          medications?: Json
          objective_findings?: string
          overall_confidence?: number | null
          plan_summary?: string
          procedures?: Json
          provider_name_normalized?: string | null
          provider_name_raw?: string
          provider_npi?: string | null
          provider_specialty?: string
          restrictions?: Json
          review_state?: Database["public"]["Enums"]["extraction_review_state"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string
          service_date_end?: string | null
          service_date_start?: string | null
          source_document_id?: string | null
          source_page_end?: number | null
          source_page_start?: number | null
          source_snippet?: string
          subjective_summary?: string
          tenant_id: string
          total_billed?: number | null
          total_paid?: number | null
          updated_at?: string
          upstream_bill_ids?: string[]
          upstream_injury_ids?: string[]
          upstream_provider_id?: string | null
          visit_date?: string | null
          visit_date_text?: string
          visit_type?: Database["public"]["Enums"]["reviewer_visit_type"]
        }
        Update: {
          assessment_summary?: string
          body_parts?: Json
          case_id?: string
          confidence_details?: Json
          confidence_tier?: Database["public"]["Enums"]["extraction_confidence_tier"]
          created_at?: string
          diagnoses?: Json
          duplicate_of_record_id?: string | null
          duplicate_reason?: string
          duplicate_similarity?: number | null
          extracted_at?: string
          extraction_model?: string
          extraction_version?: string
          facility_name?: string
          follow_up_recommendations?: string
          id?: string
          is_date_ambiguous?: boolean
          is_duplicate_suspect?: boolean
          medications?: Json
          objective_findings?: string
          overall_confidence?: number | null
          plan_summary?: string
          procedures?: Json
          provider_name_normalized?: string | null
          provider_name_raw?: string
          provider_npi?: string | null
          provider_specialty?: string
          restrictions?: Json
          review_state?: Database["public"]["Enums"]["extraction_review_state"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string
          service_date_end?: string | null
          service_date_start?: string | null
          source_document_id?: string | null
          source_page_end?: number | null
          source_page_start?: number | null
          source_snippet?: string
          subjective_summary?: string
          tenant_id?: string
          total_billed?: number | null
          total_paid?: number | null
          updated_at?: string
          upstream_bill_ids?: string[]
          upstream_injury_ids?: string[]
          upstream_provider_id?: string | null
          visit_date?: string | null
          visit_date_text?: string
          visit_type?: Database["public"]["Enums"]["reviewer_visit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_treatment_records_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_treatment_records_duplicate_of_record_id_fkey"
            columns: ["duplicate_of_record_id"]
            isOneToOne: false
            referencedRelation: "reviewer_treatment_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_treatment_records_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "case_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_treatment_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_treatment_reviews: {
        Row: {
          accepted_decision: Database["public"]["Enums"]["treatment_review_decision"]
          accepted_reasoning: string
          ai_confidence: number | null
          ai_decision: Database["public"]["Enums"]["treatment_review_decision"]
          ai_reasoning: string
          case_id: string
          created_at: string
          guideline_refs: string[]
          id: string
          is_reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          source_document_id: string | null
          source_page: number | null
          source_snippet: string
          tenant_id: string
          updated_at: string
          upstream_snapshot: Json
          upstream_treatment_id: string
        }
        Insert: {
          accepted_decision?: Database["public"]["Enums"]["treatment_review_decision"]
          accepted_reasoning?: string
          ai_confidence?: number | null
          ai_decision?: Database["public"]["Enums"]["treatment_review_decision"]
          ai_reasoning?: string
          case_id: string
          created_at?: string
          guideline_refs?: string[]
          id?: string
          is_reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_document_id?: string | null
          source_page?: number | null
          source_snippet?: string
          tenant_id: string
          updated_at?: string
          upstream_snapshot?: Json
          upstream_treatment_id: string
        }
        Update: {
          accepted_decision?: Database["public"]["Enums"]["treatment_review_decision"]
          accepted_reasoning?: string
          ai_confidence?: number | null
          ai_decision?: Database["public"]["Enums"]["treatment_review_decision"]
          ai_reasoning?: string
          case_id?: string
          created_at?: string
          guideline_refs?: string[]
          id?: string
          is_reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_document_id?: string | null
          source_page?: number | null
          source_snippet?: string
          tenant_id?: string
          updated_at?: string
          upstream_snapshot?: Json
          upstream_treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_treatment_reviews_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_treatment_reviews_tenant_id_fkey"
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
      valuation_assumptions: {
        Row: {
          adopted_at: string | null
          adopted_by: string | null
          assumption_key: string
          assumption_value: string
          case_id: string
          category: Database["public"]["Enums"]["assumption_category"]
          created_at: string
          id: string
          reason_notes: string
          tenant_id: string
          updated_at: string
          valuation_run_id: string | null
        }
        Insert: {
          adopted_at?: string | null
          adopted_by?: string | null
          assumption_key?: string
          assumption_value?: string
          case_id: string
          category?: Database["public"]["Enums"]["assumption_category"]
          created_at?: string
          id?: string
          reason_notes?: string
          tenant_id: string
          updated_at?: string
          valuation_run_id?: string | null
        }
        Update: {
          adopted_at?: string | null
          adopted_by?: string | null
          assumption_key?: string
          assumption_value?: string
          case_id?: string
          category?: Database["public"]["Enums"]["assumption_category"]
          created_at?: string
          id?: string
          reason_notes?: string
          tenant_id?: string
          updated_at?: string
          valuation_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "valuation_assumptions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_assumptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_assumptions_valuation_run_id_fkey"
            columns: ["valuation_run_id"]
            isOneToOne: false
            referencedRelation: "valuation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_driver_records: {
        Row: {
          case_id: string
          created_at: string
          driver_family: Database["public"]["Enums"]["driver_family"]
          driver_key: string
          evidence_ref_ids: string[]
          id: string
          narrative: string
          normalized_value: number | null
          raw_input_value: string
          score: number | null
          snapshot_id: string | null
          tenant_id: string
          updated_at: string
          valuation_run_id: string | null
          weight: number | null
        }
        Insert: {
          case_id: string
          created_at?: string
          driver_family?: Database["public"]["Enums"]["driver_family"]
          driver_key?: string
          evidence_ref_ids?: string[]
          id?: string
          narrative?: string
          normalized_value?: number | null
          raw_input_value?: string
          score?: number | null
          snapshot_id?: string | null
          tenant_id: string
          updated_at?: string
          valuation_run_id?: string | null
          weight?: number | null
        }
        Update: {
          case_id?: string
          created_at?: string
          driver_family?: Database["public"]["Enums"]["driver_family"]
          driver_key?: string
          evidence_ref_ids?: string[]
          id?: string
          narrative?: string
          normalized_value?: number | null
          raw_input_value?: string
          score?: number | null
          snapshot_id?: string | null
          tenant_id?: string
          updated_at?: string
          valuation_run_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "valuation_driver_records_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_driver_records_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "evaluation_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_driver_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_driver_records_valuation_run_id_fkey"
            columns: ["valuation_run_id"]
            isOneToOne: false
            referencedRelation: "valuation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_runs: {
        Row: {
          case_id: string
          confidence: number | null
          created_at: string
          created_by: string | null
          engine_version: string
          id: string
          inputs_summary: Json
          range_floor: number | null
          range_likely: number | null
          range_stretch: number | null
          run_type: Database["public"]["Enums"]["valuation_run_type"]
          snapshot_id: string | null
          tenant_id: string
          top_assumptions: Json
        }
        Insert: {
          case_id: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          engine_version?: string
          id?: string
          inputs_summary?: Json
          range_floor?: number | null
          range_likely?: number | null
          range_stretch?: number | null
          run_type?: Database["public"]["Enums"]["valuation_run_type"]
          snapshot_id?: string | null
          tenant_id: string
          top_assumptions?: Json
        }
        Update: {
          case_id?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          engine_version?: string
          id?: string
          inputs_summary?: Json
          range_floor?: number | null
          range_likely?: number | null
          range_stretch?: number | null
          run_type?: Database["public"]["Enums"]["valuation_run_type"]
          snapshot_id?: string | null
          tenant_id?: string
          top_assumptions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "valuation_runs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_runs_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "evaluation_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_selections: {
        Row: {
          authority_recommendation: number | null
          case_id: string
          created_at: string
          id: string
          rationale_notes: string
          selected_at: string | null
          selected_by: string | null
          selected_floor: number | null
          selected_likely: number | null
          selected_stretch: number | null
          tenant_id: string
          updated_at: string
          valuation_run_id: string | null
        }
        Insert: {
          authority_recommendation?: number | null
          case_id: string
          created_at?: string
          id?: string
          rationale_notes?: string
          selected_at?: string | null
          selected_by?: string | null
          selected_floor?: number | null
          selected_likely?: number | null
          selected_stretch?: number | null
          tenant_id: string
          updated_at?: string
          valuation_run_id?: string | null
        }
        Update: {
          authority_recommendation?: number | null
          case_id?: string
          created_at?: string
          id?: string
          rationale_notes?: string
          selected_at?: string | null
          selected_by?: string | null
          selected_floor?: number | null
          selected_likely?: number | null
          selected_stretch?: number | null
          tenant_id?: string
          updated_at?: string
          valuation_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "valuation_selections_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_selections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_selections_valuation_run_id_fkey"
            columns: ["valuation_run_id"]
            isOneToOne: false
            referencedRelation: "valuation_runs"
            referencedColumns: ["id"]
          },
        ]
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
      assumption_category:
        | "liability"
        | "damages"
        | "comparative_fault"
        | "future_medical"
        | "wage_loss"
        | "policy_limits"
        | "venue"
        | "credibility"
        | "other"
      bill_linkage_status:
        | "pending"
        | "linked"
        | "unlinked"
        | "disputed"
        | "confirmed"
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
      chronology_candidate_status:
        | "draft"
        | "accepted"
        | "suppressed"
        | "merged"
      chronology_event_category:
        | "accident"
        | "first_treatment"
        | "treatment"
        | "imaging"
        | "injection"
        | "surgery"
        | "ime"
        | "demand"
        | "legal"
        | "administrative"
        | "billing"
        | "correspondence"
        | "investigation"
        | "representation"
        | "other"
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
      driver_family:
        | "injury_severity"
        | "treatment_intensity"
        | "liability"
        | "credibility"
        | "venue"
        | "policy_limits"
        | "wage_loss"
        | "future_treatment"
        | "permanency"
        | "surgery"
        | "imaging"
        | "pre_existing"
        | "other"
      duplicate_flag_status: "flagged" | "dismissed" | "confirmed"
      environment_designation: "development" | "staging" | "production"
      evaluation_case_status:
        | "not_started"
        | "intake_ready"
        | "intake_in_progress"
        | "valuation_ready"
        | "valuation_in_review"
        | "valued"
        | "completed"
      extraction_confidence_tier: "high" | "medium" | "low" | "unknown"
      extraction_review_state:
        | "draft"
        | "needs_review"
        | "accepted"
        | "corrected"
        | "rejected"
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
      medical_flag_category:
        | "excessive_treatment"
        | "insufficient_documentation"
        | "coding_mismatch"
        | "pre_existing_aggravation"
        | "causation_gap"
        | "guideline_deviation"
        | "billing_anomaly"
        | "provider_concern"
        | "other"
      medical_flag_severity: "info" | "warning" | "alert" | "critical"
      medical_flag_status: "open" | "acknowledged" | "resolved" | "dismissed"
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
      phi_readiness_status:
        | "development_test_allowed"
        | "production_phi_blocked"
        | "production_phi_ready"
      pipeline_stage:
        | "upload_received"
        | "ocr_queued"
        | "ocr_complete"
        | "document_classified"
        | "extraction_complete"
        | "evidence_links_created"
        | "review_items_generated"
      provider_normalization_status:
        | "pending"
        | "matched"
        | "new_entity"
        | "needs_review"
        | "confirmed"
      reviewer_case_status:
        | "not_started"
        | "intake_review"
        | "treatment_review"
        | "billing_review"
        | "provider_review"
        | "flagging"
        | "completed"
      reviewer_visit_type:
        | "emergency"
        | "ems"
        | "inpatient"
        | "outpatient"
        | "surgery"
        | "physical_therapy"
        | "chiropractic"
        | "pain_management"
        | "radiology"
        | "primary_care"
        | "specialist"
        | "mental_health"
        | "operative"
        | "follow_up"
        | "ime"
        | "other"
      treatment_review_decision:
        | "pending"
        | "reasonable"
        | "questionable"
        | "unreasonable"
        | "insufficient_info"
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
      valuation_run_type: "initial" | "refresh" | "manual_override"
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
      assumption_category: [
        "liability",
        "damages",
        "comparative_fault",
        "future_medical",
        "wage_loss",
        "policy_limits",
        "venue",
        "credibility",
        "other",
      ],
      bill_linkage_status: [
        "pending",
        "linked",
        "unlinked",
        "disputed",
        "confirmed",
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
      chronology_candidate_status: [
        "draft",
        "accepted",
        "suppressed",
        "merged",
      ],
      chronology_event_category: [
        "accident",
        "first_treatment",
        "treatment",
        "imaging",
        "injection",
        "surgery",
        "ime",
        "demand",
        "legal",
        "administrative",
        "billing",
        "correspondence",
        "investigation",
        "representation",
        "other",
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
      driver_family: [
        "injury_severity",
        "treatment_intensity",
        "liability",
        "credibility",
        "venue",
        "policy_limits",
        "wage_loss",
        "future_treatment",
        "permanency",
        "surgery",
        "imaging",
        "pre_existing",
        "other",
      ],
      duplicate_flag_status: ["flagged", "dismissed", "confirmed"],
      environment_designation: ["development", "staging", "production"],
      evaluation_case_status: [
        "not_started",
        "intake_ready",
        "intake_in_progress",
        "valuation_ready",
        "valuation_in_review",
        "valued",
        "completed",
      ],
      extraction_confidence_tier: ["high", "medium", "low", "unknown"],
      extraction_review_state: [
        "draft",
        "needs_review",
        "accepted",
        "corrected",
        "rejected",
      ],
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
      medical_flag_category: [
        "excessive_treatment",
        "insufficient_documentation",
        "coding_mismatch",
        "pre_existing_aggravation",
        "causation_gap",
        "guideline_deviation",
        "billing_anomaly",
        "provider_concern",
        "other",
      ],
      medical_flag_severity: ["info", "warning", "alert", "critical"],
      medical_flag_status: ["open", "acknowledged", "resolved", "dismissed"],
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
      phi_readiness_status: [
        "development_test_allowed",
        "production_phi_blocked",
        "production_phi_ready",
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
      provider_normalization_status: [
        "pending",
        "matched",
        "new_entity",
        "needs_review",
        "confirmed",
      ],
      reviewer_case_status: [
        "not_started",
        "intake_review",
        "treatment_review",
        "billing_review",
        "provider_review",
        "flagging",
        "completed",
      ],
      reviewer_visit_type: [
        "emergency",
        "ems",
        "inpatient",
        "outpatient",
        "surgery",
        "physical_therapy",
        "chiropractic",
        "pain_management",
        "radiology",
        "primary_care",
        "specialist",
        "mental_health",
        "operative",
        "follow_up",
        "ime",
        "other",
      ],
      treatment_review_decision: [
        "pending",
        "reasonable",
        "questionable",
        "unreasonable",
        "insufficient_info",
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
      valuation_run_type: ["initial", "refresh", "manual_override"],
    },
  },
} as const
