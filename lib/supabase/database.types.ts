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
            isOneToOne: false
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_active_hero: {
        Args: {
          hero_id: string
        }
        Returns: undefined
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
