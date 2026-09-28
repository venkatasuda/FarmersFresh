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
      banners: {
        Row: {
          bg_from: string
          bg_to: string
          created_at: string
          cta_label: string | null
          ends_at: string | null
          href: string | null
          id: string
          image_path: string | null
          is_active: boolean
          org_id: string
          sort_order: number
          starts_at: string | null
          subtitle: string | null
          title: string
        }
        Insert: {
          bg_from?: string
          bg_to?: string
          created_at?: string
          cta_label?: string | null
          ends_at?: string | null
          href?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          org_id: string
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title: string
        }
        Update: {
          bg_from?: string
          bg_to?: string
          created_at?: string
          cta_label?: string | null
          ends_at?: string | null
          href?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          org_id?: string
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_house_brand: boolean
          is_primary: boolean
          name: string
          org_id: string
          slug: string
          sort_order: number
          tagline: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_house_brand?: boolean
          is_primary?: boolean
          name: string
          org_id: string
          slug: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_house_brand?: boolean
          is_primary?: boolean
          name?: string
          org_id?: string
          slug?: string
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_affinity: {
        Row: {
          from_slug: string
          org_id: string
          to_slug: string
          weight: number
        }
        Insert: {
          from_slug: string
          org_id: string
          to_slug: string
          weight?: number
        }
        Update: {
          from_slug?: string
          org_id?: string
          to_slug?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_affinity_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          id: string
          name: string
          state_id: string
        }
        Insert: {
          id?: string
          name: string
          state_id: string
        }
        Update: {
          id?: string
          name?: string
          state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      cold_chain_logs: {
        Row: {
          actor_id: string | null
          area: string
          breach: boolean
          created_at: string
          id: string
          location_id: string
          note: string | null
          org_id: string
          target_max: number | null
          target_min: number | null
          temp_c: number
        }
        Insert: {
          actor_id?: string | null
          area: string
          breach?: boolean
          created_at?: string
          id?: string
          location_id: string
          note?: string | null
          org_id: string
          target_max?: number | null
          target_min?: number | null
          temp_c: number
        }
        Update: {
          actor_id?: string | null
          area?: string
          breach?: boolean
          created_at?: string
          id?: string
          location_id?: string
          note?: string | null
          org_id?: string
          target_max?: number | null
          target_min?: number | null
          temp_c?: number
        }
        Relationships: [
          {
            foreignKeyName: "cold_chain_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cold_chain_logs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cold_chain_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          kind: string
          max_discount: number | null
          min_subtotal: number
          org_id: string
          per_phone_limit: number
          starts_at: string | null
          usage_limit: number | null
          used_count: number
          user_id: string | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind: string
          max_discount?: number | null
          min_subtotal?: number
          org_id: string
          per_phone_limit?: number
          starts_at?: string | null
          usage_limit?: number | null
          used_count?: number
          user_id?: string | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          max_discount?: number | null
          min_subtotal?: number
          org_id?: string
          per_phone_limit?: number
          starts_at?: string | null
          usage_limit?: number | null
          used_count?: number
          user_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_line: string
          city: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          landmark: string | null
          lat: number | null
          lng: number | null
          pincode: string | null
          user_id: string
        }
        Insert: {
          address_line: string
          city?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          lat?: number | null
          lng?: number | null
          pincode?: string | null
          user_id: string
        }
        Update: {
          address_line?: string
          city?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          lat?: number | null
          lng?: number | null
          pincode?: string | null
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          id: string
          location_id: string
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          area_name: string | null
          created_at: string
          delivery_fee: number | null
          id: string
          is_active: boolean
          org_id: string
          pincode: string
        }
        Insert: {
          area_name?: string | null
          created_at?: string
          delivery_fee?: number | null
          id?: string
          is_active?: boolean
          org_id: string
          pincode: string
        }
        Update: {
          area_name?: string | null
          created_at?: string
          delivery_fee?: number | null
          id?: string
          is_active?: boolean
          org_id?: string
          pincode?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          event_type: string
          id: number
          location_id: string | null
          org_id: string
          payload: Json
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type: string
          id?: never
          location_id?: string | null
          org_id: string
          payload?: Json
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          event_type?: string
          id?: never
          location_id?: string | null
          org_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          kind: string
          location: string | null
          name: string
          notes: string | null
          org_id: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          kind?: string
          location?: string | null
          name: string
          notes?: string | null
          org_id: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          kind?: string
          location?: string | null
          name?: string
          notes?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "farms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          code: string
          created_at: string
          id: string
          org_id: string
          redeemed_at: string | null
          redeemed_by: string | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          org_id: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          org_id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hamper_items: {
        Row: {
          hamper_id: string
          id: string
          product_id: string
          qty: number
        }
        Insert: {
          hamper_id: string
          id?: string
          product_id: string
          qty: number
        }
        Update: {
          hamper_id?: string
          id?: string
          product_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "hamper_items_hamper_id_fkey"
            columns: ["hamper_id"]
            isOneToOne: false
            referencedRelation: "hampers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hamper_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      hampers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_published: boolean
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_published?: boolean
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_published?: boolean
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hampers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          city_id: string | null
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          type: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      markdowns: {
        Row: {
          active: boolean
          clearance_price: number
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          org_id: string
          orig_badge: string | null
          orig_compare_at: number | null
          orig_sale_price: number
          product_id: string
          reason: string | null
        }
        Insert: {
          active?: boolean
          clearance_price: number
          created_at?: string
          created_by?: string | null
          ends_on: string
          id?: string
          org_id: string
          orig_badge?: string | null
          orig_compare_at?: number | null
          orig_sale_price: number
          product_id: string
          reason?: string | null
        }
        Update: {
          active?: boolean
          clearance_price?: number
          created_at?: string
          created_by?: string | null
          ends_on?: string
          id?: string
          org_id?: string
          orig_badge?: string | null
          orig_compare_at?: number | null
          orig_sale_price?: number
          product_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "markdowns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markdowns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "markdowns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          created_at: string
          discount_percent: number
          duration_days: number
          id: string
          is_active: boolean
          name: string
          org_id: string
          price: number
        }
        Insert: {
          created_at?: string
          discount_percent?: number
          duration_days: number
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          price: number
        }
        Update: {
          created_at?: string
          discount_percent?: number
          duration_days?: number
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          location_id: string
          on_shift: boolean
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          on_shift?: boolean
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          on_shift?: boolean
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempts: number
          channel: string
          claimed_at: string | null
          created_at: string
          id: number
          last_error: string | null
          org_id: string
          payload: Json
          recipient: string
          sent_at: string | null
          status: string
          template: string
        }
        Insert: {
          attempts?: number
          channel: string
          claimed_at?: string | null
          created_at?: string
          id?: never
          last_error?: string | null
          org_id: string
          payload?: Json
          recipient: string
          sent_at?: string | null
          status?: string
          template: string
        }
        Update: {
          attempts?: number
          channel?: string
          claimed_at?: string | null
          created_at?: string
          id?: never
          last_error?: string | null
          org_id?: string
          payload?: Json
          recipient?: string
          sent_at?: string | null
          status?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number | null
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number | null
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit?: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number | null
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_lat: number | null
          address_line: string
          address_lng: number | null
          assigned_at: string | null
          assigned_to: string | null
          cancelled_reason: string | null
          city: string | null
          confirmed_at: string | null
          contact_email: string | null
          contact_name: string
          contact_phone: string
          coupon_code: string | null
          created_at: string
          credit_used: number
          customer_id: string | null
          delivered_at: string | null
          delivery_comment: string | null
          delivery_fee: number
          delivery_rating: number | null
          delivery_slot: string | null
          discount: number
          eta_minutes: number | null
          eta_set_at: string | null
          id: string
          is_paid: boolean
          landmark: string | null
          location_id: string | null
          notes: string | null
          order_number: string
          org_id: string
          paid_at: string | null
          payment_method: string
          pincode: string | null
          placed_at: string
          rated_at: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          rider_lat: number | null
          rider_lng: number | null
          rider_location_at: string | null
          sale_id: string | null
          status: string
          subtotal: number
          tip_points: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address_lat?: number | null
          address_line: string
          address_lng?: number | null
          assigned_at?: string | null
          assigned_to?: string | null
          cancelled_reason?: string | null
          city?: string | null
          confirmed_at?: string | null
          contact_email?: string | null
          contact_name: string
          contact_phone: string
          coupon_code?: string | null
          created_at?: string
          credit_used?: number
          customer_id?: string | null
          delivered_at?: string | null
          delivery_comment?: string | null
          delivery_fee?: number
          delivery_rating?: number | null
          delivery_slot?: string | null
          discount?: number
          eta_minutes?: number | null
          eta_set_at?: string | null
          id?: string
          is_paid?: boolean
          landmark?: string | null
          location_id?: string | null
          notes?: string | null
          order_number: string
          org_id: string
          paid_at?: string | null
          payment_method?: string
          pincode?: string | null
          placed_at?: string
          rated_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          rider_lat?: number | null
          rider_lng?: number | null
          rider_location_at?: string | null
          sale_id?: string | null
          status?: string
          subtotal?: number
          tip_points?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address_lat?: number | null
          address_line?: string
          address_lng?: number | null
          assigned_at?: string | null
          assigned_to?: string | null
          cancelled_reason?: string | null
          city?: string | null
          confirmed_at?: string | null
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string
          coupon_code?: string | null
          created_at?: string
          credit_used?: number
          customer_id?: string | null
          delivered_at?: string | null
          delivery_comment?: string | null
          delivery_fee?: number
          delivery_rating?: number | null
          delivery_slot?: string | null
          discount?: number
          eta_minutes?: number | null
          eta_set_at?: string | null
          id?: string
          is_paid?: boolean
          landmark?: string | null
          location_id?: string | null
          notes?: string | null
          order_number?: string
          org_id?: string
          paid_at?: string | null
          payment_method?: string
          pincode?: string | null
          placed_at?: string
          rated_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          rider_lat?: number | null
          rider_lng?: number | null
          rider_location_at?: string | null
          sale_id?: string | null
          status?: string
          subtotal?: number
          tip_points?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          business_address: string | null
          created_at: string
          delivery_fee: number
          free_delivery_threshold: number
          gstin: string | null
          id: string
          max_discount_percent: number
          name: string
          notify_email: string | null
          notify_phone: string | null
          slug: string | null
          storefront_enabled: boolean
          storefront_location_id: string | null
          subscription_discount_percent: number
          support_email: string | null
          support_phone: string | null
          updated_at: string
        }
        Insert: {
          business_address?: string | null
          created_at?: string
          delivery_fee?: number
          free_delivery_threshold?: number
          gstin?: string | null
          id?: string
          max_discount_percent?: number
          name: string
          notify_email?: string | null
          notify_phone?: string | null
          slug?: string | null
          storefront_enabled?: boolean
          storefront_location_id?: string | null
          subscription_discount_percent?: number
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
        }
        Update: {
          business_address?: string | null
          created_at?: string
          delivery_fee?: number
          free_delivery_threshold?: number
          gstin?: string | null
          id?: string
          max_discount_percent?: number
          name?: string
          notify_email?: string | null
          notify_phone?: string | null
          slug?: string | null
          storefront_enabled?: boolean
          storefront_location_id?: string | null
          subscription_discount_percent?: number
          support_email?: string | null
          support_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_storefront_location_id_fkey"
            columns: ["storefront_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      pass_memberships: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          org_id: string
          plan_id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          starts_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          org_id: string
          plan_id: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          starts_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          org_id?: string
          plan_id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          starts_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pass_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pass_memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount: number | null
          created_at: string
          event: string | null
          id: string
          org_id: string | null
          raw: Json | null
          razorpay_order_id: string | null
          razorpay_payment_id: string
          status: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          event?: string | null
          id?: string
          org_id?: string | null
          raw?: Json | null
          razorpay_order_id?: string | null
          razorpay_payment_id: string
          status?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          event?: string | null
          id?: string
          org_id?: string | null
          raw?: Json | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string
          status?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          location_id: string
          method: string
          org_id: string
          paid_at: string
          sale_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          location_id: string
          method?: string
          org_id: string
          paid_at?: string
          sale_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          location_id?: string
          method?: string
          org_id?: string
          paid_at?: string
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          batch_code: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          farm_id: string | null
          id: string
          location_id: string | null
          notes: string | null
          org_id: string
          po_id: string | null
          product_id: string
          quantity: number | null
          received_qty: number
          remaining_qty: number
          source: string
          source_date: string | null
          status: string
          supplier_id: string | null
          unit_cost: number
        }
        Insert: {
          batch_code: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          farm_id?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          org_id: string
          po_id?: string | null
          product_id: string
          quantity?: number | null
          received_qty?: number
          remaining_qty?: number
          source?: string
          source_date?: string | null
          status?: string
          supplier_id?: string | null
          unit_cost?: number
        }
        Update: {
          batch_code?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          farm_id?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          org_id?: string
          po_id?: string | null
          product_id?: string
          quantity?: number | null
          received_qty?: number
          remaining_qty?: number
          source?: string
          source_date?: string | null
          status?: string
          supplier_id?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badge: string | null
          brand: string | null
          brand_id: string | null
          category: string | null
          category_id: string | null
          category_slug: string | null
          category_sort: number
          compare_at_price: number | null
          created_at: string
          description: string | null
          diet_tags: string[]
          id: string
          image_path: string | null
          is_active: boolean
          is_published: boolean
          last_cost: number | null
          min_order_qty: number
          name: string
          org_id: string
          pack_size: number | null
          pack_unit: string | null
          sale_price: number | null
          slug: string | null
          sort_order: number
          step_qty: number
          unit: string
          updated_at: string
        }
        Insert: {
          badge?: string | null
          brand?: string | null
          brand_id?: string | null
          category?: string | null
          category_id?: string | null
          category_slug?: string | null
          category_sort?: number
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          diet_tags?: string[]
          id?: string
          image_path?: string | null
          is_active?: boolean
          is_published?: boolean
          last_cost?: number | null
          min_order_qty?: number
          name: string
          org_id: string
          pack_size?: number | null
          pack_unit?: string | null
          sale_price?: number | null
          slug?: string | null
          sort_order?: number
          step_qty?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          badge?: string | null
          brand?: string | null
          brand_id?: string | null
          category?: string | null
          category_id?: string | null
          category_slug?: string | null
          category_sort?: number
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          diet_tags?: string[]
          id?: string
          image_path?: string | null
          is_active?: boolean
          is_published?: boolean
          last_cost?: number | null
          min_order_qty?: number
          name?: string
          org_id?: string
          pack_size?: number | null
          pack_unit?: string | null
          sale_price?: number | null
          slug?: string | null
          sort_order?: number
          step_qty?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_owner: boolean
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_owner?: boolean
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_owner?: boolean
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          org_id: string
          po_id: string
          product_id: string
          product_name: string
          qty_ordered: number
          qty_received: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          po_id: string
          product_id: string
          product_name: string
          qty_ordered: number
          qty_received?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          po_id?: string
          product_id?: string
          product_name?: string
          qty_ordered?: number
          qty_received?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          notes: string | null
          ordered_at: string | null
          org_id: string
          po_number: string
          received_at: string | null
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          notes?: string | null
          ordered_at?: string | null
          org_id: string
          po_number: string
          received_at?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          ordered_at?: string | null
          org_id?: string
          po_number?: string
          received_at?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      recipe_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          qty: number
          recipe_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          qty: number
          recipe_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          qty?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          cuisine: string
          description: string | null
          id: string
          image_path: string | null
          is_diet: boolean
          is_published: boolean
          name: string
          org_id: string
          servings: number
          video_url: string | null
        }
        Insert: {
          created_at?: string
          cuisine: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_diet?: boolean
          is_published?: boolean
          name: string
          org_id: string
          servings?: number
          video_url?: string | null
        }
        Update: {
          created_at?: string
          cuisine?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_diet?: boolean
          is_published?: boolean
          name?: string
          org_id?: string
          servings?: number
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          referred_by: string | null
          reward_paid: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          referred_by?: string | null
          reward_paid?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          referred_by?: string | null
          reward_paid?: boolean
          user_id?: string
        }
        Relationships: []
      }
      returns: {
        Row: {
          created_at: string
          id: string
          order_id: string
          order_number: string
          org_id: string
          reason: string
          refund_points: number
          resolved_at: string | null
          resolved_by: string | null
          staff_note: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          order_number: string
          org_id: string
          reason: string
          refund_points?: number
          resolved_at?: string | null
          resolved_by?: string | null
          staff_note?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          order_number?: string
          org_id?: string
          reason?: string
          refund_points?: number
          resolved_at?: string | null
          resolved_by?: string | null
          staff_note?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string
          body: string | null
          contact_hash: string | null
          created_at: string
          id: string
          is_published: boolean
          org_id: string
          product_id: string
          rating: number
          verified: boolean
        }
        Insert: {
          author_name: string
          body?: string | null
          contact_hash?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          org_id: string
          product_id: string
          rating: number
          verified?: boolean
        }
        Update: {
          author_name?: string
          body?: string | null
          contact_hash?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          org_id?: string
          product_id?: string
          rating?: number
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      role_capabilities: {
        Row: {
          capability: string
          role: string
        }
        Insert: {
          capability: string
          role: string
        }
        Update: {
          capability?: string
          role?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          line_total: number | null
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number | null
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number | null
          product_id?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          location_id: string
          org_id: string
          payment_status: string
          sale_date: string
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          location_id: string
          org_id: string
          payment_status?: string
          sale_date?: string
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          location_id?: string
          org_id?: string
          payment_status?: string
          sale_date?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_balances"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_carts: {
        Row: {
          item_count: number
          org_id: string
          reminded_at: string | null
          subtotal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          item_count?: number
          org_id: string
          reminded_at?: string | null
          subtotal?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          item_count?: number
          org_id?: string
          reminded_at?: string | null
          subtotal?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_carts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scratch_cards: {
        Row: {
          created_at: string
          id: string
          order_number: string
          org_id: string
          revealed_at: string | null
          reward_points: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_number: string
          org_id: string
          revealed_at?: string | null
          reward_points: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_number?: string
          org_id?: string
          revealed_at?: string | null
          reward_points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scratch_cards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          clock_in_at: string
          clock_out_at: string | null
          created_at: string
          id: string
          location_id: string
          note: string | null
          org_id: string
          staff_member_id: string
          station_id: string | null
          updated_at: string
        }
        Insert: {
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
          id?: string
          location_id: string
          note?: string | null
          org_id: string
          staff_member_id: string
          station_id?: string | null
          updated_at?: string
        }
        Update: {
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
          id?: string
          location_id?: string
          note?: string | null
          org_id?: string
          staff_member_id?: string
          station_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_cards: {
        Row: {
          card_uid_hash: string
          created_at: string
          id: string
          issued_at: string
          label: string | null
          org_id: string
          revoked_at: string | null
          staff_member_id: string
        }
        Insert: {
          card_uid_hash: string
          created_at?: string
          id?: string
          issued_at?: string
          label?: string | null
          org_id: string
          revoked_at?: string | null
          staff_member_id: string
        }
        Update: {
          card_uid_hash?: string
          created_at?: string
          id?: string
          issued_at?: string
          label?: string | null
          org_id?: string
          revoked_at?: string | null
          staff_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_cards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_cards_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          created_at: string
          employment: string
          full_name: string
          id: string
          is_active: boolean
          job_title: string | null
          location_id: string
          org_id: string
          phone: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          employment?: string
          full_name: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          location_id: string
          org_id: string
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          employment?: string
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          location_id?: string
          org_id?: string
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          code: string | null
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      stations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          location_id: string
          name: string
          org_id: string
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          location_id: string
          name: string
          org_id: string
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          location_id?: string
          name?: string
          org_id?: string
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alerts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          notified_at: string | null
          org_id: string
          phone: string | null
          product_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          notified_at?: string | null
          org_id: string
          phone?: string | null
          product_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          notified_at?: string | null
          org_id?: string
          phone?: string | null
          product_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          location_id: string
          lot_code: string | null
          org_id: string
          product_id: string
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          location_id: string
          lot_code?: string | null
          org_id: string
          product_id: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          location_id?: string
          lot_code?: string | null
          org_id?: string
          product_id?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          actor_id: string | null
          batch_id: string | null
          created_at: string
          delta: number
          id: number
          location_id: string
          note: string | null
          org_id: string
          product_id: string
          reason: string
          ref_id: string | null
          ref_type: string | null
        }
        Insert: {
          actor_id?: string | null
          batch_id?: string | null
          created_at?: string
          delta: number
          id?: never
          location_id: string
          note?: string | null
          org_id: string
          product_id: string
          reason: string
          ref_id?: string | null
          ref_type?: string | null
        }
        Update: {
          actor_id?: string | null
          batch_id?: string | null
          created_at?: string
          delta?: number
          id?: never
          location_id?: string
          note?: string | null
          org_id?: string
          product_id?: string
          reason?: string
          ref_id?: string | null
          ref_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          address_line: string
          city: string | null
          contact_name: string
          contact_phone: string
          created_at: string
          frequency: string
          id: string
          is_active: boolean
          landmark: string | null
          last_order_at: string | null
          next_run: string
          org_id: string
          pincode: string | null
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          address_line: string
          city?: string | null
          contact_name: string
          contact_phone: string
          created_at?: string
          frequency: string
          id?: string
          is_active?: boolean
          landmark?: string | null
          last_order_at?: string | null
          next_run: string
          org_id: string
          pincode?: string | null
          product_id: string
          quantity: number
          user_id: string
        }
        Update: {
          address_line?: string
          city?: string | null
          contact_name?: string
          contact_phone?: string
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean
          landmark?: string | null
          last_order_at?: string | null
          next_run?: string
          org_id?: string
          pincode?: string | null
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          message: string
          order_number: string | null
          org_id: string
          resolved_at: string | null
          staff_reply: string | null
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          order_number?: string | null
          org_id: string
          resolved_at?: string | null
          staff_reply?: string | null
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          order_number?: string | null
          org_id?: string
          resolved_at?: string | null
          staff_reply?: string | null
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_ledger: {
        Row: {
          amount: number
          created_at: string
          id: number
          org_id: string
          reason: string
          ref: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: never
          org_id: string
          reason: string
          ref?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: never
          org_id?: string
          reason?: string
          ref?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wastage_log: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          location_id: string
          note: string | null
          org_id: string
          product_id: string
          product_name: string
          quantity: number
          reason: string
          unit_cost: number
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          location_id: string
          note?: string | null
          org_id: string
          product_id: string
          product_name: string
          quantity: number
          reason: string
          unit_cost?: number
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          location_id?: string
          note?: string | null
          org_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          reason?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "wastage_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wastage_log_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wastage_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wastage_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      winback_log: {
        Row: {
          contact_phone: string
          last_sent_at: string
        }
        Insert: {
          contact_phone: string
          last_sent_at?: string
        }
        Update: {
          contact_phone?: string
          last_sent_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      customer_balances: {
        Row: {
          customer_id: string | null
          location_id: string | null
          name: string | null
          org_id: string | null
          outstanding: number | null
          phone: string | null
          total_billed: number | null
          total_paid: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_daily_sales: {
        Row: {
          day: string | null
          location_id: string | null
          org_id: string | null
          outstanding: number | null
          sale_count: number | null
          total_billed: number | null
          total_collected: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      open_shifts: {
        Row: {
          clock_in_at: string | null
          elapsed: string | null
          full_name: string | null
          job_title: string | null
          location_id: string | null
          org_id: string | null
          shift_id: string | null
          staff_member_id: string | null
          station_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_queue: {
        Row: {
          address_line: string | null
          city: string | null
          contact_name: string | null
          contact_phone: string | null
          delivery_slot: string | null
          id: string | null
          item_count: number | null
          order_number: string | null
          org_id: string | null
          pincode: string | null
          placed_at: string | null
          status: string | null
          total: number | null
          total_quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_on_hand: {
        Row: {
          location_id: string | null
          org_id: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_membership: {
        Args: { p_id: string; p_rp_order: string; p_rp_payment: string }
        Returns: undefined
      }
      active_banners: {
        Args: never
        Returns: {
          bg_from: string
          bg_to: string
          cta_label: string
          href: string
          id: string
          image_path: string
          subtitle: string
          title: string
        }[]
      }
      add_batch: {
        Args: {
          p_batch_code: string
          p_farm: string
          p_notes: string
          p_product: string
          p_quantity: number
          p_source_date: string
        }
        Returns: string
      }
      add_farm: {
        Args: {
          p_contact: string
          p_kind: string
          p_location: string
          p_name: string
          p_notes: string
        }
        Returns: string
      }
      add_po_item: {
        Args: {
          p_po: string
          p_product: string
          p_qty: number
          p_unit_cost: number
        }
        Returns: string
      }
      add_recipe_item: {
        Args: { p_product: string; p_qty: number; p_recipe: string }
        Returns: undefined
      }
      add_review: {
        Args: {
          p_body: string
          p_contact?: string
          p_name: string
          p_product: string
          p_rating: number
        }
        Returns: Json
      }
      add_to_order: {
        Args: {
          p_lines: Database["public"]["CompositeTypes"]["cart_line"][]
          p_number: string
        }
        Returns: Json
      }
      apply_markdown: {
        Args: {
          p_ends: string
          p_price: number
          p_product: string
          p_reason?: string
        }
        Returns: undefined
      }
      approve_return: {
        Args: { p_id: string; p_note?: string; p_refund_points?: number }
        Returns: undefined
      }
      attach_order_location: {
        Args: {
          p_lat: number
          p_lng: number
          p_order_id: string
          p_phone: string
        }
        Returns: undefined
      }
      auto_assign_deliveries: { Args: never; Returns: number }
      auto_draft_reorder: {
        Args: { p_horizon?: number; p_lead?: number; p_lookback?: number }
        Returns: number
      }
      batches_for_product: { Args: { p_product: string }; Returns: Json }
      bestseller_ids: { Args: { p_limit?: number }; Returns: string[] }
      business_overview: { Args: never; Returns: Json }
      cancel_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: undefined
      }
      cancel_purchase_order: { Args: { p_po: string }; Returns: undefined }
      cancel_stale_unpaid_orders: { Args: never; Returns: number }
      cart_recommendations: {
        Args: { p_limit?: number; p_products: string[] }
        Returns: string[]
      }
      catalogue_by_category: {
        Args: { p_slug: string }
        Returns: {
          product_id: string
        }[]
      }
      catalogue_categories: {
        Args: never
        Returns: {
          icon: string
          id: string
          name: string
          parent_id: string
          product_count: number
          slug: string
          sort_order: number
        }[]
      }
      catalogue_stock: {
        Args: never
        Returns: {
          in_stock: boolean
          low: boolean
          product_id: string
        }[]
      }
      claim_delivery: {
        Args: { p_order_id: string; p_take?: boolean }
        Returns: undefined
      }
      claim_notifications: {
        Args: { p_limit?: number }
        Returns: {
          channel: string
          id: number
          payload: Json
          recipient: string
          template: string
        }[]
      }
      clear_cart: { Args: never; Returns: undefined }
      create_purchase_order: {
        Args: { p_location: string; p_notes?: string; p_supplier: string }
        Returns: Json
      }
      create_recipe: {
        Args: {
          p_cuisine: string
          p_description: string
          p_is_diet: boolean
          p_name: string
          p_servings: number
        }
        Returns: string
      }
      create_subscription: {
        Args: { p_frequency: string; p_product: string; p_quantity: number }
        Returns: Json
      }
      create_support_ticket: {
        Args: { p_message: string; p_order_number?: string; p_subject: string }
        Returns: Json
      }
      current_org_id: { Args: never; Returns: string }
      delete_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
      delivers_to: {
        Args: { p_org: string; p_pincode: string }
        Returns: boolean
      }
      demand_insights: { Args: never; Returns: Json }
      demand_series: {
        Args: { p_days?: number; p_product: string }
        Returns: Json
      }
      expire_markdowns: { Args: never; Returns: number }
      expire_old_batches: { Args: never; Returns: number }
      expiring_batches: { Args: { p_days?: number }; Returns: Json }
      financials_overview: { Args: { p_days?: number }; Returns: Json }
      frequently_bought_together: {
        Args: { p_limit?: number; p_product: string }
        Returns: string[]
      }
      get_admin_recipes: {
        Args: never
        Returns: {
          cuisine: string
          id: string
          is_diet: boolean
          item_count: number
          name: string
          servings: number
        }[]
      }
      get_batches: {
        Args: { p_limit?: number }
        Returns: {
          batch_code: string
          created_at: string
          farm_name: string
          id: string
          product_name: string
          quantity: number
          source_date: string
        }[]
      }
      get_farms: {
        Args: never
        Returns: {
          contact: string | null
          created_at: string
          id: string
          kind: string
          location: string | null
          name: string
          notes: string | null
          org_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "farms"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_hamper: { Args: { p_id: string }; Returns: Json }
      get_hampers: {
        Args: never
        Returns: {
          cost: number
          id: string
          image_path: string
          item_count: number
          name: string
        }[]
      }
      get_membership_plans: {
        Args: never
        Returns: {
          created_at: string
          discount_percent: number
          duration_days: number
          id: string
          is_active: boolean
          name: string
          org_id: string
          price: number
        }[]
        SetofOptions: {
          from: "*"
          to: "membership_plans"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_order_receipt: {
        Args: { p_number: string; p_phone?: string }
        Returns: Json
      }
      get_product_reviews: {
        Args: { p_limit?: number; p_product: string }
        Returns: {
          author_name: string
          body: string
          created_at: string
          rating: number
          verified: boolean
        }[]
      }
      get_purchase_order: { Args: { p_po: string }; Returns: Json }
      get_recipe: { Args: { p_id: string; p_servings?: number }; Returns: Json }
      get_recipe_cuisines: {
        Args: never
        Returns: {
          cuisine: string
          n: number
        }[]
      }
      get_recipes: {
        Args: {
          p_cuisine?: string
          p_diet?: string
          p_max_budget?: number
          p_servings?: number
        }
        Returns: {
          cost: number
          cuisine: string
          id: string
          image_path: string
          ingredient_count: number
          is_diet: boolean
          name: string
          servings: number
        }[]
      }
      get_returns: {
        Args: { p_all?: boolean }
        Returns: {
          created_at: string
          id: string
          order_id: string
          order_number: string
          org_id: string
          reason: string
          refund_points: number
          resolved_at: string | null
          resolved_by: string | null
          staff_note: string | null
          status: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "returns"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_store_admin_settings: { Args: never; Returns: Json }
      get_store_settings: { Args: never; Returns: Json }
      get_support_tickets: {
        Args: { p_all?: boolean }
        Returns: {
          created_at: string
          id: string
          message: string
          order_number: string | null
          org_id: string
          resolved_at: string | null
          staff_reply: string | null
          status: string
          subject: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "support_tickets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      grant_personal_coupon: {
        Args: {
          p_days?: number
          p_kind: string
          p_max?: number
          p_min?: number
          p_phone: string
          p_value: number
        }
        Returns: Json
      }
      has_location: { Args: { loc: string }; Returns: boolean }
      has_permission: { Args: { p_capability: string }; Returns: boolean }
      hash_card_uid: { Args: { p_uid: string }; Returns: string }
      in_stock_products: {
        Args: { p_org: string }
        Returns: {
          department: string
          product_id: string
          sort_order: number
        }[]
      }
      instant_refund: {
        Args: { p_order_id: string; p_points: number; p_reason: string }
        Returns: Json
      }
      is_org_owner: { Args: never; Returns: boolean }
      is_storefront_org: { Args: { p_org: string }; Returns: boolean }
      issue_gift_card: { Args: { p_value: number }; Returns: Json }
      list_purchase_orders: {
        Args: { p_limit?: number; p_status?: string }
        Returns: Json
      }
      list_suppliers: { Args: { p_include_inactive?: boolean }; Returns: Json }
      list_wastage: {
        Args: { p_days?: number; p_limit?: number }
        Returns: Json
      }
      log_temperature: {
        Args: {
          p_area: string
          p_location: string
          p_max?: number
          p_min?: number
          p_note?: string
          p_temp: number
        }
        Returns: boolean
      }
      log_wastage: {
        Args: {
          p_location: string
          p_note?: string
          p_product: string
          p_qty: number
          p_reason: string
        }
        Returns: string
      }
      margin_by_product: { Args: { p_days?: number }; Returns: Json }
      mark_order_paid: {
        Args: {
          p_order_id: string
          p_razorpay_order: string
          p_razorpay_payment: string
        }
        Returns: undefined
      }
      mark_po_ordered: { Args: { p_po: string }; Returns: undefined }
      my_checkout_prefill: { Args: never; Returns: Json }
      my_coupons: {
        Args: never
        Returns: {
          code: string
          expires_at: string
          kind: string
          max_discount: number
          min_subtotal: number
          value: number
        }[]
      }
      my_membership: { Args: never; Returns: Json }
      my_orders: { Args: never; Returns: Json }
      my_reorder_products: { Args: { p_limit?: number }; Returns: string[] }
      my_savings: { Args: never; Returns: Json }
      my_scratch_cards: {
        Args: never
        Returns: {
          id: string
          order_number: string
        }[]
      }
      my_shift: { Args: never; Returns: boolean }
      my_tier: { Args: never; Returns: Json }
      my_wallet: { Args: never; Returns: Json }
      next_order_number: { Args: never; Returns: string }
      payment_reconciliation: { Args: { p_days?: number }; Returns: Json }
      personalized_products: { Args: { p_limit?: number }; Returns: string[] }
      place_order: {
        Args: {
          p_address_line: string
          p_city: string
          p_contact_email?: string
          p_contact_name: string
          p_contact_phone: string
          p_coupon_code?: string
          p_delivery_slot: string
          p_landmark: string
          p_lines: Database["public"]["CompositeTypes"]["cart_line"][]
          p_notes: string
          p_org_id: string
          p_payment_method?: string
          p_pincode: string
          p_use_credit?: boolean
        }
        Returns: {
          order_id: string
          order_number: string
          total: number
        }[]
      }
      pos_loyalty_lookup: { Args: { p_code: string }; Returns: Json }
      preview_coupon: {
        Args: {
          p_code: string
          p_org: string
          p_phone: string
          p_subtotal: number
        }
        Returns: Json
      }
      price_check: { Args: { p_threshold?: number }; Returns: Json }
      procurement_overview: { Args: never; Returns: Json }
      product_department: { Args: { p_product: string }; Returns: string }
      product_ratings: {
        Args: never
        Returns: {
          avg_rating: number
          product_id: string
          review_count: number
        }[]
      }
      rate_delivery: {
        Args: {
          p_comment?: string
          p_number: string
          p_phone: string
          p_rating: number
        }
        Returns: Json
      }
      recall_trace: {
        Args: { p_from: string; p_product: string; p_to: string }
        Returns: {
          contact_name: string
          contact_phone: string
          order_number: string
          placed_at: string
          quantity: number
          status: string
        }[]
      }
      receive_purchase_order: {
        Args: { p_items: Json; p_po: string }
        Returns: undefined
      }
      recent_temperature: {
        Args: { p_days?: number; p_limit?: number }
        Returns: Json
      }
      record_account_payment: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_method?: string
          p_note?: string
        }
        Returns: number
      }
      record_production: {
        Args: {
          p_expiry?: string
          p_location: string
          p_note?: string
          p_product: string
          p_qty: number
        }
        Returns: string
      }
      record_sale: {
        Args: {
          p_amount_paid: number
          p_customer_id: string
          p_lines: Database["public"]["CompositeTypes"]["sale_line"][]
          p_location: string
          p_loyalty_user?: string
          p_method: string
          p_note?: string
          p_points_redeem?: number
        }
        Returns: {
          change: number
          sale_id: string
          total: number
        }[]
      }
      record_stock: {
        Args: {
          p_delta: number
          p_location: string
          p_note?: string
          p_product: string
          p_reason: string
        }
        Returns: number
      }
      redeem_gift_card: { Args: { p_code: string }; Returns: Json }
      redeem_referral: { Args: { p_code: string }; Returns: Json }
      refill_suggestions: { Args: never; Returns: string[] }
      reject_return: {
        Args: { p_id: string; p_note?: string }
        Returns: undefined
      }
      remind_abandoned_carts: { Args: never; Returns: number }
      remove_po_item: { Args: { p_item: string }; Returns: undefined }
      reorder_suggestions: {
        Args: { p_horizon?: number; p_lead?: number; p_lookback?: number }
        Returns: Json
      }
      request_return: {
        Args: { p_number: string; p_phone?: string; p_reason: string }
        Returns: Json
      }
      require_permission: { Args: { p_capability: string }; Returns: boolean }
      resolve_card: {
        Args: { p_uid: string }
        Returns: {
          full_name: string
          location_id: string
          staff_member_id: string
        }[]
      }
      resolve_support_ticket: {
        Args: { p_id: string; p_reply: string }
        Returns: undefined
      }
      retire_product: {
        Args: { p_id: string; p_reason?: string }
        Returns: undefined
      }
      reveal_scratch_card: { Args: { p_id: string }; Returns: number }
      revert_markdown: { Args: { p_product: string }; Returns: undefined }
      run_due_subscriptions: { Args: never; Returns: number }
      run_one_subscription: { Args: { p_sub: string }; Returns: boolean }
      run_winback: { Args: { p_days?: number }; Returns: number }
      sales_by_payment: { Args: { p_days?: number }; Returns: Json }
      sales_summary: { Args: never; Returns: Json }
      save_cart: {
        Args: { p_item_count: number; p_subtotal: number }
        Returns: undefined
      }
      save_product: {
        Args: {
          p_badge: string
          p_brand_id: string
          p_category_id: string
          p_compare_at_price: number
          p_description: string
          p_id: string
          p_image_path: string
          p_is_published: boolean
          p_name: string
          p_pack_size: number
          p_pack_unit: string
          p_sale_price: number
          p_sort_order?: number
        }
        Returns: string
      }
      save_push_subscription: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string }
        Returns: undefined
      }
      served_areas: {
        Args: never
        Returns: {
          area_name: string
          pincode: string
        }[]
      }
      set_member_owner: {
        Args: { p_is_owner: boolean; p_user: string }
        Returns: undefined
      }
      set_my_shift: { Args: { p_on: boolean }; Returns: boolean }
      set_order_status: {
        Args: { p_order_id: string; p_to: string }
        Returns: undefined
      }
      set_recipe_image: {
        Args: { p_path: string; p_recipe: string }
        Returns: undefined
      }
      set_recipe_video: {
        Args: { p_recipe: string; p_url: string }
        Returns: undefined
      }
      set_supplier_active: {
        Args: { p_active: boolean; p_id: string }
        Returns: undefined
      }
      settle_razorpay_payment: {
        Args: {
          p_amount: number
          p_event: string
          p_payment_id: string
          p_raw: Json
          p_rp_order: string
        }
        Returns: string
      }
      slugify: { Args: { p_text: string }; Returns: string }
      start_membership: { Args: { p_plan: string }; Returns: Json }
      stock_available: {
        Args: { p_location: string; p_product: string }
        Returns: number
      }
      storefront_org_id: { Args: never; Returns: string }
      subscription_discount_pct: { Args: never; Returns: number }
      tip_delivery: {
        Args: { p_number: string; p_points: number }
        Returns: Json
      }
      track_order: {
        Args: { p_number: string; p_phone: string }
        Returns: Json
      }
      unit_price: {
        Args: { p_sale: number; p_size: number; p_unit: string }
        Returns: number
      }
      update_rider_location: {
        Args: {
          p_eta?: number
          p_lat: number
          p_lng: number
          p_order_id: string
        }
        Returns: undefined
      }
      update_store_settings: {
        Args: {
          p_business_address: string
          p_delivery_fee: number
          p_free_delivery_threshold: number
          p_gstin: string
          p_max_discount_percent: number
          p_name: string
          p_notify_email: string
          p_notify_phone: string
          p_subscription_discount_percent?: number
          p_support_email: string
          p_support_phone: string
        }
        Returns: undefined
      }
      upsert_customer: {
        Args: { p_location: string; p_name: string; p_phone: string }
        Returns: string
      }
      upsert_supplier: {
        Args: {
          p_address: string
          p_contact: string
          p_email: string
          p_id: string
          p_name: string
          p_notes: string
          p_phone: string
        }
        Returns: string
      }
      wallet_balance: { Args: { p_user: string }; Returns: number }
      wastage_summary: { Args: { p_days?: number }; Returns: Json }
      watch_stock: {
        Args: { p_email?: string; p_phone?: string; p_product: string }
        Returns: Json
      }
      write_off_batch: {
        Args: { p_batch: string; p_note?: string; p_reason?: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      cart_line: {
        product_id: string | null
        quantity: number | null
      }
      sale_line: {
        product_id: string | null
        quantity: number | null
        unit_price: number | null
      }
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
    Enums: {},
  },
} as const
