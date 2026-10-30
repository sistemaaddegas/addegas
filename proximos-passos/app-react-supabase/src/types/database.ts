
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
                },"alert_recipients": {
                  Row: {
                    "code_hash": string | null,"created_at": string,"opted_out_at": string | null,"phone": string,"store_id": string,"verified_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code_hash"?: string | null,"created_at"?: string,"opted_out_at"?: string | null,"phone": string,"store_id": string,"verified_at"?: string | null
                  }
                  Update: {
                    "code_hash"?: string | null,"created_at"?: string,"opted_out_at"?: string | null,"phone"?: string,"store_id"?: string,"verified_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_recipients_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"alert_settings": {
                  Row: {
                    "enabled": boolean,"quiet_end": string | null,"quiet_start": string | null,"store_id": string,"threshold": number | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled"?: boolean,"quiet_end"?: string | null,"quiet_start"?: string | null,"store_id": string,"threshold"?: number | null,"type": string
                  }
                  Update: {
                    "enabled"?: boolean,"quiet_end"?: string | null,"quiet_start"?: string | null,"store_id"?: string,"threshold"?: number | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_settings_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"alerts": {
                  Row: {
                    "created_at": string,"dedupe_key": string,"entity": string | null,"entity_id": string | null,"id": string,"message": string,"read_at": string | null,"read_by": string | null,"sent_at": string | null,"severity": string,"store_id": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dedupe_key": string,"entity"?: string | null,"entity_id"?: string | null,"id"?: string,"message": string,"read_at"?: string | null,"read_by"?: string | null,"sent_at"?: string | null,"severity"?: string,"store_id": string,"type": string
                  }
                  Update: {
                    "created_at"?: string,"dedupe_key"?: string,"entity"?: string | null,"entity_id"?: string | null,"id"?: string,"message"?: string,"read_at"?: string | null,"read_by"?: string | null,"sent_at"?: string | null,"severity"?: string,"store_id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"bills": {
                  Row: {
                    "account_id": string,"amount": number,"category": string | null,"created_at": string,"created_by": string | null,"description": string,"due_on": string,"id": string,"interest_kind": string,"interest_value": number,"paid_amount": number | null,"paid_at": string | null,"paid_method": string | null,"proof_path": string | null,"recurring_monthly": boolean,"store_id": string,"supplier_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"amount": number,"category"?: string | null,"created_at"?: string,"created_by"?: string | null,"description": string,"due_on": string,"id"?: string,"interest_kind"?: string,"interest_value"?: number,"paid_amount"?: number | null,"paid_at"?: string | null,"paid_method"?: string | null,"proof_path"?: string | null,"recurring_monthly"?: boolean,"store_id": string,"supplier_id"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"amount"?: number,"category"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"due_on"?: string,"id"?: string,"interest_kind"?: string,"interest_value"?: number,"paid_amount"?: number | null,"paid_at"?: string | null,"paid_method"?: string | null,"proof_path"?: string | null,"recurring_monthly"?: boolean,"store_id"?: string,"supplier_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bills_store_id_account_id_fkey"
      columns: ["store_id","account_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id","account_id"]
    },{
      foreignKeyName: "bills_supplier_id_account_id_fkey"
      columns: ["supplier_id","account_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id","account_id"]
    }
                  ]
                },"bundle_items": {
                  Row: {
                    "account_id": string,"bundle_id": string,"product_id": string,"quantity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"bundle_id": string,"product_id": string,"quantity": number
                  }
                  Update: {
                    "account_id"?: string,"bundle_id"?: string,"product_id"?: string,"quantity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "bundle_items_bundle_id_account_id_fkey"
      columns: ["bundle_id","account_id"]
isOneToOne: false
      referencedRelation: "bundles"
      referencedColumns: ["id","account_id"]
    },{
      foreignKeyName: "bundle_items_product_id_account_id_fkey"
      columns: ["product_id","account_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","account_id"]
    }
                  ]
                },"bundles": {
                  Row: {
                    "account_id": string,"active": boolean,"archived_at": string | null,"created_at": string,"end_time": string | null,"ends_at": string | null,"id": string,"image_path": string | null,"kind": string,"name": string,"price": number,"show_in_catalog": boolean,"start_time": string | null,"starts_at": string | null,"updated_at": string,"weekdays": (number)[] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"active"?: boolean,"archived_at"?: string | null,"created_at"?: string,"end_time"?: string | null,"ends_at"?: string | null,"id"?: string,"image_path"?: string | null,"kind"?: string,"name": string,"price": number,"show_in_catalog"?: boolean,"start_time"?: string | null,"starts_at"?: string | null,"updated_at"?: string,"weekdays"?: (number)[] | null
                  }
                  Update: {
                    "account_id"?: string,"active"?: boolean,"archived_at"?: string | null,"created_at"?: string,"end_time"?: string | null,"ends_at"?: string | null,"id"?: string,"image_path"?: string | null,"kind"?: string,"name"?: string,"price"?: number,"show_in_catalog"?: boolean,"start_time"?: string | null,"starts_at"?: string | null,"updated_at"?: string,"weekdays"?: (number)[] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bundles_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"cash_movements": {
                  Row: {
                    "amount": number,"business_date": string,"cash_session_id": string,"created_at": string,"id": string,"member_id": string | null,"reason": string | null,"ref_id": string | null,"store_id": string,"type": Database["app"]['Enums']["cash_movement_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"business_date": string,"cash_session_id": string,"created_at"?: string,"id"?: string,"member_id"?: string | null,"reason"?: string | null,"ref_id"?: string | null,"store_id": string,"type": Database["app"]['Enums']["cash_movement_type"]
                  }
                  Update: {
                    "amount"?: number,"business_date"?: string,"cash_session_id"?: string,"created_at"?: string,"id"?: string,"member_id"?: string | null,"reason"?: string | null,"ref_id"?: string | null,"store_id"?: string,"type"?: Database["app"]['Enums']["cash_movement_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_movements_cash_session_id_store_id_fkey"
      columns: ["cash_session_id","store_id"]
isOneToOne: false
      referencedRelation: "cash_sessions"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "cash_movements_member_id_store_id_fkey"
      columns: ["member_id","store_id"]
isOneToOne: false
      referencedRelation: "store_members"
      referencedColumns: ["id","store_id"]
    }
                  ]
                },"cash_sessions": {
                  Row: {
                    "business_date": string,"closed_at": string | null,"closed_by": string | null,"counted_cash": number | null,"difference": number | null,"expected_cash": number | null,"id": string,"note": string | null,"opened_at": string,"opened_by": string,"opening_float": number,"status": string,"store_id": string,"summary": Json | null,"terminal_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "business_date": string,"closed_at"?: string | null,"closed_by"?: string | null,"counted_cash"?: number | null,"difference"?: number | null,"expected_cash"?: number | null,"id"?: string,"note"?: string | null,"opened_at"?: string,"opened_by": string,"opening_float"?: number,"status"?: string,"store_id": string,"summary"?: Json | null,"terminal_id": string
                  }
                  Update: {
                    "business_date"?: string,"closed_at"?: string | null,"closed_by"?: string | null,"counted_cash"?: number | null,"difference"?: number | null,"expected_cash"?: number | null,"id"?: string,"note"?: string | null,"opened_at"?: string,"opened_by"?: string,"opening_float"?: number,"status"?: string,"store_id"?: string,"summary"?: Json | null,"terminal_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cash_sessions_closed_by_store_id_fkey"
      columns: ["closed_by","store_id"]
isOneToOne: false
      referencedRelation: "store_members"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "cash_sessions_opened_by_store_id_fkey"
      columns: ["opened_by","store_id"]
isOneToOne: false
      referencedRelation: "store_members"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "cash_sessions_terminal_id_store_id_fkey"
      columns: ["terminal_id","store_id"]
isOneToOne: false
      referencedRelation: "terminals"
      referencedColumns: ["id","store_id"]
    }
                  ]
                },"catalog_settings": {
                  Row: {
                    "enabled": boolean,"show_price": boolean,"show_stock": boolean,"store_id": string,"whatsapp_message": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled"?: boolean,"show_price"?: boolean,"show_stock"?: boolean,"store_id": string,"whatsapp_message"?: string
                  }
                  Update: {
                    "enabled"?: boolean,"show_price"?: boolean,"show_stock"?: boolean,"store_id"?: string,"whatsapp_message"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalog_settings_store_id_fkey"
      columns: ["store_id"]
isOneToOne: true
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "account_id": string,"color": string | null,"id": string,"name": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"color"?: string | null,"id"?: string,"name": string,"sort"?: number
                  }
                  Update: {
                    "account_id"?: string,"color"?: string | null,"id"?: string,"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"drink_recipe_items": {
                  Row: {
                    "account_id": string,"amount": number,"product_id": string,"recipe_id": string,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"amount": number,"product_id": string,"recipe_id": string,"unit": string
                  }
                  Update: {
                    "account_id"?: string,"amount"?: number,"product_id"?: string,"recipe_id"?: string,"unit"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "drink_recipe_items_product_id_account_id_fkey"
      columns: ["product_id","account_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","account_id"]
    },{
      foreignKeyName: "drink_recipe_items_recipe_id_account_id_fkey"
      columns: ["recipe_id","account_id"]
isOneToOne: false
      referencedRelation: "drink_recipes"
      referencedColumns: ["id","account_id"]
    }
                  ]
                },"drink_recipes": {
                  Row: {
                    "account_id": string,"active": boolean,"color": string | null,"created_at": string,"id": string,"image_path": string | null,"name": string,"sale_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"active"?: boolean,"color"?: string | null,"created_at"?: string,"id"?: string,"image_path"?: string | null,"name": string,"sale_price"?: number
                  }
                  Update: {
                    "account_id"?: string,"active"?: boolean,"color"?: string | null,"created_at"?: string,"id"?: string,"image_path"?: string | null,"name"?: string,"sale_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "drink_recipes_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"fiado_accounts": {
                  Row: {
                    "balance": number,"created_at": string,"credit_limit": number | null,"id": string,"name": string,"name_norm": string,"note": string | null,"phone": string | null,"phone_anonymized_at": string | null,"promised_date": string | null,"store_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "balance"?: number,"created_at"?: string,"credit_limit"?: number | null,"id"?: string,"name": string,"name_norm": string,"note"?: string | null,"phone"?: string | null,"phone_anonymized_at"?: string | null,"promised_date"?: string | null,"store_id": string,"updated_at"?: string
                  }
                  Update: {
                    "balance"?: number,"created_at"?: string,"credit_limit"?: number | null,"id"?: string,"name"?: string,"name_norm"?: string,"note"?: string | null,"phone"?: string | null,"phone_anonymized_at"?: string | null,"promised_date"?: string | null,"store_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fiado_accounts_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"fiado_ledger": {
                  Row: {
                    "amount": number,"created_at": string,"fiado_account_id": string,"id": string,"member_id": string | null,"method": Database["app"]['Enums']["pay_method"] | null,"note": string | null,"sale_id": string | null,"store_id": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"fiado_account_id": string,"id"?: string,"member_id"?: string | null,"method"?: Database["app"]['Enums']["pay_method"] | null,"note"?: string | null,"sale_id"?: string | null,"store_id": string,"type": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"fiado_account_id"?: string,"id"?: string,"member_id"?: string | null,"method"?: Database["app"]['Enums']["pay_method"] | null,"note"?: string | null,"sale_id"?: string | null,"store_id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fiado_ledger_fiado_account_id_store_id_fkey"
      columns: ["fiado_account_id","store_id"]
isOneToOne: false
      referencedRelation: "fiado_accounts"
      referencedColumns: ["id","store_id"]
    }
                  ]
                },"notes": {
                  Row: {
                    "author_id": string,"body": string | null,"created_at": string,"done": boolean,"id": string,"pinned": boolean,"priority": string,"store_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string,"body"?: string | null,"created_at"?: string,"done"?: boolean,"id"?: string,"pinned"?: boolean,"priority"?: string,"store_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string | null,"created_at"?: string,"done"?: boolean,"id"?: string,"pinned"?: boolean,"priority"?: string,"store_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notes_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"operator_sessions": {
                  Row: {
                    "end_reason": string | null,"ended_at": string | null,"expires_at": string,"id": string,"member_id": string,"started_at": string,"store_id": string,"terminal_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "end_reason"?: string | null,"ended_at"?: string | null,"expires_at"?: string,"id"?: string,"member_id": string,"started_at"?: string,"store_id": string,"terminal_id": string
                  }
                  Update: {
                    "end_reason"?: string | null,"ended_at"?: string | null,"expires_at"?: string,"id"?: string,"member_id"?: string,"started_at"?: string,"store_id"?: string,"terminal_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "operator_sessions_member_id_store_id_fkey"
      columns: ["member_id","store_id"]
isOneToOne: false
      referencedRelation: "store_members"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "operator_sessions_terminal_id_store_id_fkey"
      columns: ["terminal_id","store_id"]
isOneToOne: false
      referencedRelation: "terminals"
      referencedColumns: ["id","store_id"]
    }
                  ]
                },"order_events": {
                  Row: {
                    "actor_user": string | null,"created_at": string,"from_status": string | null,"id": string,"order_id": string,"origin": string,"reason": string | null,"store_id": string,"to_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_user"?: string | null,"created_at"?: string,"from_status"?: string | null,"id"?: string,"order_id": string,"origin"?: string,"reason"?: string | null,"store_id": string,"to_status": string
                  }
                  Update: {
                    "actor_user"?: string | null,"created_at"?: string,"from_status"?: string | null,"id"?: string,"order_id"?: string,"origin"?: string,"reason"?: string | null,"store_id"?: string,"to_status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_events_order_id_store_id_fkey"
      columns: ["order_id","store_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id","store_id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "bundle_id": string | null,"id": string,"name": string,"order_id": string,"product_id": string | null,"quantity": number,"store_id": string,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bundle_id"?: string | null,"id"?: string,"name": string,"order_id": string,"product_id"?: string | null,"quantity": number,"store_id": string,"unit_price": number
                  }
                  Update: {
                    "bundle_id"?: string | null,"id"?: string,"name"?: string,"order_id"?: string,"product_id"?: string | null,"quantity"?: number,"store_id"?: string,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_bundle_id_fkey"
      columns: ["bundle_id"]
isOneToOne: false
      referencedRelation: "bundles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_store_id_fkey"
      columns: ["order_id","store_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "account_id": string,"address": string | null,"cancel_reason": string | null,"canceled_at": string | null,"channel": string,"completed_at": string | null,"confirmed_at": string | null,"courier_member_id": string | null,"created_at": string,"created_by": string | null,"customer_name": string | null,"customer_phone": string | null,"delivery_fee": number,"external_id": string | null,"free_delivery": boolean,"id": string,"mode": string,"notes": string | null,"number": number,"payment_hint": string | null,"sale_id": string | null,"status": string,"stock_moved": boolean,"store_id": string,"subtotal": number,"total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"address"?: string | null,"cancel_reason"?: string | null,"canceled_at"?: string | null,"channel": string,"completed_at"?: string | null,"confirmed_at"?: string | null,"courier_member_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_name"?: string | null,"customer_phone"?: string | null,"delivery_fee"?: number,"external_id"?: string | null,"free_delivery"?: boolean,"id"?: string,"mode"?: string,"notes"?: string | null,"number": number,"payment_hint"?: string | null,"sale_id"?: string | null,"status"?: string,"stock_moved"?: boolean,"store_id": string,"subtotal"?: number,"total"?: number
                  }
                  Update: {
                    "account_id"?: string,"address"?: string | null,"cancel_reason"?: string | null,"canceled_at"?: string | null,"channel"?: string,"completed_at"?: string | null,"confirmed_at"?: string | null,"courier_member_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"customer_name"?: string | null,"customer_phone"?: string | null,"delivery_fee"?: number,"external_id"?: string | null,"free_delivery"?: boolean,"id"?: string,"mode"?: string,"notes"?: string | null,"number"?: number,"payment_hint"?: string | null,"sale_id"?: string | null,"status"?: string,"stock_moved"?: boolean,"store_id"?: string,"subtotal"?: number,"total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_courier_member_id_store_id_fkey"
      columns: ["courier_member_id","store_id"]
isOneToOne: false
      referencedRelation: "store_members"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "orders_sale_id_store_id_fkey"
      columns: ["sale_id","store_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "orders_store_id_account_id_fkey"
      columns: ["store_id","account_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id","account_id"]
    }
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
                },"printer_settings": {
                  Row: {
                    "auto_print": boolean,"copies": number,"footer": string | null,"header": string | null,"id": string,"method": string,"open_drawer_on_cash": boolean,"store_id": string,"terminal_id": string | null,"updated_at": string,"width_mm": number
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_print"?: boolean,"copies"?: number,"footer"?: string | null,"header"?: string | null,"id"?: string,"method"?: string,"open_drawer_on_cash"?: boolean,"store_id": string,"terminal_id"?: string | null,"updated_at"?: string,"width_mm"?: number
                  }
                  Update: {
                    "auto_print"?: boolean,"copies"?: number,"footer"?: string | null,"header"?: string | null,"id"?: string,"method"?: string,"open_drawer_on_cash"?: boolean,"store_id"?: string,"terminal_id"?: string | null,"updated_at"?: string,"width_mm"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "printer_settings_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "printer_settings_terminal_id_store_id_fkey"
      columns: ["terminal_id","store_id"]
isOneToOne: false
      referencedRelation: "terminals"
      referencedColumns: ["id","store_id"]
    }
                  ]
                },"product_stock": {
                  Row: {
                    "account_id": string,"product_id": string,"quantity": number,"store_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"product_id": string,"quantity"?: number,"store_id": string,"updated_at"?: string
                  }
                  Update: {
                    "account_id"?: string,"product_id"?: string,"quantity"?: number,"store_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_stock_product_id_account_id_fkey"
      columns: ["product_id","account_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","account_id"]
    },{
      foreignKeyName: "product_stock_store_id_account_id_fkey"
      columns: ["store_id","account_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id","account_id"]
    }
                  ]
                },"products": {
                  Row: {
                    "account_id": string,"active": boolean,"avg_cost": number,"catalog_product_id": string | null,"category_id": string | null,"created_at": string,"ean": string | null,"id": string,"image_path": string | null,"last_cost": number | null,"min_stock": number,"name": string,"price": number,"unit": string,"updated_at": string,"volume_ml": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"active"?: boolean,"avg_cost"?: number,"catalog_product_id"?: string | null,"category_id"?: string | null,"created_at"?: string,"ean"?: string | null,"id"?: string,"image_path"?: string | null,"last_cost"?: number | null,"min_stock"?: number,"name": string,"price": number,"unit"?: string,"updated_at"?: string,"volume_ml"?: number | null
                  }
                  Update: {
                    "account_id"?: string,"active"?: boolean,"avg_cost"?: number,"catalog_product_id"?: string | null,"category_id"?: string | null,"created_at"?: string,"ean"?: string | null,"id"?: string,"image_path"?: string | null,"last_cost"?: number | null,"min_stock"?: number,"name"?: string,"price"?: number,"unit"?: string,"updated_at"?: string,"volume_ml"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "products_category_id_account_id_fkey"
      columns: ["category_id","account_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","account_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar": string | null,"created_at": string,"full_name": string | null,"id": string,"last_store_id": string | null,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar"?: string | null,"created_at"?: string,"full_name"?: string | null,"id": string,"last_store_id"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar"?: string | null,"created_at"?: string,"full_name"?: string | null,"id"?: string,"last_store_id"?: string | null,"phone"?: string | null,"updated_at"?: string
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
                },"purchase_order_items": {
                  Row: {
                    "product_id": string,"purchase_order_id": string,"quantity": number,"received_qty": number,"store_id": string,"unit_cost_estimate": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "product_id": string,"purchase_order_id": string,"quantity": number,"received_qty"?: number,"store_id": string,"unit_cost_estimate"?: number | null
                  }
                  Update: {
                    "product_id"?: string,"purchase_order_id"?: string,"quantity"?: number,"received_qty"?: number,"store_id"?: string,"unit_cost_estimate"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_order_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "purchase_order_items_purchase_order_id_store_id_fkey"
      columns: ["purchase_order_id","store_id"]
isOneToOne: false
      referencedRelation: "purchase_orders"
      referencedColumns: ["id","store_id"]
    }
                  ]
                },"purchase_orders": {
                  Row: {
                    "account_id": string,"created_at": string,"created_by": string | null,"expected_on": string | null,"id": string,"note": string | null,"status": string,"store_id": string,"supplier_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"created_at"?: string,"created_by"?: string | null,"expected_on"?: string | null,"id"?: string,"note"?: string | null,"status"?: string,"store_id": string,"supplier_id"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"created_by"?: string | null,"expected_on"?: string | null,"id"?: string,"note"?: string | null,"status"?: string,"store_id"?: string,"supplier_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "purchase_orders_store_id_account_id_fkey"
      columns: ["store_id","account_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id","account_id"]
    },{
      foreignKeyName: "purchase_orders_supplier_id_account_id_fkey"
      columns: ["supplier_id","account_id"]
isOneToOne: false
      referencedRelation: "suppliers"
      referencedColumns: ["id","account_id"]
    }
                  ]
                },"quick_access": {
                  Row: {
                    "bundle_id": string | null,"color": string | null,"position": number,"product_id": string | null,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bundle_id"?: string | null,"color"?: string | null,"position": number,"product_id"?: string | null,"store_id": string
                  }
                  Update: {
                    "bundle_id"?: string | null,"color"?: string | null,"position"?: number,"product_id"?: string | null,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quick_access_bundle_id_fkey"
      columns: ["bundle_id"]
isOneToOne: false
      referencedRelation: "bundles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quick_access_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quick_access_store_id_fkey"
      columns: ["store_id"]
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
                },"sale_items": {
                  Row: {
                    "bundle_id": string | null,"id": string,"name": string,"product_id": string | null,"quantity": number,"sale_id": string,"sold_without_stock": boolean,"stock_from_tab": boolean,"store_id": string,"total": number,"unit_cost": number,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bundle_id"?: string | null,"id"?: string,"name": string,"product_id"?: string | null,"quantity": number,"sale_id": string,"sold_without_stock"?: boolean,"stock_from_tab"?: boolean,"store_id": string,"total": number,"unit_cost"?: number,"unit_price": number
                  }
                  Update: {
                    "bundle_id"?: string | null,"id"?: string,"name"?: string,"product_id"?: string | null,"quantity"?: number,"sale_id"?: string,"sold_without_stock"?: boolean,"stock_from_tab"?: boolean,"store_id"?: string,"total"?: number,"unit_cost"?: number,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_items_bundle_id_fkey"
      columns: ["bundle_id"]
isOneToOne: false
      referencedRelation: "bundles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sale_items_sale_id_store_id_fkey"
      columns: ["sale_id","store_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id","store_id"]
    }
                  ]
                },"sale_payments": {
                  Row: {
                    "amount": number,"change_given": number,"id": string,"method": Database["app"]['Enums']["pay_method"],"sale_id": string,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"change_given"?: number,"id"?: string,"method": Database["app"]['Enums']["pay_method"],"sale_id": string,"store_id": string
                  }
                  Update: {
                    "amount"?: number,"change_given"?: number,"id"?: string,"method"?: Database["app"]['Enums']["pay_method"],"sale_id"?: string,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sale_payments_sale_id_store_id_fkey"
      columns: ["sale_id","store_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id","store_id"]
    }
                  ]
                },"sales": {
                  Row: {
                    "account_id": string,"business_date": string,"cancel_reason": string | null,"canceled_at": string | null,"canceled_by": string | null,"cash_session_id": string | null,"channel": string,"client_request_id": string,"created_at": string,"delivery_fee": number,"discount": number,"discount_authorized_by": string | null,"fiado_account_id": string | null,"id": string,"number": number,"operator_member_id": string | null,"order_id": string | null,"origin": string,"status": string,"store_id": string,"subtotal": number,"tab_id": string | null,"terminal_id": string | null,"total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"business_date": string,"cancel_reason"?: string | null,"canceled_at"?: string | null,"canceled_by"?: string | null,"cash_session_id"?: string | null,"channel"?: string,"client_request_id": string,"created_at"?: string,"delivery_fee"?: number,"discount"?: number,"discount_authorized_by"?: string | null,"fiado_account_id"?: string | null,"id"?: string,"number": number,"operator_member_id"?: string | null,"order_id"?: string | null,"origin"?: string,"status"?: string,"store_id": string,"subtotal": number,"tab_id"?: string | null,"terminal_id"?: string | null,"total": number
                  }
                  Update: {
                    "account_id"?: string,"business_date"?: string,"cancel_reason"?: string | null,"canceled_at"?: string | null,"canceled_by"?: string | null,"cash_session_id"?: string | null,"channel"?: string,"client_request_id"?: string,"created_at"?: string,"delivery_fee"?: number,"discount"?: number,"discount_authorized_by"?: string | null,"fiado_account_id"?: string | null,"id"?: string,"number"?: number,"operator_member_id"?: string | null,"order_id"?: string | null,"origin"?: string,"status"?: string,"store_id"?: string,"subtotal"?: number,"tab_id"?: string | null,"terminal_id"?: string | null,"total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_canceled_by_store_id_fkey"
      columns: ["canceled_by","store_id"]
isOneToOne: false
      referencedRelation: "store_members"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "sales_cash_session_id_store_id_fkey"
      columns: ["cash_session_id","store_id"]
isOneToOne: false
      referencedRelation: "cash_sessions"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "sales_discount_authorized_by_store_id_fkey"
      columns: ["discount_authorized_by","store_id"]
isOneToOne: false
      referencedRelation: "store_members"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "sales_fiado_account_id_store_id_fkey"
      columns: ["fiado_account_id","store_id"]
isOneToOne: false
      referencedRelation: "fiado_accounts"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "sales_operator_member_id_store_id_fkey"
      columns: ["operator_member_id","store_id"]
isOneToOne: false
      referencedRelation: "store_members"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "sales_order_fk"
      columns: ["order_id","store_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "sales_store_id_account_id_fkey"
      columns: ["store_id","account_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id","account_id"]
    },{
      foreignKeyName: "sales_tab_id_store_id_fkey"
      columns: ["tab_id","store_id"]
isOneToOne: false
      referencedRelation: "tabs"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "sales_terminal_id_store_id_fkey"
      columns: ["terminal_id","store_id"]
isOneToOne: false
      referencedRelation: "terminals"
      referencedColumns: ["id","store_id"]
    }
                  ]
                },"stock_count_items": {
                  Row: {
                    "count_id": string,"counted_at": string,"counted_qty": number,"product_id": string,"store_id": string,"system_qty_at_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "count_id": string,"counted_at"?: string,"counted_qty": number,"product_id": string,"store_id": string,"system_qty_at_count": number
                  }
                  Update: {
                    "count_id"?: string,"counted_at"?: string,"counted_qty"?: number,"product_id"?: string,"store_id"?: string,"system_qty_at_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_count_items_count_id_store_id_fkey"
      columns: ["count_id","store_id"]
isOneToOne: false
      referencedRelation: "stock_counts"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "stock_count_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_counts": {
                  Row: {
                    "applied_at": string | null,"created_at": string,"created_by": string | null,"id": string,"status": string,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "applied_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"status"?: string,"store_id": string
                  }
                  Update: {
                    "applied_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"status"?: string,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_counts_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_lots": {
                  Row: {
                    "account_id": string,"code": string | null,"created_at": string,"expires_on": string | null,"id": string,"initial_qty": number,"product_id": string,"remaining_qty": number,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"code"?: string | null,"created_at"?: string,"expires_on"?: string | null,"id"?: string,"initial_qty": number,"product_id": string,"remaining_qty": number,"store_id": string
                  }
                  Update: {
                    "account_id"?: string,"code"?: string | null,"created_at"?: string,"expires_on"?: string | null,"id"?: string,"initial_qty"?: number,"product_id"?: string,"remaining_qty"?: number,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_lots_product_id_account_id_fkey"
      columns: ["product_id","account_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","account_id"]
    },{
      foreignKeyName: "stock_lots_store_id_account_id_fkey"
      columns: ["store_id","account_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id","account_id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "account_id": string,"created_at": string,"created_by": string | null,"id": string,"lot_id": string | null,"operator_member_id": string | null,"product_id": string,"quantity": number,"reason": string | null,"ref_id": string | null,"ref_type": string | null,"store_id": string,"type": Database["app"]['Enums']["stock_movement_type"],"unit_cost": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"lot_id"?: string | null,"operator_member_id"?: string | null,"product_id": string,"quantity": number,"reason"?: string | null,"ref_id"?: string | null,"ref_type"?: string | null,"store_id": string,"type": Database["app"]['Enums']["stock_movement_type"],"unit_cost"?: number | null
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"lot_id"?: string | null,"operator_member_id"?: string | null,"product_id"?: string,"quantity"?: number,"reason"?: string | null,"ref_id"?: string | null,"ref_type"?: string | null,"store_id"?: string,"type"?: Database["app"]['Enums']["stock_movement_type"],"unit_cost"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_lot_id_store_id_fkey"
      columns: ["lot_id","store_id"]
isOneToOne: false
      referencedRelation: "stock_lots"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "stock_movements_product_id_account_id_fkey"
      columns: ["product_id","account_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","account_id"]
    },{
      foreignKeyName: "stock_movements_store_id_account_id_fkey"
      columns: ["store_id","account_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id","account_id"]
    }
                  ]
                },"store_bundles": {
                  Row: {
                    "account_id": string,"active": boolean,"bundle_id": string,"price": number | null,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"active"?: boolean,"bundle_id": string,"price"?: number | null,"store_id": string
                  }
                  Update: {
                    "account_id"?: string,"active"?: boolean,"bundle_id"?: string,"price"?: number | null,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_bundles_bundle_id_account_id_fkey"
      columns: ["bundle_id","account_id"]
isOneToOne: false
      referencedRelation: "bundles"
      referencedColumns: ["id","account_id"]
    },{
      foreignKeyName: "store_bundles_store_id_account_id_fkey"
      columns: ["store_id","account_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id","account_id"]
    }
                  ]
                },"store_counters": {
                  Row: {
                    "name": string,"store_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "name": string,"store_id": string,"value"?: number
                  }
                  Update: {
                    "name"?: string,"store_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_counters_store_id_fkey"
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
                },"store_products": {
                  Row: {
                    "account_id": string,"active": boolean,"min_stock": number | null,"price": number | null,"product_id": string,"store_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"active"?: boolean,"min_stock"?: number | null,"price"?: number | null,"product_id": string,"store_id": string,"updated_at"?: string
                  }
                  Update: {
                    "account_id"?: string,"active"?: boolean,"min_stock"?: number | null,"price"?: number | null,"product_id"?: string,"store_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "store_products_product_id_account_id_fkey"
      columns: ["product_id","account_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","account_id"]
    },{
      foreignKeyName: "store_products_store_id_account_id_fkey"
      columns: ["store_id","account_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id","account_id"]
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
                },"suppliers": {
                  Row: {
                    "account_id": string,"active": boolean,"created_at": string,"id": string,"kind": string | null,"lead_time": string | null,"name": string,"note": string | null,"phone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "account_id": string,"active"?: boolean,"created_at"?: string,"id"?: string,"kind"?: string | null,"lead_time"?: string | null,"name": string,"note"?: string | null,"phone"?: string | null
                  }
                  Update: {
                    "account_id"?: string,"active"?: boolean,"created_at"?: string,"id"?: string,"kind"?: string | null,"lead_time"?: string | null,"name"?: string,"note"?: string | null,"phone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "suppliers_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "accounts"
      referencedColumns: ["id"]
    }
                  ]
                },"tab_items": {
                  Row: {
                    "added_at": string,"added_by": string | null,"bundle_id": string | null,"id": string,"name": string,"product_id": string | null,"quantity": number,"remove_reason": string | null,"removed_at": string | null,"removed_by": string | null,"store_id": string,"tab_id": string,"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"added_by"?: string | null,"bundle_id"?: string | null,"id"?: string,"name": string,"product_id"?: string | null,"quantity": number,"remove_reason"?: string | null,"removed_at"?: string | null,"removed_by"?: string | null,"store_id": string,"tab_id": string,"unit_price": number
                  }
                  Update: {
                    "added_at"?: string,"added_by"?: string | null,"bundle_id"?: string | null,"id"?: string,"name"?: string,"product_id"?: string | null,"quantity"?: number,"remove_reason"?: string | null,"removed_at"?: string | null,"removed_by"?: string | null,"store_id"?: string,"tab_id"?: string,"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tab_items_added_by_store_id_fkey"
      columns: ["added_by","store_id"]
isOneToOne: false
      referencedRelation: "store_members"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "tab_items_bundle_id_fkey"
      columns: ["bundle_id"]
isOneToOne: false
      referencedRelation: "bundles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tab_items_product_id_fkey"
      columns: ["product_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tab_items_removed_by_store_id_fkey"
      columns: ["removed_by","store_id"]
isOneToOne: false
      referencedRelation: "store_members"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "tab_items_tab_id_store_id_fkey"
      columns: ["tab_id","store_id"]
isOneToOne: false
      referencedRelation: "tabs"
      referencedColumns: ["id","store_id"]
    }
                  ]
                },"tabs": {
                  Row: {
                    "closed_at": string | null,"id": string,"kind": string,"label": string,"nickname": string | null,"opened_at": string,"opened_by": string | null,"sale_id": string | null,"status": string,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"id"?: string,"kind": string,"label": string,"nickname"?: string | null,"opened_at"?: string,"opened_by"?: string | null,"sale_id"?: string | null,"status"?: string,"store_id": string
                  }
                  Update: {
                    "closed_at"?: string | null,"id"?: string,"kind"?: string,"label"?: string,"nickname"?: string | null,"opened_at"?: string,"opened_by"?: string | null,"sale_id"?: string | null,"status"?: string,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tabs_opened_by_store_id_fkey"
      columns: ["opened_by","store_id"]
isOneToOne: false
      referencedRelation: "store_members"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "tabs_sale_fk"
      columns: ["sale_id","store_id"]
isOneToOne: false
      referencedRelation: "sales"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "tabs_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"terminals": {
                  Row: {
                    "active": boolean,"auth_user_id": string | null,"created_at": string,"id": string,"last_seen_at": string | null,"name": string,"registered_by": string | null,"revoked_at": string | null,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"auth_user_id"?: string | null,"created_at"?: string,"id"?: string,"last_seen_at"?: string | null,"name": string,"registered_by"?: string | null,"revoked_at"?: string | null,"store_id": string
                  }
                  Update: {
                    "active"?: boolean,"auth_user_id"?: string | null,"created_at"?: string,"id"?: string,"last_seen_at"?: string | null,"name"?: string,"registered_by"?: string | null,"revoked_at"?: string | null,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "terminals_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_legal":
{ Args: { "p_account_id"?: string,"p_documents": (string)[],"p_version": string }; Returns: Json
                           },
"add_alert_recipient":
{ Args: { "p_phone": string,"p_store_id": string }; Returns: Json
                           },
"add_products_from_catalog":
{ Args: { "p_items": Json,"p_store_id": string }; Returns: Json
                           },
"add_tab_item":
{ Args: { "p_bundle_id": string,"p_operator_session_id": string,"p_product_id": string,"p_quantity": number,"p_tab_id": string }; Returns: Json
                           },
"apply_stock_count":
{ Args: { "p_count_id": string }; Returns: Json
                           },
"archive_bundle":
{ Args: { "p_account_id": string,"p_bundle_id": string }; Returns: Json
                           },
"assign_courier":
{ Args: { "p_member_id": string,"p_order_id": string }; Returns: Json
                           },
"attach_ticket_file":
{ Args: { "p_name"?: string,"p_path": string,"p_ticket_id": string }; Returns: Json
                           },
"bills_list":
{ Args: { "p_only_open"?: boolean,"p_store_id": string }; Returns: Json
                           },
"can_create_member":
{ Args: { "p_role": Database["app"]['Enums']["member_role"],"p_store_id": string }; Returns: Json
                           },
"cancel_sale":
{ Args: { "p_operator_session_id": string,"p_reason": string,"p_sale_id": string }; Returns: Json
                           },
"cash_movement":
{ Args: { "p_amount": number,"p_operator_session_id": string,"p_reason": string,"p_type": string }; Returns: Json
                           },
"close_cash":
{ Args: { "p_counted_cash": number,"p_note"?: string,"p_operator_session_id": string }; Returns: Json
                           },
"close_tab":
{ Args: { "p": Json,"p_tab_id": string }; Returns: Json
                           },
"complete_onboarding":
{ Args: { "p_city"?: string,"p_neighborhood"?: string,"p_origin"?: Json,"p_owner_name"?: string,"p_store_name": string,"p_whatsapp"?: string }; Returns: Json
                           },
"complete_order":
{ Args: { "p": Json,"p_order_id": string }; Returns: Json
                           },
"confirm_account_deletion":
{ Args: { "p_token": string }; Returns: Json
                           },
"courier_update":
{ Args: { "p_order_id": string,"p_status": string }; Returns: Json
                           },
"create_counter_member":
{ Args: { "p_display_name": string,"p_role": Database["app"]['Enums']["member_role"],"p_store_id": string }; Returns: Json
                           },
"create_fiado_account":
{ Args: { "p_credit_limit"?: number,"p_name": string,"p_phone": string,"p_promised_date"?: string,"p_store_id": string }; Returns: Json
                           },
"create_order":
{ Args: { "p": Json,"p_store_id": string }; Returns: Json
                           },
"create_pairing_code":
{ Args: { "p_store_id": string,"p_terminal_name": string }; Returns: Json
                           },
"create_store":
{ Args: { "p_account_id": string,"p_city"?: string,"p_name": string,"p_neighborhood"?: string,"p_whatsapp"?: string }; Returns: Json
                           },
"dashboard_today":
{ Args: { "p_store_id": string }; Returns: Json
                           },
"discard_empty_tab":
{ Args: { "p_operator_session_id": string,"p_tab_id": string }; Returns: Json
                           },
"drink_costs":
{ Args: { "p_account_id": string }; Returns: Json
                           },
"export_account_data":
{ Args: { "p_account_id": string }; Returns: Json
                           },
"fiado_accounts_list":
{ Args: { "p_store_id": string }; Returns: Json
                           },
"fiado_list":
{ Args: { "p_store_id": string }; Returns: Json
                           },
"finalize_sale":
{ Args: { "p": Json }; Returns: Json
                           },
"find_fiado":
{ Args: { "p_query": string,"p_store_id": string }; Returns: Json
                           },
"mark_alerts_read":
{ Args: { "p_alert_ids"?: (string)[],"p_store_id": string }; Returns: Json
                           },
"merge_fiado":
{ Args: { "p_from": string,"p_into": string,"p_store_id": string }; Returns: Json
                           },
"must_change_password":
{ Args: Record<PropertyKey, never>; Returns: boolean
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
"my_tickets":
{ Args: { "p_account_id": string }; Returns: Json
                           },
"open_cash":
{ Args: { "p_opening_float"?: number,"p_operator_session_id": string }; Returns: Json
                           },
"open_stock_count":
{ Args: { "p_store_id": string }; Returns: Json
                           },
"open_tab":
{ Args: { "p_kind": string,"p_label": string,"p_nickname"?: string,"p_operator_session_id": string }; Returns: Json
                           },
"open_ticket":
{ Args: { "p_account_id": string,"p_correlation_ids"?: (string)[],"p_description": string,"p_kind": string,"p_store_id": string,"p_subject": string,"p_urgency"?: string }; Returns: Json
                           },
"operator_login":
{ Args: { "p_member_id": string }; Returns: Json
                           },
"operator_logout":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"pay_bill":
{ Args: { "p_bill_id": string,"p_method": string,"p_paid_on"?: string }; Returns: Json
                           },
"plan_prices":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"public_catalog":
{ Args: { "p_slug": string }; Returns: Json
                           },
"purchase_suggestion":
{ Args: { "p_coverage_days"?: number,"p_lookback_days"?: number,"p_store_id": string }; Returns: Json
                           },
"receive_fiado_by_member":
{ Args: { "p_amount": number,"p_fiado_account_id": string,"p_method": string,"p_store_id": string }; Returns: Json
                           },
"receive_fiado_payment":
{ Args: { "p_amount": number,"p_fiado_account_id": string,"p_method": string,"p_operator_session_id": string }; Returns: Json
                           },
"receive_goods":
{ Args: { "p_items": Json,"p_note"?: string,"p_purchase_order_id"?: string,"p_store_id": string,"p_supplier_id"?: string }; Returns: Json
                           },
"receive_purchase_order":
{ Args: { "p_items": Json,"p_purchase_order_id": string }; Returns: Json
                           },
"register_stock_change":
{ Args: { "p_kind": string,"p_product_id": string,"p_quantity": number,"p_reason": string,"p_store_id": string }; Returns: Json
                           },
"remove_tab_item":
{ Args: { "p_operator_session_id": string,"p_reason": string,"p_tab_item_id": string }; Returns: Json
                           },
"rename_tab":
{ Args: { "p_label": string,"p_operator_session_id": string,"p_tab_id": string }; Returns: Json
                           },
"reply_ticket":
{ Args: { "p_body": string,"p_ticket_id": string }; Returns: Json
                           },
"report_sales":
{ Args: { "p_from": string,"p_store_id": string,"p_to": string }; Returns: Json
                           },
"request_account_deletion":
{ Args: { "p_account_id": string }; Returns: Json
                           },
"request_cancellation":
{ Args: { "p_account_id": string,"p_undo"?: boolean }; Returns: Json
                           },
"revoke_terminal":
{ Args: { "p_terminal_id": string }; Returns: Json
                           },
"sale_receipt":
{ Args: { "p_sale_id": string }; Returns: Json
                           },
"save_alert_setting":
{ Args: { "p_enabled": boolean,"p_quiet_end"?: string,"p_quiet_start"?: string,"p_store_id": string,"p_threshold"?: number,"p_type": string }; Returns: Json
                           },
"save_bill":
{ Args: { "p_bill": Json,"p_store_id": string }; Returns: Json
                           },
"save_bundle":
{ Args: { "p_account_id": string,"p_bundle": Json }; Returns: Json
                           },
"save_category":
{ Args: { "p_account_id": string,"p_color"?: string,"p_id"?: string,"p_name": string,"p_sort"?: number }; Returns: Json
                           },
"save_count_item":
{ Args: { "p_count_id": string,"p_counted": number,"p_product_id": string }; Returns: Json
                           },
"save_drink_recipe":
{ Args: { "p_account_id": string,"p_recipe": Json }; Returns: Json
                           },
"save_product":
{ Args: { "p_account_id": string,"p_product": Json }; Returns: Json
                           },
"save_purchase_order":
{ Args: { "p_expected_on"?: string,"p_items": Json,"p_note"?: string,"p_status"?: string,"p_store_id": string,"p_supplier_id": string }; Returns: Json
                           },
"save_supplier":
{ Args: { "p_account_id": string,"p_supplier": Json }; Returns: Json
                           },
"search_catalog":
{ Args: { "p_limit"?: number,"p_query": string }; Returns: Json
                           },
"set_marketing_consent":
{ Args: { "p_account_id": string,"p_channel": string,"p_granted": boolean }; Returns: Json
                           },
"set_order_status":
{ Args: { "p_operator_session_id"?: string,"p_order_id": string,"p_reason"?: string,"p_status": string }; Returns: Json
                           },
"set_quick_access":
{ Args: { "p_items": Json,"p_store_id": string }; Returns: Json
                           },
"set_role_discount_limit":
{ Args: { "p_max_pct": number,"p_role": Database["app"]['Enums']["member_role"],"p_store_id": string }; Returns: Json
                           },
"set_role_permission":
{ Args: { "p_allowed": boolean,"p_permission": string,"p_role": Database["app"]['Enums']["member_role"],"p_store_id": string }; Returns: Json
                           },
"set_store_product":
{ Args: { "p_active"?: boolean,"p_min_stock"?: number,"p_price"?: number,"p_product_id": string,"p_store_id": string }; Returns: Json
                           },
"store_products_list":
{ Args: { "p_only_active"?: boolean,"p_query"?: string,"p_store_id": string }; Returns: Json
                           },
"track_event":
{ Args: { "p_name": string,"p_props"?: Json,"p_store_id"?: string }; Returns: Json
                           },
"transfer_stock":
{ Args: { "p_from_store": string,"p_items": Json,"p_note"?: string,"p_to_store": string }; Returns: Json
                           },
"update_catalog_settings":
{ Args: { "p_enabled": boolean,"p_message"?: string,"p_show_price"?: boolean,"p_show_stock"?: boolean,"p_store_id": string }; Returns: Json
                           },
"update_fiado":
{ Args: { "p_clear_limit"?: boolean,"p_credit_limit"?: number,"p_fiado_account_id": string,"p_note"?: string,"p_promised_date"?: string,"p_store_id": string }; Returns: Json
                           },
"update_member":
{ Args: { "p_active"?: boolean,"p_display_name"?: string,"p_member_id": string,"p_role"?: Database["app"]['Enums']["member_role"] }; Returns: Json
                           },
"update_store_settings":
{ Args: { "p": Json,"p_store_id": string }; Returns: Json
                           },
"verify_alert_recipient":
{ Args: { "p_code": string,"p_phone": string,"p_store_id": string }; Returns: Json
                           }
          }
          Enums: {
            "cash_movement_type": "opening"|"sale_cash_in"|"change_out"|"withdrawal"|"reinforcement"|"courier_payment"|"sale_cancel_refund"|"fiado_payment_in"|"adjustment","member_role": "owner"|"manager"|"cashier"|"stock_keeper"|"courier","pay_method": "pix"|"credit"|"debit"|"cash"|"fiado","stock_movement_type": "initial"|"entry"|"sale"|"sale_cancel"|"adjustment"|"count_adjustment"|"loss"|"transfer_out"|"transfer_in"|"order"|"order_cancel"|"tab"|"tab_remove"
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
            "cash_movement_type": ["opening", "sale_cash_in", "change_out", "withdrawal", "reinforcement", "courier_payment", "sale_cancel_refund", "fiado_payment_in", "adjustment"],"member_role": ["owner", "manager", "cashier", "stock_keeper", "courier"],"pay_method": ["pix", "credit", "debit", "cash", "fiado"],"stock_movement_type": ["initial", "entry", "sale", "sale_cancel", "adjustment", "count_adjustment", "loss", "transfer_out", "transfer_in", "order", "order_cancel", "tab", "tab_remove"]
          }
        },"graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
