export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string;
          actor_id: string | null;
          client_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          summary: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          summary: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
        ];
      };
      approvals: {
        Row: {
          client_comment: string | null;
          client_id: string;
          created_at: string;
          created_by: string | null;
          decided_at: string | null;
          decisions: NonNullable<Json>;
          expires_at: string;
          id: string;
          post_ids: string[];
          token_hash: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          client_comment?: string | null;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decisions?: NonNullable<Json>;
          expires_at?: string;
          id?: string;
          post_ids: string[];
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          client_comment?: string | null;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decisions?: NonNullable<Json>;
          expires_at?: string;
          id?: string;
          post_ids?: string[];
          token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approvals_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approvals_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approvals_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "approvals_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_connections: {
        Row: {
          calendar_id: string;
          created_at: string;
          google_email: string;
          id: string;
          last_error: string | null;
          last_synced_at: string | null;
          status: Database["public"]["Enums"]["connection_status"];
          sync_token: string | null;
          updated_at: string;
          user_id: string;
          vault_secret_id: string | null;
          watch_channel_id: string | null;
          watch_expires_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          calendar_id?: string;
          created_at?: string;
          google_email: string;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          status?: Database["public"]["Enums"]["connection_status"];
          sync_token?: string | null;
          updated_at?: string;
          user_id: string;
          vault_secret_id?: string | null;
          watch_channel_id?: string | null;
          watch_expires_at?: string | null;
        };
        Update: {
          calendar_id?: string;
          created_at?: string;
          google_email?: string;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          status?: Database["public"]["Enums"]["connection_status"];
          sync_token?: string | null;
          updated_at?: string;
          user_id?: string;
          vault_secret_id?: string | null;
          watch_channel_id?: string | null;
          watch_expires_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_connections_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      client_assets: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["asset_kind"];
          name: string;
          sort_order: number;
          storage_path: string | null;
          updated_at: string;
          value: string | null;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["asset_kind"];
          name: string;
          sort_order?: number;
          storage_path?: string | null;
          updated_at?: string;
          value?: string | null;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["asset_kind"];
          name?: string;
          sort_order?: number;
          storage_path?: string | null;
          updated_at?: string;
          value?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_assets_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_assets_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_assets_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_assets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      client_notes: {
        Row: {
          author_id: string | null;
          body: string;
          client_id: string;
          created_at: string;
          id: string;
          is_pinned: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          body: string;
          client_id: string;
          created_at?: string;
          id?: string;
          is_pinned?: boolean;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          client_id?: string;
          created_at?: string;
          id?: string;
          is_pinned?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_notes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_notes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_notes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
        ];
      };
      client_services: {
        Row: {
          client_id: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          service: Database["public"]["Enums"]["service_type"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          service: Database["public"]["Enums"]["service_type"];
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          service?: Database["public"]["Enums"]["service_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_services_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_services_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_services_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          brand_name: string;
          color_tag: string | null;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          deleted_at: string | null;
          email: string | null;
          id: string;
          industry: string | null;
          instagram_handle: string | null;
          monthly_fee: number | null;
          name: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["client_status"];
          updated_at: string;
          whatsapp: string | null;
        };
        ComputedFields: never;
        Insert: {
          brand_name: string;
          color_tag?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          industry?: string | null;
          instagram_handle?: string | null;
          monthly_fee?: number | null;
          name: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["client_status"];
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          brand_name?: string;
          color_tag?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          industry?: string | null;
          instagram_handle?: string | null;
          monthly_fee?: number | null;
          name?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["client_status"];
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      content_media: {
        Row: {
          cover_path: string | null;
          created_at: string;
          duration_s: number | null;
          height: number | null;
          id: string;
          media_type: Database["public"]["Enums"]["media_type"];
          position: number;
          post_id: string;
          storage_path: string;
          updated_at: string;
          width: number | null;
        };
        ComputedFields: never;
        Insert: {
          cover_path?: string | null;
          created_at?: string;
          duration_s?: number | null;
          height?: number | null;
          id?: string;
          media_type: Database["public"]["Enums"]["media_type"];
          position?: number;
          post_id: string;
          storage_path: string;
          updated_at?: string;
          width?: number | null;
        };
        Update: {
          cover_path?: string | null;
          created_at?: string;
          duration_s?: number | null;
          height?: number | null;
          id?: string;
          media_type?: Database["public"]["Enums"]["media_type"];
          position?: number;
          post_id?: string;
          storage_path?: string;
          updated_at?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "content_media_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "content_posts";
            referencedColumns: ["id"];
          },
        ];
      };
      content_posts: {
        Row: {
          caption: string | null;
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          error_message: string | null;
          format: Database["public"]["Enums"]["post_format"];
          grid_position: number | null;
          hashtags: string | null;
          id: string;
          ig_container: Json | null;
          ig_media_id: string | null;
          ig_permalink: string | null;
          publish_attempts: number;
          published_at: string | null;
          publishing_started_at: string | null;
          scheduled_at: string | null;
          social_account_id: string | null;
          status: Database["public"]["Enums"]["post_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          caption?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          error_message?: string | null;
          format?: Database["public"]["Enums"]["post_format"];
          grid_position?: number | null;
          hashtags?: string | null;
          id?: string;
          ig_container?: Json | null;
          ig_media_id?: string | null;
          ig_permalink?: string | null;
          publish_attempts?: number;
          published_at?: string | null;
          publishing_started_at?: string | null;
          scheduled_at?: string | null;
          social_account_id?: string | null;
          status?: Database["public"]["Enums"]["post_status"];
          updated_at?: string;
        };
        Update: {
          caption?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          error_message?: string | null;
          format?: Database["public"]["Enums"]["post_format"];
          grid_position?: number | null;
          hashtags?: string | null;
          id?: string;
          ig_container?: Json | null;
          ig_media_id?: string | null;
          ig_permalink?: string | null;
          publish_attempts?: number;
          published_at?: string | null;
          publishing_started_at?: string | null;
          scheduled_at?: string | null;
          social_account_id?: string | null;
          status?: Database["public"]["Enums"]["post_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_posts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_posts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_posts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_posts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "content_posts_social_account_id_fkey";
            columns: ["social_account_id"];
            isOneToOne: false;
            referencedRelation: "social_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          assignee_id: string | null;
          channel: Database["public"]["Enums"]["channel_type"];
          client_id: string | null;
          contact_avatar: string | null;
          contact_name: string | null;
          contact_username: string | null;
          created_at: string;
          external_contact_id: string;
          id: string;
          labels: string[];
          last_inbound_at: string | null;
          last_message_at: string | null;
          last_message_preview: string | null;
          social_account_id: string | null;
          status: Database["public"]["Enums"]["conversation_status"];
          unread_count: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignee_id?: string | null;
          channel: Database["public"]["Enums"]["channel_type"];
          client_id?: string | null;
          contact_avatar?: string | null;
          contact_name?: string | null;
          contact_username?: string | null;
          created_at?: string;
          external_contact_id: string;
          id?: string;
          labels?: string[];
          last_inbound_at?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          social_account_id?: string | null;
          status?: Database["public"]["Enums"]["conversation_status"];
          unread_count?: number;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          channel?: Database["public"]["Enums"]["channel_type"];
          client_id?: string | null;
          contact_avatar?: string | null;
          contact_name?: string | null;
          contact_username?: string | null;
          created_at?: string;
          external_contact_id?: string;
          id?: string;
          labels?: string[];
          last_inbound_at?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          social_account_id?: string | null;
          status?: Database["public"]["Enums"]["conversation_status"];
          unread_count?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_social_account_id_fkey";
            columns: ["social_account_id"];
            isOneToOne: false;
            referencedRelation: "social_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          all_day: boolean;
          attendee_ids: string[];
          client_id: string | null;
          create_meet: boolean;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          ends_at: string;
          google_etag: string | null;
          google_event_id: string | null;
          id: string;
          location: string | null;
          meet_url: string | null;
          notes: string | null;
          remind_minutes_before: number | null;
          reminder_sent_at: string | null;
          source: string;
          starts_at: string;
          sync_status: Database["public"]["Enums"]["sync_status"];
          title: string;
          type: Database["public"]["Enums"]["event_type"];
          updated_at: string;
          whatsapp_reminder: boolean;
          whatsapp_reminder_sent_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          all_day?: boolean;
          attendee_ids?: string[];
          client_id?: string | null;
          create_meet?: boolean;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          ends_at: string;
          google_etag?: string | null;
          google_event_id?: string | null;
          id?: string;
          location?: string | null;
          meet_url?: string | null;
          notes?: string | null;
          remind_minutes_before?: number | null;
          reminder_sent_at?: string | null;
          source?: string;
          starts_at: string;
          sync_status?: Database["public"]["Enums"]["sync_status"];
          title: string;
          type?: Database["public"]["Enums"]["event_type"];
          updated_at?: string;
          whatsapp_reminder?: boolean;
          whatsapp_reminder_sent_at?: string | null;
        };
        Update: {
          all_day?: boolean;
          attendee_ids?: string[];
          client_id?: string | null;
          create_meet?: boolean;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          ends_at?: string;
          google_etag?: string | null;
          google_event_id?: string | null;
          id?: string;
          location?: string | null;
          meet_url?: string | null;
          notes?: string | null;
          remind_minutes_before?: number | null;
          reminder_sent_at?: string | null;
          source?: string;
          starts_at?: string;
          sync_status?: Database["public"]["Enums"]["sync_status"];
          title?: string;
          type?: Database["public"]["Enums"]["event_type"];
          updated_at?: string;
          whatsapp_reminder?: boolean;
          whatsapp_reminder_sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      exchange_rates: {
        Row: {
          created_at: string;
          created_by: string | null;
          date: string;
          id: string;
          note: string | null;
          updated_at: string;
          usd_to_uyu: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          date: string;
          id?: string;
          note?: string | null;
          updated_at?: string;
          usd_to_uyu: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          date?: string;
          id?: string;
          note?: string | null;
          updated_at?: string;
          usd_to_uyu?: number;
        };
        Relationships: [
          {
            foreignKeyName: "exchange_rates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          category: Database["public"]["Enums"]["expense_category"];
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          date: string;
          deleted_at: string | null;
          description: string;
          fx_rate: number;
          id: string;
          is_recurring: boolean;
          parent_expense_id: string | null;
          project_id: string | null;
          receipt_path: string | null;
          recurrence_day: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          category?: Database["public"]["Enums"]["expense_category"];
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          date?: string;
          deleted_at?: string | null;
          description: string;
          fx_rate?: number;
          id?: string;
          is_recurring?: boolean;
          parent_expense_id?: string | null;
          project_id?: string | null;
          receipt_path?: string | null;
          recurrence_day?: number | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          category?: Database["public"]["Enums"]["expense_category"];
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          date?: string;
          deleted_at?: string | null;
          description?: string;
          fx_rate?: number;
          id?: string;
          is_recurring?: boolean;
          parent_expense_id?: string | null;
          project_id?: string | null;
          receipt_path?: string | null;
          recurrence_day?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_parent_expense_id_fkey";
            columns: ["parent_expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_v";
            referencedColumns: ["id"];
          },
        ];
      };
      ig_metrics_daily: {
        Row: {
          accounts_engaged: number | null;
          created_at: string;
          date: string;
          engagement_rate: number | null;
          followers: number | null;
          follows: number | null;
          id: string;
          interactions: number | null;
          link_clicks: number | null;
          profile_views: number | null;
          reach: number | null;
          social_account_id: string;
          updated_at: string;
          views: number | null;
        };
        ComputedFields: never;
        Insert: {
          accounts_engaged?: number | null;
          created_at?: string;
          date: string;
          engagement_rate?: number | null;
          followers?: number | null;
          follows?: number | null;
          id?: string;
          interactions?: number | null;
          link_clicks?: number | null;
          profile_views?: number | null;
          reach?: number | null;
          social_account_id: string;
          updated_at?: string;
          views?: number | null;
        };
        Update: {
          accounts_engaged?: number | null;
          created_at?: string;
          date?: string;
          engagement_rate?: number | null;
          followers?: number | null;
          follows?: number | null;
          id?: string;
          interactions?: number | null;
          link_clicks?: number | null;
          profile_views?: number | null;
          reach?: number | null;
          social_account_id?: string;
          updated_at?: string;
          views?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ig_metrics_daily_social_account_id_fkey";
            columns: ["social_account_id"];
            isOneToOne: false;
            referencedRelation: "social_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      ig_post_metrics: {
        Row: {
          caption: string | null;
          comments: number | null;
          content_post_id: string | null;
          created_at: string;
          id: string;
          ig_media_id: string;
          interactions: number | null;
          likes: number | null;
          media_product_type: string | null;
          media_type: string | null;
          permalink: string | null;
          posted_at: string | null;
          reach: number | null;
          saves: number | null;
          shares: number | null;
          snapshot_date: string;
          social_account_id: string;
          thumbnail_url: string | null;
          updated_at: string;
          views: number | null;
        };
        ComputedFields: never;
        Insert: {
          caption?: string | null;
          comments?: number | null;
          content_post_id?: string | null;
          created_at?: string;
          id?: string;
          ig_media_id: string;
          interactions?: number | null;
          likes?: number | null;
          media_product_type?: string | null;
          media_type?: string | null;
          permalink?: string | null;
          posted_at?: string | null;
          reach?: number | null;
          saves?: number | null;
          shares?: number | null;
          snapshot_date: string;
          social_account_id: string;
          thumbnail_url?: string | null;
          updated_at?: string;
          views?: number | null;
        };
        Update: {
          caption?: string | null;
          comments?: number | null;
          content_post_id?: string | null;
          created_at?: string;
          id?: string;
          ig_media_id?: string;
          interactions?: number | null;
          likes?: number | null;
          media_product_type?: string | null;
          media_type?: string | null;
          permalink?: string | null;
          posted_at?: string | null;
          reach?: number | null;
          saves?: number | null;
          shares?: number | null;
          snapshot_date?: string;
          social_account_id?: string;
          thumbnail_url?: string | null;
          updated_at?: string;
          views?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ig_post_metrics_content_post_id_fkey";
            columns: ["content_post_id"];
            isOneToOne: false;
            referencedRelation: "content_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ig_post_metrics_social_account_id_fkey";
            columns: ["social_account_id"];
            isOneToOne: false;
            referencedRelation: "social_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_items: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          invoice_id: string;
          position: number;
          quantity: number;
          unit_price: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          invoice_id: string;
          position?: number;
          quantity?: number;
          unit_price?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          invoice_id?: string;
          position?: number;
          quantity?: number;
          unit_price?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          cfe_number: string | null;
          client_id: string;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          deleted_at: string | null;
          due_date: string | null;
          fx_rate: number;
          id: string;
          issue_date: string;
          notes: string | null;
          number: string | null;
          paid_at: string | null;
          payment_method: string | null;
          pdf_path: string | null;
          project_id: string | null;
          recurring_fee_id: string | null;
          status: Database["public"]["Enums"]["invoice_status"];
          subtotal: number;
          total: number;
          updated_at: string;
          vat_rate: number;
        };
        ComputedFields: never;
        Insert: {
          cfe_number?: string | null;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          deleted_at?: string | null;
          due_date?: string | null;
          fx_rate?: number;
          id?: string;
          issue_date?: string;
          notes?: string | null;
          number?: string | null;
          paid_at?: string | null;
          payment_method?: string | null;
          pdf_path?: string | null;
          project_id?: string | null;
          recurring_fee_id?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          subtotal?: number;
          total?: number;
          updated_at?: string;
          vat_rate?: number;
        };
        Update: {
          cfe_number?: string | null;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          deleted_at?: string | null;
          due_date?: string | null;
          fx_rate?: number;
          id?: string;
          issue_date?: string;
          notes?: string | null;
          number?: string | null;
          paid_at?: string | null;
          payment_method?: string | null;
          pdf_path?: string | null;
          project_id?: string | null;
          recurring_fee_id?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          subtotal?: number;
          total?: number;
          updated_at?: string;
          vat_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_recurring_fee_id_fkey";
            columns: ["recurring_fee_id"];
            isOneToOne: false;
            referencedRelation: "recurring_fees";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          body: string | null;
          conversation_id: string;
          created_at: string;
          delivery_status: Database["public"]["Enums"]["delivery_status"] | null;
          direction: Database["public"]["Enums"]["message_direction"];
          error_message: string | null;
          external_message_id: string | null;
          file_name: string | null;
          id: string;
          media_mime: string | null;
          media_path: string | null;
          sent_at: string;
          sent_by: string | null;
          template_name: string | null;
          type: Database["public"]["Enums"]["message_type"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          conversation_id: string;
          created_at?: string;
          delivery_status?: Database["public"]["Enums"]["delivery_status"] | null;
          direction: Database["public"]["Enums"]["message_direction"];
          error_message?: string | null;
          external_message_id?: string | null;
          file_name?: string | null;
          id?: string;
          media_mime?: string | null;
          media_path?: string | null;
          sent_at?: string;
          sent_by?: string | null;
          template_name?: string | null;
          type?: Database["public"]["Enums"]["message_type"];
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          conversation_id?: string;
          created_at?: string;
          delivery_status?: Database["public"]["Enums"]["delivery_status"] | null;
          direction?: Database["public"]["Enums"]["message_direction"];
          error_message?: string | null;
          external_message_id?: string | null;
          file_name?: string | null;
          id?: string;
          media_mime?: string | null;
          media_path?: string | null;
          sent_at?: string;
          sent_by?: string | null;
          template_name?: string | null;
          type?: Database["public"]["Enums"]["message_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sent_by_fkey";
            columns: ["sent_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          client_id: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          is_active: boolean;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_path?: string | null;
          client_id?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id: string;
          is_active?: boolean;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          avatar_path?: string | null;
          client_id?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
        ];
      };
      project_templates: {
        Row: {
          created_at: string;
          created_by: string | null;
          default_budget: number | null;
          description: string | null;
          id: string;
          name: string;
          project_type: Database["public"]["Enums"]["service_type"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          default_budget?: number | null;
          description?: string | null;
          id?: string;
          name: string;
          project_type: Database["public"]["Enums"]["service_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          default_budget?: number | null;
          description?: string | null;
          id?: string;
          name?: string;
          project_type?: Database["public"]["Enums"]["service_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          budget: number | null;
          client_id: string;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          deleted_at: string | null;
          due_date: string | null;
          id: string;
          name: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["project_status"];
          template_id: string | null;
          type: Database["public"]["Enums"]["service_type"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          budget?: number | null;
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          deleted_at?: string | null;
          due_date?: string | null;
          id?: string;
          name: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          template_id?: string | null;
          type: Database["public"]["Enums"]["service_type"];
          updated_at?: string;
        };
        Update: {
          budget?: number | null;
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          deleted_at?: string | null;
          due_date?: string | null;
          id?: string;
          name?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          template_id?: string | null;
          type?: Database["public"]["Enums"]["service_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "project_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      quick_replies: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          shortcut: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          shortcut: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          shortcut?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quick_replies_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_items: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          position: number;
          quantity: number;
          quote_id: string;
          unit_price: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          position?: number;
          quantity?: number;
          quote_id: string;
          unit_price?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          position?: number;
          quantity?: number;
          quote_id?: string;
          unit_price?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      quotes: {
        Row: {
          client_id: string;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          deleted_at: string | null;
          discount: number;
          fx_rate: number;
          id: string;
          issue_date: string;
          notes: string | null;
          number: string | null;
          pdf_path: string | null;
          project_id: string | null;
          status: Database["public"]["Enums"]["quote_status"];
          subtotal: number;
          total: number;
          updated_at: string;
          valid_until: string | null;
          vat_rate: number;
        };
        ComputedFields: never;
        Insert: {
          client_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          deleted_at?: string | null;
          discount?: number;
          fx_rate?: number;
          id?: string;
          issue_date?: string;
          notes?: string | null;
          number?: string | null;
          pdf_path?: string | null;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["quote_status"];
          subtotal?: number;
          total?: number;
          updated_at?: string;
          valid_until?: string | null;
          vat_rate?: number;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          deleted_at?: string | null;
          discount?: number;
          fx_rate?: number;
          id?: string;
          issue_date?: string;
          notes?: string | null;
          number?: string | null;
          pdf_path?: string | null;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["quote_status"];
          subtotal?: number;
          total?: number;
          updated_at?: string;
          valid_until?: string | null;
          vat_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_v";
            referencedColumns: ["id"];
          },
        ];
      };
      recurring_fees: {
        Row: {
          amount: number;
          billing_day: number;
          client_id: string;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          description: string;
          end_date: string | null;
          id: string;
          is_active: boolean;
          start_date: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          billing_day?: number;
          client_id: string;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          description?: string;
          end_date?: string | null;
          id?: string;
          is_active?: boolean;
          start_date?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          billing_day?: number;
          client_id?: string;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          description?: string;
          end_date?: string | null;
          id?: string;
          is_active?: boolean;
          start_date?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recurring_fees_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_fees_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_fees_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          address: string | null;
          created_at: string;
          default_currency: Database["public"]["Enums"]["currency_code"];
          email: string | null;
          id: boolean;
          invoice_prefix: string;
          legal_name: string | null;
          logo_path: string | null;
          next_invoice_number: number;
          next_quote_number: number;
          phone: string | null;
          quote_validity_days: number;
          rut: string | null;
          studio_name: string;
          theme_default: string;
          updated_at: string;
          vat_mode: string;
          vat_rate: number;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          created_at?: string;
          default_currency?: Database["public"]["Enums"]["currency_code"];
          email?: string | null;
          id?: boolean;
          invoice_prefix?: string;
          legal_name?: string | null;
          logo_path?: string | null;
          next_invoice_number?: number;
          next_quote_number?: number;
          phone?: string | null;
          quote_validity_days?: number;
          rut?: string | null;
          studio_name?: string;
          theme_default?: string;
          updated_at?: string;
          vat_mode?: string;
          vat_rate?: number;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          default_currency?: Database["public"]["Enums"]["currency_code"];
          email?: string | null;
          id?: boolean;
          invoice_prefix?: string;
          legal_name?: string | null;
          logo_path?: string | null;
          next_invoice_number?: number;
          next_quote_number?: number;
          phone?: string | null;
          quote_validity_days?: number;
          rut?: string | null;
          studio_name?: string;
          theme_default?: string;
          updated_at?: string;
          vat_mode?: string;
          vat_rate?: number;
          website?: string | null;
        };
        Relationships: [];
      };
      social_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["ig_account_type"] | null;
          client_id: string | null;
          connected_by: string | null;
          created_at: string;
          display_name: string | null;
          external_id: string;
          followers_count: number | null;
          id: string;
          last_error: string | null;
          last_synced_at: string | null;
          platform: Database["public"]["Enums"]["channel_type"];
          profile_picture_url: string | null;
          scopes: string[];
          status: Database["public"]["Enums"]["account_status"];
          token_expires_at: string | null;
          token_refreshed_at: string | null;
          updated_at: string;
          username: string | null;
          vault_secret_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          account_type?: Database["public"]["Enums"]["ig_account_type"] | null;
          client_id?: string | null;
          connected_by?: string | null;
          created_at?: string;
          display_name?: string | null;
          external_id: string;
          followers_count?: number | null;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          platform: Database["public"]["Enums"]["channel_type"];
          profile_picture_url?: string | null;
          scopes?: string[];
          status?: Database["public"]["Enums"]["account_status"];
          token_expires_at?: string | null;
          token_refreshed_at?: string | null;
          updated_at?: string;
          username?: string | null;
          vault_secret_id?: string | null;
        };
        Update: {
          account_type?: Database["public"]["Enums"]["ig_account_type"] | null;
          client_id?: string | null;
          connected_by?: string | null;
          created_at?: string;
          display_name?: string | null;
          external_id?: string;
          followers_count?: number | null;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          platform?: Database["public"]["Enums"]["channel_type"];
          profile_picture_url?: string | null;
          scopes?: string[];
          status?: Database["public"]["Enums"]["account_status"];
          token_expires_at?: string | null;
          token_refreshed_at?: string | null;
          updated_at?: string;
          username?: string | null;
          vault_secret_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "social_accounts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_accounts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_accounts_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_accounts_connected_by_fkey";
            columns: ["connected_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_attachments: {
        Row: {
          created_at: string;
          file_name: string;
          id: string;
          mime_type: string | null;
          size_bytes: number | null;
          storage_path: string;
          task_id: string;
          updated_at: string;
          uploaded_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          file_name: string;
          id?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path: string;
          task_id: string;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          file_name?: string;
          id?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path?: string;
          task_id?: string;
          updated_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_attachments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      task_checklist_items: {
        Row: {
          created_at: string;
          id: string;
          is_done: boolean;
          label: string;
          position: number;
          task_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_done?: boolean;
          label: string;
          position?: number;
          task_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_done?: boolean;
          label?: string;
          position?: number;
          task_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_checklist_items_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks_overview";
            referencedColumns: ["id"];
          },
        ];
      };
      task_comments: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          task_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          task_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          task_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_comments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_comments_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks_overview";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          assignee_id: string | null;
          column: Database["public"]["Enums"]["task_column"];
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          position: number;
          priority: Database["public"]["Enums"]["task_priority"];
          project_id: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assignee_id?: string | null;
          column?: Database["public"]["Enums"]["task_column"];
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          position?: number;
          priority?: Database["public"]["Enums"]["task_priority"];
          project_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          assignee_id?: string | null;
          column?: Database["public"]["Enums"]["task_column"];
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          position?: number;
          priority?: Database["public"]["Enums"]["task_priority"];
          project_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_v";
            referencedColumns: ["id"];
          },
        ];
      };
      template_tasks: {
        Row: {
          checklist: string[];
          created_at: string;
          day_offset: number;
          default_priority: Database["public"]["Enums"]["task_priority"];
          description: string | null;
          id: string;
          position: number;
          template_id: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          checklist?: string[];
          created_at?: string;
          day_offset?: number;
          default_priority?: Database["public"]["Enums"]["task_priority"];
          description?: string | null;
          id?: string;
          position?: number;
          template_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          checklist?: string[];
          created_at?: string;
          day_offset?: number;
          default_priority?: Database["public"]["Enums"]["task_priority"];
          description?: string | null;
          id?: string;
          position?: number;
          template_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "template_tasks_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "project_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_templates: {
        Row: {
          body: string;
          category: string | null;
          created_at: string;
          id: string;
          language: string;
          meta_id: string | null;
          name: string;
          status: Database["public"]["Enums"]["template_status"];
          updated_at: string;
          variables: string[];
        };
        ComputedFields: never;
        Insert: {
          body: string;
          category?: string | null;
          created_at?: string;
          id?: string;
          language?: string;
          meta_id?: string | null;
          name: string;
          status?: Database["public"]["Enums"]["template_status"];
          updated_at?: string;
          variables?: string[];
        };
        Update: {
          body?: string;
          category?: string | null;
          created_at?: string;
          id?: string;
          language?: string;
          meta_id?: string | null;
          name?: string;
          status?: Database["public"]["Enums"]["template_status"];
          updated_at?: string;
          variables?: string[];
        };
        Relationships: [];
      };
    };
    Views: {
      clients_overview: {
        Row: {
          active_projects: number | null;
          brand_name: string;
          color_tag: string | null;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          deleted_at: string | null;
          email: string | null;
          id: string;
          industry: string | null;
          instagram_handle: string | null;
          monthly_fee: number | null;
          name: string;
          services: Database["public"]["Enums"]["service_type"][] | null;
          start_date: string | null;
          status: Database["public"]["Enums"]["client_status"];
          updated_at: string;
          whatsapp: string | null;
        };
        ComputedFields: never;
        Insert: {
          active_projects?: never;
          brand_name?: string | null;
          color_tag?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"] | null;
          deleted_at?: string | null;
          email?: string | null;
          id?: string | null;
          industry?: string | null;
          instagram_handle?: string | null;
          monthly_fee?: never;
          name?: string | null;
          services?: never;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["client_status"] | null;
          updated_at?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          active_projects?: never;
          brand_name?: string | null;
          color_tag?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"] | null;
          deleted_at?: string | null;
          email?: string | null;
          id?: string | null;
          industry?: string | null;
          instagram_handle?: string | null;
          monthly_fee?: never;
          name?: string | null;
          services?: never;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["client_status"] | null;
          updated_at?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      clients_v: {
        Row: {
          brand_name: string;
          color_tag: string | null;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          deleted_at: string | null;
          email: string | null;
          id: string;
          industry: string | null;
          instagram_handle: string | null;
          monthly_fee: number | null;
          name: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["client_status"];
          updated_at: string;
          whatsapp: string | null;
        };
        ComputedFields: never;
        Insert: {
          brand_name?: string | null;
          color_tag?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"] | null;
          deleted_at?: string | null;
          email?: string | null;
          id?: string | null;
          industry?: string | null;
          instagram_handle?: string | null;
          monthly_fee?: never;
          name?: string | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["client_status"] | null;
          updated_at?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          brand_name?: string | null;
          color_tag?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"] | null;
          deleted_at?: string | null;
          email?: string | null;
          id?: string | null;
          industry?: string | null;
          instagram_handle?: string | null;
          monthly_fee?: never;
          name?: string | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["client_status"] | null;
          updated_at?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      events_overview: {
        Row: {
          all_day: boolean;
          attendee_ids: string[];
          client_color: string | null;
          client_id: string | null;
          client_name: string | null;
          create_meet: boolean;
          created_at: string;
          created_by: string | null;
          created_by_name: string | null;
          deleted_at: string | null;
          ends_at: string;
          google_etag: string | null;
          google_event_id: string | null;
          id: string;
          location: string | null;
          meet_url: string | null;
          notes: string | null;
          remind_minutes_before: number | null;
          reminder_sent_at: string | null;
          source: string;
          starts_at: string;
          sync_status: Database["public"]["Enums"]["sync_status"];
          title: string;
          type: Database["public"]["Enums"]["event_type"];
          updated_at: string;
          whatsapp_reminder: boolean;
          whatsapp_reminder_sent_at: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      projects_overview: {
        Row: {
          budget: number | null;
          client_color: string | null;
          client_id: string;
          client_name: string;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          deleted_at: string | null;
          due_date: string | null;
          id: string;
          name: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["project_status"];
          tasks_done: number | null;
          tasks_total: number | null;
          template_id: string | null;
          type: Database["public"]["Enums"]["service_type"];
          updated_at: string;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "project_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      projects_v: {
        Row: {
          budget: number | null;
          client_id: string;
          created_at: string;
          created_by: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          deleted_at: string | null;
          due_date: string | null;
          id: string;
          name: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["project_status"];
          template_id: string | null;
          type: Database["public"]["Enums"]["service_type"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          budget?: never;
          client_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"] | null;
          deleted_at?: string | null;
          due_date?: string | null;
          id?: string | null;
          name?: string | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"] | null;
          template_id?: string | null;
          type?: Database["public"]["Enums"]["service_type"] | null;
          updated_at?: string | null;
        };
        Update: {
          budget?: never;
          client_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"] | null;
          deleted_at?: string | null;
          due_date?: string | null;
          id?: string | null;
          name?: string | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["project_status"] | null;
          template_id?: string | null;
          type?: Database["public"]["Enums"]["service_type"] | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "project_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      settings_public: {
        Row: {
          default_currency: Database["public"]["Enums"]["currency_code"];
          logo_path: string | null;
          studio_name: string;
          theme_default: string;
        };
        ComputedFields: never;
        Insert: {
          default_currency?: Database["public"]["Enums"]["currency_code"] | null;
          logo_path?: string | null;
          studio_name?: string | null;
          theme_default?: string | null;
        };
        Update: {
          default_currency?: Database["public"]["Enums"]["currency_code"] | null;
          logo_path?: string | null;
          studio_name?: string | null;
          theme_default?: string | null;
        };
        Relationships: [];
      };
      tasks_overview: {
        Row: {
          assignee_id: string | null;
          assignee_name: string | null;
          attachments_count: number | null;
          checklist_done: number | null;
          checklist_total: number | null;
          client_color: string | null;
          client_id: string;
          client_name: string;
          column: Database["public"]["Enums"]["task_column"];
          comments_count: number | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          position: number;
          priority: Database["public"]["Enums"]["task_priority"];
          project_id: string;
          project_name: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients_v";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey";
            columns: ["assignee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_overview";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects_v";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      approval_payload: { Args: { p_token: string }; Returns: Json };
      approval_submit: {
        Args: { p_comment: string; p_decisions: Json; p_token: string };
        Returns: Json;
      };
      claim_posts_to_publish: {
        Args: { p_post_id?: string };
        Returns: {
          caption: string | null;
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          error_message: string | null;
          format: Database["public"]["Enums"]["post_format"];
          grid_position: number | null;
          hashtags: string | null;
          id: string;
          ig_container: Json | null;
          ig_media_id: string | null;
          ig_permalink: string | null;
          publish_attempts: number;
          published_at: string | null;
          publishing_started_at: string | null;
          scheduled_at: string | null;
          social_account_id: string | null;
          status: Database["public"]["Enums"]["post_status"];
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "content_posts";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_whatsapp_reminders: {
        Args: Record<PropertyKey, never>;
        Returns: {
          client_id: string;
          client_name: string;
          event_id: string;
          location: string;
          meet_url: string;
          starts_at: string;
          title: string;
          whatsapp: string;
        }[];
      };
      create_approval: { Args: { p_client_id: string; p_post_ids: string[] }; Returns: string };
      create_project_from_template: {
        Args: {
          p_budget?: number;
          p_client_id: string;
          p_currency?: Database["public"]["Enums"]["currency_code"];
          p_due_date?: string;
          p_name: string;
          p_start_date: string;
          p_status?: Database["public"]["Enums"]["project_status"];
          p_template_id: string;
        };
        Returns: string;
      };
      current_client_id: { Args: Record<PropertyKey, never>; Returns: string };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      dashboard_summary: { Args: Record<PropertyKey, never>; Returns: Json };
      delete_google_connection: { Args: { p_connection_id: string }; Returns: undefined };
      disconnect_social_account: {
        Args: { p_account_id: string; p_reason?: string };
        Returns: undefined;
      };
      fx_rate_for: { Args: { p_date?: string }; Returns: number };
      generate_monthly_fees: { Args: Record<PropertyKey, never>; Returns: number };
      generate_recurring_expenses: { Args: Record<PropertyKey, never>; Returns: number };
      get_cron_secret: { Args: Record<PropertyKey, never>; Returns: string };
      get_google_refresh_token: { Args: { p_connection_id: string }; Returns: string };
      get_social_token: { Args: { p_account_id: string }; Returns: string };
      global_search: {
        Args: { q: string };
        Returns: {
          id: string;
          kind: string;
          link: string;
          subtitle: string;
          title: string;
        }[];
      };
      google_sync_status: { Args: Record<PropertyKey, never>; Returns: Json };
      ingest_message: {
        Args: {
          p_account_id: string;
          p_avatar?: string;
          p_body: string;
          p_channel: Database["public"]["Enums"]["channel_type"];
          p_contact: string;
          p_contact_name: string;
          p_direction: Database["public"]["Enums"]["message_direction"];
          p_external_id: string;
          p_file_name: string;
          p_media_mime: string;
          p_media_path: string;
          p_sent_at: string;
          p_sent_by?: string;
          p_template: string;
          p_type: Database["public"]["Enums"]["message_type"];
          p_username: string;
        };
        Returns: string;
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      mark_all_notifications_read: { Args: Record<PropertyKey, never>; Returns: undefined };
      mark_conversation_read: { Args: { p_id: string }; Returns: undefined };
      mark_overdue_invoices: { Args: Record<PropertyKey, never>; Returns: number };
      match_client: {
        Args: {
          p_channel: Database["public"]["Enums"]["channel_type"];
          p_contact: string;
          p_username?: string;
        };
        Returns: string;
      };
      month_name_es: { Args: { d: string }; Returns: string };
      phone_digits: { Args: { p: string }; Returns: string };
      portal_decide_post: {
        Args: { p_comment?: string; p_decision: string; p_post_id: string };
        Returns: undefined;
      };
      run_finance_jobs: { Args: Record<PropertyKey, never>; Returns: Json };
      save_google_connection: {
        Args: {
          p_calendar_id?: string;
          p_email: string;
          p_refresh_token: string;
          p_user_id: string;
        };
        Returns: string;
      };
      save_instagram_account: {
        Args: {
          p_account_type: string;
          p_client_id: string;
          p_expires_at: string;
          p_external_id: string;
          p_followers: number;
          p_name: string;
          p_picture: string;
          p_scopes: string[];
          p_token: string;
          p_user: string;
          p_username: string;
        };
        Returns: string;
      };
      send_event_reminders: { Args: Record<PropertyKey, never>; Returns: number };
      setup_google_sync_cron: { Args: { p_project_url: string }; Returns: undefined };
      setup_instagram_crons: { Args: { p_project_url?: string }; Returns: undefined };
      setup_messages_cron: { Args: Record<PropertyKey, never>; Returns: undefined };
      studio_public: { Args: Record<PropertyKey, never>; Returns: Json };
      today_mvd: { Args: Record<PropertyKey, never>; Returns: string };
      update_message_status: {
        Args: {
          p_error?: string;
          p_external_id: string;
          p_status: Database["public"]["Enums"]["delivery_status"];
        };
        Returns: undefined;
      };
      update_social_token: {
        Args: { p_account_id: string; p_expires_at: string; p_token: string };
        Returns: undefined;
      };
    };
    Enums: {
      account_status: "conectada" | "por_vencer" | "desconectada";
      asset_kind: "logo" | "color" | "font" | "file";
      channel_type: "whatsapp" | "instagram";
      client_status: "lead" | "activo" | "pausado" | "finalizado";
      connection_status: "conectado" | "desconectado";
      conversation_status: "abierta" | "pendiente" | "cerrada";
      currency_code: "UYU" | "USD";
      delivery_status: "enviado" | "entregado" | "leido" | "fallo";
      event_type: "reunion" | "evento" | "sesion_fotos" | "entrega";
      expense_category:
        | "software"
        | "equipos"
        | "publicidad"
        | "freelancers"
        | "impuestos"
        | "otros";
      ig_account_type: "business" | "creator";
      invoice_status: "pendiente" | "cobrado" | "vencido" | "anulado";
      media_type: "imagen" | "video";
      message_direction: "entrante" | "saliente";
      message_type: "texto" | "imagen" | "video" | "audio" | "documento" | "plantilla";
      post_format: "feed" | "carrusel" | "reel" | "story";
      post_status:
        | "idea"
        | "borrador"
        | "en_aprobacion"
        | "aprobado"
        | "programado"
        | "publicado"
        | "error";
      project_status: "activo" | "en_pausa" | "terminado" | "cancelado";
      quote_status: "borrador" | "enviado" | "aceptado" | "rechazado" | "vencido";
      service_type: "branding" | "redes" | "web" | "fotografia" | "otro";
      sync_status: "local" | "sincronizado" | "pendiente" | "error";
      task_column: "por_hacer" | "en_proceso" | "en_revision" | "aprobado" | "entregado";
      task_priority: "baja" | "media" | "alta" | "urgente";
      template_status: "aprobada" | "pendiente" | "rechazada";
      user_role: "admin" | "equipo" | "cliente";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      account_status: ["conectada", "por_vencer", "desconectada"],
      asset_kind: ["logo", "color", "font", "file"],
      channel_type: ["whatsapp", "instagram"],
      client_status: ["lead", "activo", "pausado", "finalizado"],
      connection_status: ["conectado", "desconectado"],
      conversation_status: ["abierta", "pendiente", "cerrada"],
      currency_code: ["UYU", "USD"],
      delivery_status: ["enviado", "entregado", "leido", "fallo"],
      event_type: ["reunion", "evento", "sesion_fotos", "entrega"],
      expense_category: ["software", "equipos", "publicidad", "freelancers", "impuestos", "otros"],
      ig_account_type: ["business", "creator"],
      invoice_status: ["pendiente", "cobrado", "vencido", "anulado"],
      media_type: ["imagen", "video"],
      message_direction: ["entrante", "saliente"],
      message_type: ["texto", "imagen", "video", "audio", "documento", "plantilla"],
      post_format: ["feed", "carrusel", "reel", "story"],
      post_status: [
        "idea",
        "borrador",
        "en_aprobacion",
        "aprobado",
        "programado",
        "publicado",
        "error",
      ],
      project_status: ["activo", "en_pausa", "terminado", "cancelado"],
      quote_status: ["borrador", "enviado", "aceptado", "rechazado", "vencido"],
      service_type: ["branding", "redes", "web", "fotografia", "otro"],
      sync_status: ["local", "sincronizado", "pendiente", "error"],
      task_column: ["por_hacer", "en_proceso", "en_revision", "aprobado", "entregado"],
      task_priority: ["baja", "media", "alta", "urgente"],
      template_status: ["aprobada", "pendiente", "rechazada"],
      user_role: ["admin", "equipo", "cliente"],
    },
  },
} as const;
