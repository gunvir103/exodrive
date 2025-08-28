export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      booking_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          actor_type: Database["public"]["Enums"]["actor_type_enum"] | null
          booking_id: string
          created_at: string | null
          details: Json | null
          event_type: Database["public"]["Enums"]["booking_event_type_enum"]
          id: string
          summary_text: string | null
          timestamp: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type_enum"] | null
          booking_id: string
          created_at?: string | null
          details?: Json | null
          event_type: Database["public"]["Enums"]["booking_event_type_enum"]
          id?: string
          summary_text?: string | null
          timestamp?: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type_enum"] | null
          booking_id?: string
          created_at?: string | null
          details?: Json | null
          event_type?: Database["public"]["Enums"]["booking_event_type_enum"]
          id?: string
          summary_text?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_booking_events_booking_id"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          }
        ]
      }
      booking_locations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          booking_id: string
          city: string | null
          country: string | null
          created_at: string | null
          formatted_address: string | null
          id: string
          latitude: number | null
          longitude: number | null
          postal_code: string | null
          special_instructions: string | null
          state_province: string | null
          type: Database["public"]["Enums"]["booking_location_type_enum"]
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          booking_id: string
          city?: string | null
          country?: string | null
          created_at?: string | null
          formatted_address?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          postal_code?: string | null
          special_instructions?: string | null
          state_province?: string | null
          type: Database["public"]["Enums"]["booking_location_type_enum"]
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          booking_id?: string
          city?: string | null
          country?: string | null
          created_at?: string | null
          formatted_address?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          postal_code?: string | null
          special_instructions?: string | null
          state_province?: string | null
          type?: Database["public"]["Enums"]["booking_location_type_enum"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_locations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_booking_locations_booking_id"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          }
        ]
      }
      booking_media: {
        Row: {
          booking_id: string
          created_at: string | null
          description: string | null
          file_name: string
          file_path: string | null
          file_url: string | null
          file_size_bytes: number | null
          id: string
          metadata: Json | null
          mime_type: string | null
          stage: Database["public"]["Enums"]["booking_media_stage_enum"]
          storage_bucket_id: string
          type: Database["public"]["Enums"]["booking_media_type_enum"]
          uploaded_at: string | null
          uploaded_by_id: string | null
          uploaded_by_type: Database["public"]["Enums"]["booking_media_uploader_enum"]
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          description?: string | null
          file_name: string
          file_path?: string | null
          file_url?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          stage: Database["public"]["Enums"]["booking_media_stage_enum"]
          storage_bucket_id?: string
          type: Database["public"]["Enums"]["booking_media_type_enum"]
          uploaded_at?: string | null
          uploaded_by_id?: string | null
          uploaded_by_type: Database["public"]["Enums"]["booking_media_uploader_enum"]
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_path?: string | null
          file_url?: string | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          stage?: Database["public"]["Enums"]["booking_media_stage_enum"]
          storage_bucket_id?: string
          type?: Database["public"]["Enums"]["booking_media_type_enum"]
          uploaded_at?: string | null
          uploaded_by_id?: string | null
          uploaded_by_type?: Database["public"]["Enums"]["booking_media_uploader_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_media_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_booking_media_booking_id"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          }
        ]
      }
      booking_secure_tokens: {
        Row: {
          booking_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_booking_secure_tokens_booking_id"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          }
        ]
      }
      bookings: {
        Row: {
          car_id: string
          contract_status: Database["public"]["Enums"]["contract_status_enum"] | null
          contract_submission_id: string | null
          contract_document_url: string | null
          created_at: string | null
          currency: string
          customer_id: string
          end_date: string
          id: string
          legacy_status: Database["public"]["Enums"]["booking_status_enum"]
          notes: string | null
          overall_status: Database["public"]["Enums"]["booking_overall_status_enum"] | null
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          secure_token_id: string | null
          security_deposit_amount: number | null
          start_date: string
          total_price: number
          updated_at: string | null
        }
        Insert: {
          car_id: string
          contract_status?: Database["public"]["Enums"]["contract_status_enum"] | null
          contract_submission_id?: string | null
          contract_document_url?: string | null
          created_at?: string | null
          currency?: string
          customer_id: string
          end_date: string
          id?: string
          legacy_status?: Database["public"]["Enums"]["booking_status_enum"]
          notes?: string | null
          overall_status?: Database["public"]["Enums"]["booking_overall_status_enum"] | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          secure_token_id?: string | null
          security_deposit_amount?: number | null
          start_date: string
          total_price: number
          updated_at?: string | null
        }
        Update: {
          car_id?: string
          contract_status?: Database["public"]["Enums"]["contract_status_enum"] | null
          contract_submission_id?: string | null
          contract_document_url?: string | null
          created_at?: string | null
          currency?: string
          customer_id?: string
          end_date?: string
          id?: string
          legacy_status?: Database["public"]["Enums"]["booking_status_enum"]
          notes?: string | null
          overall_status?: Database["public"]["Enums"]["booking_overall_status_enum"] | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          secure_token_id?: string | null
          security_deposit_amount?: number | null
          start_date?: string
          total_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_booking_secure_token"
            columns: ["secure_token_id"]
            isOneToOne: true
            referencedRelation: "booking_secure_tokens"
            referencedColumns: ["id"]
          }
        ]
      }
      car_additional_fees: {
        Row: {
          amount: number
          car_id: string
          created_at: string | null
          description: string | null
          id: string
          is_optional: boolean
          name: string
        }
        Insert: {
          amount: number
          car_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_optional?: boolean
          name: string
        }
        Update: {
          amount?: number
          car_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_optional?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_additional_fees_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          }
        ]
      }
      car_availability: {
        Row: {
          booking_id: string | null
          car_id: string
          created_at: string | null
          date: string
          id: string
          status: Database["public"]["Enums"]["car_availability_status_enum"]
          updated_at: string | null
        }
        Insert: {
          booking_id?: string | null
          car_id: string
          created_at?: string | null
          date: string
          id?: string
          status: Database["public"]["Enums"]["car_availability_status_enum"]
          updated_at?: string | null
        }
        Update: {
          booking_id?: string | null
          car_id?: string
          created_at?: string | null
          date?: string
          id?: string
          status?: Database["public"]["Enums"]["car_availability_status_enum"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "car_availability_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_car_availability_booking"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_car_availability_booking_id"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          }
        ]
      }
      car_features: {
        Row: {
          car_id: string
          created_at: string | null
          description: string | null
          id: string
          is_highlighted: boolean
          name: string
        }
        Insert: {
          car_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_highlighted?: boolean
          name: string
        }
        Update: {
          car_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_highlighted?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_features_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          }
        ]
      }
      car_images: {
        Row: {
          alt: string | null
          car_id: string
          created_at: string | null
          id: string
          is_primary: boolean
          path: string | null
          sort_order: number
          url: string
        }
        Insert: {
          alt?: string | null
          car_id: string
          created_at?: string | null
          id?: string
          is_primary?: boolean
          path?: string | null
          sort_order?: number
          url: string
        }
        Update: {
          alt?: string | null
          car_id?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean
          path?: string | null
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_images_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          }
        ]
      }
      car_pricing: {
        Row: {
          base_price: number
          car_id: string
          created_at: string | null
          currency: string
          deposit_amount: number
          discount_percentage: number | null
          id: string
          minimum_days: number
          special_offer_text: string | null
          updated_at: string | null
        }
        Insert: {
          base_price: number
          car_id: string
          created_at?: string | null
          currency?: string
          deposit_amount: number
          discount_percentage?: number | null
          id?: string
          minimum_days?: number
          special_offer_text?: string | null
          updated_at?: string | null
        }
        Update: {
          base_price?: number
          car_id?: string
          created_at?: string | null
          currency?: string
          deposit_amount?: number
          discount_percentage?: number | null
          id?: string
          minimum_days?: number
          special_offer_text?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "car_pricing_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: true
            referencedRelation: "cars"
            referencedColumns: ["id"]
          }
        ]
      }
      car_reviews: {
        Row: {
          car_id: string
          comment: string
          created_at: string | null
          date: string
          id: string
          is_approved: boolean
          is_verified: boolean
          name: string
          rating: number
        }
        Insert: {
          car_id: string
          comment: string
          created_at?: string | null
          date: string
          id?: string
          is_approved?: boolean
          is_verified?: boolean
          name: string
          rating: number
        }
        Update: {
          car_id?: string
          comment?: string
          created_at?: string | null
          date?: string
          id?: string
          is_approved?: boolean
          is_verified?: boolean
          name?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "car_reviews_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          }
        ]
      }
      car_specifications: {
        Row: {
          car_id: string
          created_at: string | null
          id: string
          is_highlighted: boolean
          name: string
          value: string
        }
        Insert: {
          car_id: string
          created_at?: string | null
          id?: string
          is_highlighted?: boolean
          name: string
          value: string
        }
        Update: {
          car_id?: string
          created_at?: string | null
          id?: string
          is_highlighted?: boolean
          name?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_specifications_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          }
        ]
      }
      cars: {
        Row: {
          available: boolean
          category: string
          created_at: string | null
          description: string
          featured: boolean
          hidden: boolean
          id: string
          name: string
          short_description: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          available?: boolean
          category: string
          created_at?: string | null
          description: string
          featured?: boolean
          hidden?: boolean
          id?: string
          name: string
          short_description?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          available?: boolean
          category?: string
          created_at?: string | null
          description?: string
          featured?: boolean
          hidden?: boolean
          id?: string
          name?: string
          short_description?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      dispute_evidence_items: {
        Row: {
          added_at: string | null
          booking_media_id: string
          description: string | null
          dispute_id: string
          id: string
        }
        Insert: {
          added_at?: string | null
          booking_media_id: string
          description?: string | null
          dispute_id: string
          id?: string
        }
        Update: {
          added_at?: string | null
          booking_media_id?: string
          description?: string | null
          dispute_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_evidence_items_booking_media_id_fkey"
            columns: ["booking_media_id"]
            isOneToOne: false
            referencedRelation: "booking_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_evidence_items_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_dispute_evidence_items_booking_media_id"
            columns: ["booking_media_id"]
            isOneToOne: false
            referencedRelation: "booking_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_dispute_evidence_items_dispute_id"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          }
        ]
      }
      disputes: {
        Row: {
          amount: number
          booking_id: string
          created_at: string | null
          currency: string
          dispute_provider: string
          evidence_due_date: string | null
          evidence_submitted_at: string | null
          id: string
          initial_invoice_attachments_info: string | null
          internal_notes: string | null
          opened_at: string
          payment_id: string | null
          provider_communication: Json | null
          provider_dispute_id: string
          reason: string | null
          resolution_outcome: string | null
          resolved_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string | null
          currency?: string
          dispute_provider?: string
          evidence_due_date?: string | null
          evidence_submitted_at?: string | null
          id?: string
          initial_invoice_attachments_info?: string | null
          internal_notes?: string | null
          opened_at: string
          payment_id?: string | null
          provider_communication?: Json | null
          provider_dispute_id: string
          reason?: string | null
          resolution_outcome?: string | null
          resolved_at?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string | null
          currency?: string
          dispute_provider?: string
          evidence_due_date?: string | null
          evidence_submitted_at?: string | null
          id?: string
          initial_invoice_attachments_info?: string | null
          internal_notes?: string | null
          opened_at?: string
          payment_id?: string | null
          provider_communication?: Json | null
          provider_dispute_id?: string
          reason?: string | null
          resolution_outcome?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_disputes_booking_id"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_disputes_payment_id"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          }
        ]
      }
      hero_content: {
        Row: {
          background_src: string
          background_type: string
          badge_text: string
          created_at: string | null
          id: string
          is_active: boolean
          primary_button_link: string
          primary_button_text: string
          secondary_button_link: string
          secondary_button_text: string
          subtitle: string
          title: string
          updated_at: string | null
        }
        Insert: {
          background_src: string
          background_type: string
          badge_text: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          primary_button_link: string
          primary_button_text: string
          secondary_button_link: string
          secondary_button_text: string
          subtitle: string
          title: string
          updated_at?: string | null
        }
        Update: {
          background_src?: string
          background_type?: string
          badge_text?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          primary_button_link?: string
          primary_button_text?: string
          secondary_button_link?: string
          secondary_button_text?: string
          subtitle?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      homepage_settings: {
        Row: {
          created_at: string | null
          featured_car_id: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          featured_car_id?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          featured_car_id?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homepage_settings_featured_car_id_fkey"
            columns: ["featured_car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          }
        ]
      }
      inbox_emails: {
        Row: {
          booking_id: string | null
          bounce_description: string | null
          bounce_type: string | null
          clicked_at: string | null
          created_at: string | null
          id: string
          last_event_at: string | null
          last_event_type: string | null
          opened_at: string | null
          raw_payload: Json | null
          recipient_email: string | null
          resend_email_id: string
          sender_email: string | null
          subject: string | null
          tags: Json | null
        }
        Insert: {
          booking_id?: string | null
          bounce_description?: string | null
          bounce_type?: string | null
          clicked_at?: string | null
          created_at?: string | null
          id?: string
          last_event_at?: string | null
          last_event_type?: string | null
          opened_at?: string | null
          raw_payload?: Json | null
          recipient_email?: string | null
          resend_email_id: string
          sender_email?: string | null
          subject?: string | null
          tags?: Json | null
        }
        Update: {
          booking_id?: string | null
          bounce_description?: string | null
          bounce_type?: string | null
          clicked_at?: string | null
          created_at?: string | null
          id?: string
          last_event_at?: string | null
          last_event_type?: string | null
          opened_at?: string | null
          raw_payload?: Json | null
          recipient_email?: string | null
          resend_email_id?: string
          sender_email?: string | null
          subject?: string | null
          tags?: Json | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          captured_at: string | null
          created_at: string | null
          currency: string
          id: string
          paypal_authorization_id: string | null
          paypal_invoice_id: string | null
          paypal_order_id: string | null
          status: Database["public"]["Enums"]["payment_status_enum"]
          updated_at: string | null
        }
        Insert: {
          amount: number
          booking_id: string
          captured_at?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          paypal_authorization_id?: string | null
          paypal_invoice_id?: string | null
          paypal_order_id?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
          updated_at?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string
          captured_at?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          paypal_authorization_id?: string | null
          paypal_invoice_id?: string | null
          paypal_order_id?: string | null
          status?: Database["public"]["Enums"]["payment_status_enum"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          }
        ]
      }
      paypal_invoices: {
        Row: {
          amount_due: number
          amount_paid: number | null
          booking_id: string
          created_at: string | null
          created_by_actor_id: string | null
          created_by_actor_type: Database["public"]["Enums"]["actor_type_enum"] | null
          created_on_paypal_at: string | null
          currency_code: string
          discount_amount: number | null
          discount_percentage: number | null
          due_date: string | null
          id: string
          invoice_url: string | null
          last_paypal_update_at: string | null
          line_items: Json | null
          note_to_recipient: string | null
          notes_to_recipient: string | null
          payment_terms: string | null
          paypal_invoice_id: string
          status: Database["public"]["Enums"]["paypal_invoice_status_enum"]
          tax_amount: number | null
          tax_name: string | null
          terms_and_conditions: string | null
          updated_at: string | null
        }
        Insert: {
          amount_due: number
          amount_paid?: number | null
          booking_id: string
          created_at?: string | null
          created_by_actor_id?: string | null
          created_by_actor_type?: Database["public"]["Enums"]["actor_type_enum"] | null
          created_on_paypal_at?: string | null
          currency_code?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          last_paypal_update_at?: string | null
          line_items?: Json | null
          note_to_recipient?: string | null
          notes_to_recipient?: string | null
          payment_terms?: string | null
          paypal_invoice_id: string
          status?: Database["public"]["Enums"]["paypal_invoice_status_enum"]
          tax_amount?: number | null
          tax_name?: string | null
          terms_and_conditions?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_due?: number
          amount_paid?: number | null
          booking_id?: string
          created_at?: string | null
          created_by_actor_id?: string | null
          created_by_actor_type?: Database["public"]["Enums"]["actor_type_enum"] | null
          created_on_paypal_at?: string | null
          currency_code?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          last_paypal_update_at?: string | null
          line_items?: Json | null
          note_to_recipient?: string | null
          notes_to_recipient?: string | null
          payment_terms?: string | null
          paypal_invoice_id?: string
          status?: Database["public"]["Enums"]["paypal_invoice_status_enum"]
          tax_amount?: number | null
          tax_name?: string | null
          terms_and_conditions?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paypal_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_webhook_retry_time: {
        Args: {
          attempt_count: number
        }
        Returns: string
      }
      check_and_reserve_car_availability: {
        Args: {
          p_car_id: string
          p_start_date: string
          p_end_date: string
          p_booking_id: string
        }
        Returns: boolean
      }
      clear_car_availability_hold: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      create_booking_transactional: {
        Args: {
          p_car_id: string
          p_start_date: string
          p_end_date: string
          p_customer_first_name: string
          p_customer_last_name: string
          p_customer_email: string
          p_customer_phone: string
          p_total_price: number
          p_currency: string
          p_security_deposit_amount: number
          p_secure_token_value: string
          p_token_expires_at: string
          p_booking_days: number
          p_initial_overall_status: string
          p_initial_payment_status: string
          p_initial_contract_status: string
        }
        Returns: Json
      }
      create_car_atomic: {
        Args: | {
          p_name: string
          p_category: string
          p_description: string
          p_short_description: string
          p_available: boolean
          p_featured: boolean
          p_hidden: boolean
          p_created_by: string
          p_pricing: Json
          p_images: Json
          p_features: Json
          p_specifications: Json
        } | {
          p_name: string
          p_category: string
          p_description: string
          p_short_description: string
          p_available: boolean
          p_featured: boolean
          p_hidden: boolean
          p_pricing: Json
          p_images: Json
          p_features: Json
          p_specifications: Json
        }
        Returns: string
      }
      delete_car_atomic: {
        Args: { p_car_id: string }
        Returns: undefined
      }
      is_admin: {
        Args: { email: string }
        Returns: boolean
      }
      set_active_hero: {
        Args: { hero_id: string }
        Returns: undefined
      }
      update_car_atomic: {
        Args: {
          p_car_id: string
          p_name: string
          p_category: string
          p_description: string
          p_short_description: string
          p_available: boolean
          p_featured: boolean
          p_hidden: boolean
          p_pricing: Json
          p_images: Json
          p_features: Json
          p_specifications: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      actor_type_enum: "customer" | "admin" | "system" | "webhook_paypal" | "webhook_resend" | "webhook_esignature"
      booking_event_type_enum: "booking_created" | "booking_cancelled" | "booking_updated" | "status_changed_overall" | "status_changed_payment" | "status_changed_contract" | "payment_initiated" | "payment_authorized" | "payment_authorization_failed" | "payment_captured" | "payment_capture_failed" | "payment_voided" | "payment_refunded" | "contract_sent" | "contract_viewed" | "contract_signed" | "contract_declined" | "car_picked_up" | "car_returned" | "vehicle_inspected_pickup" | "vehicle_inspected_return" | "email_sent" | "email_delivered" | "email_opened" | "email_bounced" | "admin_note_added" | "admin_manual_override" | "dispute_opened" | "dispute_evidence_submitted" | "dispute_resolved" | "system_reminder_sent"
      booking_location_type_enum: "pickup" | "dropoff"
      booking_media_stage_enum: "pickup_pre_rental" | "dropoff_post_rental" | "rental_agreement" | "id_scan" | "dispute_evidence" | "general_attachment"
      booking_media_type_enum: "photo" | "video" | "pdf" | "other"
      booking_media_uploader_enum: "customer" | "admin" | "system"
      booking_overall_status_enum: "pending_customer_action" | "pending_payment" | "pending_contract" | "upcoming" | "active" | "post_rental_finalization" | "completed" | "cancelled" | "disputed"
      booking_status_enum: "pending" | "authorized" | "upcoming" | "active" | "completed" | "cancelled" | "booked"
      car_availability_status_enum: "available" | "pending_confirmation" | "booked" | "maintenance"
      contract_status_enum: "not_sent" | "sent" | "viewed" | "signed" | "declined" | "voided"
      payment_status_enum: "pending" | "authorized" | "captured" | "refunded" | "voided" | "failed"
      paypal_invoice_status_enum: "DRAFT" | "SENT" | "SCHEDULED" | "PAYMENT_PENDING" | "PAID" | "MARKED_AS_PAID" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "MARKED_AS_REFUNDED" | "VOIDED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      actor_type_enum: ["customer", "admin", "system", "webhook_paypal", "webhook_resend", "webhook_esignature"],
      booking_event_type_enum: [
        "booking_created",
        "booking_cancelled",
        "booking_updated",
        "status_changed_overall",
        "status_changed_payment",
        "status_changed_contract",
        "payment_initiated",
        "payment_authorized",
        "payment_authorization_failed",
        "payment_captured",
        "payment_capture_failed",
        "payment_voided",
        "payment_refunded",
        "contract_sent",
        "contract_viewed",
        "contract_signed",
        "contract_declined",
        "car_picked_up",
        "car_returned",
        "vehicle_inspected_pickup",
        "vehicle_inspected_return",
        "email_sent",
        "email_delivered",
        "email_opened",
        "email_bounced",
        "admin_note_added",
        "admin_manual_override",
        "dispute_opened",
        "dispute_evidence_submitted",
        "dispute_resolved",
        "system_reminder_sent",
      ],
      booking_location_type_enum: ["pickup", "dropoff"],
      booking_media_stage_enum: [
        "pickup_pre_rental",
        "dropoff_post_rental",
        "rental_agreement",
        "id_scan",
        "dispute_evidence",
        "general_attachment",
      ],
      booking_media_type_enum: ["photo", "video", "pdf", "other"],
      booking_media_uploader_enum: ["customer", "admin", "system"],
      booking_overall_status_enum: [
        "pending_customer_action",
        "pending_payment",
        "pending_contract",
        "upcoming",
        "active",
        "post_rental_finalization",
        "completed",
        "cancelled",
        "disputed",
      ],
      booking_status_enum: ["pending", "authorized", "upcoming", "active", "completed", "cancelled", "booked"],
      car_availability_status_enum: ["available", "pending_confirmation", "booked", "maintenance"],
      contract_status_enum: ["not_sent", "sent", "viewed", "signed", "declined", "voided"],
      payment_status_enum: ["pending", "authorized", "captured", "refunded", "voided", "failed"],
      paypal_invoice_status_enum: [
        "DRAFT",
        "SENT",
        "SCHEDULED",
        "PAYMENT_PENDING",
        "PAID",
        "MARKED_AS_PAID",
        "CANCELLED",
        "REFUNDED",
        "PARTIALLY_REFUNDED",
        "MARKED_AS_REFUNDED",
        "VOIDED",
      ],
    },
  },
} as const;
