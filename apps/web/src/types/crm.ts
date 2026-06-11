/**
 * CRM Type Definitions
 * Shared types for all three CRM service surfaces (Admin, Tenant, Customer)
 */

// --- Pagination ---
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// --- Tenant ---
export interface CrmTenantListParams {
  q?: string;
  tier?: string;
  status?: string;
  assignedTo?: string;
  page?: number;
  limit?: number;
}

export interface CrmTenantSummary {
  id: string;
  name: string;
  email: string;
  subscription_tier: string;
  subscription_status: string;
  service_level: string;
  location_status: string;
  created_at: string;
  ltv_cents: number;
  order_count: number;
  open_tickets: number;
  pending_tasks: number;
  last_activity_at: string | null;
  last_activity_type: string | null;
}

export interface CrmTenantDetail extends CrmTenantSummary {
  phone: string | null;
  contact_count: number;
  contacts: CrmContact[];
  recent_activities: CrmActivity[];
  recent_orders: CrmOrder[];
  orders_30d: number;
}

export interface CrmOrder {
  id: string;
  order_number: string;
  total_cents: number;
  order_status: string;
  payment_status: string;
  created_at: string;
}

// --- Contact ---
export interface CrmContact {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateContactInput {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  role?: string;
  is_primary?: boolean;
  notes?: string;
  customer_id?: string;
}

export interface UpdateContactInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  is_primary?: boolean;
  notes?: string;
  customer_id?: string;
}

export interface CrmContactDetail extends CrmContact {
  crm_support_tickets: CrmTicket[];
  crm_tasks: CrmTask[];
  crm_inquiries: CrmInquiry[];
  customers: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
}

// --- Ticket ---
export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface CrmTicket {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  tenant_logo?: string | null;
  contact_id: string | null;
  customer_id: string | null;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  assigned_to: string | null;
  faq_id: string | null;
  first_responded_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketInput {
  tenant_id?: string; // required for customer, inferred for tenant
  title: string;
  description?: string;
  priority?: TicketPriority;
  category?: string;
  contact_id?: string;
  assigned_to?: string;
  faq_id?: string;
}

export interface UpdateTicketInput {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: string;
  assigned_to?: string;
}

// --- Ticket Messages ---
export type AuthorType = 'platform' | 'tenant' | 'customer';

export interface CrmTicketMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  author_type: AuthorType;
  author_name: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

export interface CreateTicketMessageInput {
  content: string;
  is_internal?: boolean;
}

// --- Task ---
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface CrmTask {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  tenant_id: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string;
  assigned_to?: string;
  contact_id?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  assigned_to?: string;
  contact_id?: string;
}

// --- Activity ---
export interface CrmActivity {
  id: string;
  tenant_id: string;
  ticket_id: string | null;
  task_id: string | null;
  actor_id: string;
  actor_type: AuthorType;
  actor_name: string;
  activity_type: string;
  content: string | null;
  metadata: Record<string, any> | null;
  is_internal: boolean;
  created_at: string;
}

export interface CreateActivityInput {
  activity_type: string;
  content?: string;
  is_internal?: boolean;
  ticket_id?: string;
  task_id?: string;
  metadata?: Record<string, any>;
}

// --- Inquiry ---
export type InquiryStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type InquiryPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface CrmInquiry {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  customer_id: string | null;
  subject: string;
  body: string | null;
  status: InquiryStatus;
  priority: InquiryPriority;
  assigned_to: string | null;
  source: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInquiryInput {
  tenant_id?: string;
  subject: string;
  body?: string;
  priority?: InquiryPriority;
  source?: string;
}

export interface UpdateInquiryInput {
  status?: InquiryStatus;
  priority?: InquiryPriority;
  assigned_to?: string;
  subject?: string;
  body?: string;
}

// --- Alert ---
export type AlertType = 'milestone' | 'subscription' | 'welcome' | 'info' | 'warning' | 'congratulations' | 'order';

export interface CrmAlert {
  id: string;
  tenant_id: string;
  type: AlertType;
  title: string;
  body: string | null;
  icon: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
  read_at: string | null;
}

// --- Requests Hub ---
export type RequestType = 'ticket' | 'task' | 'inquiry';

export interface CrmRequestItem {
  id: string;
  type: RequestType;
  tenant_id: string;
  tenant_name: string;
  title: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_at: string;
  is_read: boolean;
}

export interface RequestListParams {
  type?: RequestType;
  status?: string;
  priority?: string;
  assignedTo?: string;
  tenantId?: string;
  unread?: boolean;
  page?: number;
  limit?: number;
}

// --- Tenant CRM Stats (for widget) ---
export interface CrmTenantCrmStats {
  open_tickets: CrmTicket[];
  pending_tasks: CrmTask[];
  recent_activities: CrmActivity[];
  open_inquiries: CrmInquiry[];
  recent_alerts: CrmAlert[];
  unread_count: number;
  open_ticket_count: number;
  pending_task_count: number;
  open_inquiry_count: number;
  unread_alert_count: number;
}
