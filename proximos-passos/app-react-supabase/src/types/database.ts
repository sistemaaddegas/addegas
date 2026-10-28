
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "app": {
          Tables: {
            "accounts": {
                  Row: {
                    "business_day_cutoff": string,"created_at": string,"document": string | null,"id": string,"name": string,"owner_user_id": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_day_cutoff"?: string,"created_at"?: string,"document"?: string | null,"id"?: string,"name": string,"owner_user_id": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "business_day_cutoff"?: string,"created_at"?: string,"document"?: string | null,"id"?: string,"name"?: string,"owner_user_id"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"permissions": {
                  Row: {
                    "blocked_when_suspended": boolean,"code": string,"feature_code": string | null,"grp": string,"name": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_when_suspended"?: boolean,"code": string,"feature_code"?: string | null,"grp": string,"name": string,"sort": number
                  }
                  Update: {
                    "blocked_when_suspended"?: boolean,"code"?: string,"feature_code"?: string | null,"grp"?: string,"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"id": string,"last_store_id": string | null,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"id": string,"last_store_id"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"id"?: string,"last_store_id"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_last_store_id_fkey"
      columns: ["last_store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"role_permissions": {
                  Row: {
                    "allowed": boolean,"permission_code": string,"role": Database["app"]['Enums']["member_role"],"store_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed": boolean,"permission_code": string,"role": Database["app"]['Enums']["member_role"],"store_id": string,"updated_at"?: string
                  }
                  Update: {
                    "allowed"?: boolean,"permission_code"?: string,"role"?: Database["app"]['Enums']["member_role"],"store_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_permissions_permission_code_fkey"
      columns: ["permission_code"]
isOneToOne: false
      referencedRelation: "permissions"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "role_permissions_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"role_settings": {
                  Row: {
                    "max_discount_pct": number | null,"role": Database["app"]['Enums']["member_role"],"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "max_discount_pct"?: number | null,"role": Database["app"]['Enums']["member_role"],"store_id": string
                  }
                  Update: {
                    "max_discount_pct"?: number | null,"role"?: Database["app"]['Enums']["member_role"],"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "role_settings_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"store_members": {
                  Row: {
                    "active": boolean,"created_at": string,"display_name": string,"id": string,"role": Database["app"]['Enums']["member_role"],"store_id": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"display_name": string,"id"?: string,"role": Database["app"]['Enums']["member_role"],"store_id": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"display_name"?: string,"id"?: string,"role"?: Database["app"]['Enums']["member_role"],"store_id"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_members_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"store_settings": {
                  Row: {
                    "blind_cash_count": boolean,"block_negative_stock": boolean,"cash_difference_alert": number,"delivery_fee_default": number,"free_delivery_above": number | null,"pix_city": string | null,"pix_key": string | null,"pix_receiver_name": string | null,"store_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blind_cash_count"?: boolean,"block_negative_stock"?: boolean,"cash_difference_alert"?: number,"delivery_fee_default"?: number,"free_delivery_above"?: number | null,"pix_city"?: string | null,"pix_key"?: string | null,"pix_receiver_name"?: string | null,"store_id": string,"updated_at"?: string
                  }
                  Update: {
                    "blind_cash_count"?: boolean,"block_negative_stock"?: boolean,"cash_difference_alert"?: number,"delivery_fee_default"?: number,"free_delivery_above"?: number | null,"pix_city"?: string | null,"pix_key"?: string | null,"pix_receiver_name"?: string | null,"store_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_settings_store_id_fkey"
      columns: ["store_id"]
isOneToOne: true
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"stores": {
                  Row: {
                    "account_id": string,"address": string | null,"archived_at": string | null,"city": string | null,"created_at": string,"id": string,"name": string,"neighborhood": string | null,"slug": string,"updated_at": string,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"address"?: string | null,"archived_at"?: string | null,"city"?: string | null,"created_at"?: string,"id"?: string,"name": string,"neighborhood"?: string | null,"slug": string,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"address"?: string | null,"archived_at"?: string | null,"city"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"neighborhood"?: string | null,"slug"?: string,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stores_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "complete_onboarding":
{ Args: { "p_city"?: string,"p_neighborhood"?: string,"p_origin"?: Json,"p_owner_name"?: string,"p_store_name": string,"p_whatsapp"?: string }; Returns: Json
                           },
"create_store":
{ Args: { "p_account_id": string,"p_city"?: string,"p_name": string,"p_neighborhood"?: string,"p_whatsapp"?: string }; Returns: Json
                           },
"my_permissions":
{ Args: { "p_store_id": string }; Returns: Json
                           },
"my_stores":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_subscription":
{ Args: { "p_account_id": string }; Returns: Json
                           },
"set_role_discount_limit":
{ Args: { "p_max_pct": number,"p_role": Database["app"]['Enums']["member_role"],"p_store_id": string }; Returns: Json
                           },
"set_role_permission":
{ Args: { "p_allowed": boolean,"p_permission": string,"p_role": Database["app"]['Enums']["member_role"],"p_store_id": string }; Returns: Json
                           }
          }
          Enums: {
            "member_role": "owner"|"manager"|"cashier"|"stock_keeper"|"courier"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            [_ in never]: never
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "app": {
          Enums: {
            "member_role": ["owner", "manager", "cashier", "stock_keeper", "courier"]
          }
        },"graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
