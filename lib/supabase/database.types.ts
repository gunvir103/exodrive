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
      bookings: {
        Row: {
          car_id: string
          created_at: string | null
          currency: string
          customer_id: string
          end_date: string
          id: string
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          start_date: string
          status: Database["public"]["Enums"]["booking_status_enum"]
          total_price: number
          updated_at: string | null
        }
        Insert: {
          car_id: string
          created_at?: string | null
          currency?: string
          customer_id: string
          end_date: string
          id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          start_date: string
          status?: Database["public"]["Enums"]["booking_status_enum"]
          total_price: number
          updated_at?: string | null
        }
        Update: {
          car_id?: string
          created_at?: string | null
          currency?: string
          customer_id?: string
          end_date?: string
          id?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          start_date?: string
          status?: Database["public"]["Enums"]["booking_status_enum"]
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
          },
        ]
      }
      car_availability: {
        Row: {
          booking_id: string | null
          car_id: string
          created_at: string | null
          date: string
          id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          booking_id?: string | null
          car_id: string
          created_at?: string | null
          date: string
          id?: string
          status: string
          updated_at?: string | null
        }
        Update: {
          booking_id?: string | null
          car_id?: string
          created_at?: string | null
          date?: string
          id?: string
          status?: string
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
          },
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
          },
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
          },
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
          },
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
          },
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
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
          },
        ]
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
          },
        ]
      }
      paypal_invoices: {
        Row: {
          booking_id: string | null
          created_at: string | null
          currency: string | null
          gross_amount: number | null
          invoice_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          currency?: string | null
          gross_amount?: number | null
          invoice_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          currency?: string | null
          gross_amount?: number | null
          invoice_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "paypal_invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_car_atomic: {
        Args:
          | {
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
            }
          | {
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
      booking_status_enum:
        | "pending"
        | "authorized"
        | "upcoming"
        | "active"
        | "completed"
        | "cancelled"
        | "booked"
      payment_status_enum:
        | "pending"
        | "authorized"
        | "captured"
        | "refunded"
        | "voided"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      booking_status_enum: [
        "pending",
        "authorized",
        "upcoming",
        "active",
        "completed",
        "cancelled",
        "booked",
      ],
      payment_status_enum: [
        "pending",
        "authorized",
        "captured",
        "refunded",
        "voided",
      ],
    },
  },
} as const
