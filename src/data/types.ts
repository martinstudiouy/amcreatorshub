import type { Database, Tables } from '@/types/database'

export type Role = Database['public']['Enums']['user_role']
export type Profile = Tables<'profiles'>
export type Settings = Tables<'settings'>
export type ExchangeRate = Tables<'exchange_rates'>
export type Notification = Tables<'notifications'>
export type TaskPriority = Database['public']['Enums']['task_priority']
export type TaskColumn = Database['public']['Enums']['task_column']
export type PostFormat = Database['public']['Enums']['post_format']
export type PostStatus = Database['public']['Enums']['post_status']
export type EventType = Database['public']['Enums']['event_type']
export type Channel = Database['public']['Enums']['channel_type']
export type AccountStatus = Database['public']['Enums']['account_status']

/** Lo que devuelve la función dashboard_summary() de la base */
export interface DashboardSummary {
  today: string
  is_admin: boolean
  meetings: {
    id: string
    title: string
    type: EventType
    starts_at: string
    ends_at: string
    location: string | null
    meet_url: string | null
    client_name: string | null
  }[]
  posts: {
    id: string
    caption: string | null
    format: PostFormat
    status: PostStatus
    scheduled_at: string
    client_name: string
    color_tag: string | null
  }[]
  tasks: {
    id: string
    title: string
    due_date: string
    priority: TaskPriority
    column: TaskColumn
    project_name: string
    client_name: string
    assignee_name: string | null
    overdue: boolean
  }[]
  unread: {
    id: string
    channel: Channel
    contact_name: string
    preview: string | null
    unread_count: number
    last_message_at: string
    is_new_contact: boolean
  }[]
  kpis: {
    active_projects: number
    active_clients: number
    billed_month_uyu: number | null
    pending_uyu: number | null
    pending_count: number | null
    overdue_count: number | null
    followers: number | null
    followers_30d_ago: number | null
  }
  account_alerts: {
    id: string
    username: string | null
    platform: Channel
    status: AccountStatus
    client_name: string | null
    token_expires_at: string | null
  }[]
  activity: {
    id: string
    summary: string
    action: string
    entity_type: string
    entity_id: string | null
    created_at: string
    actor_name: string | null
    client_name: string | null
  }[]
}

export interface SearchResult {
  kind: 'cliente' | 'proyecto' | 'publicacion'
  id: string
  title: string
  subtitle: string
  link: string
}
