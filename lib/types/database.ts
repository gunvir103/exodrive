export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      cars: {
        Row: {
          available: boolean
          category: string
          created_at: string
          description: string
          featured: boolean
          hidden: boolean
          id: string
          name: string
          short_description: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          category: string
          created_at?: string
          description: string
          featured?: boolean
          hidden?: boolean
          id?: string
          name: string
          short_description?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          category?: string
          created_at?: string
          description?: string
          featured?: boolean
          hidden?: boolean
          id?: string
          name?: string
          short_description?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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

