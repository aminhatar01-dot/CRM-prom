export type BillingProvider = "manual" | "mercado_pago" | "stripe";
export type InvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded" | "cancelled";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "suspended" | "unpaid";
export type BillingCycle = "monthly" | "annual" | "one_time";

export type BillingCustomer = {
  id: string;
  organization_id: string;
  provider: BillingProvider;
  external_id: string | null;
  email: string | null;
  name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BillingSubscription = {
  id: string;
  organization_id: string;
  billing_customer_id: string;
  plan_id: string | null;
  provider: BillingProvider;
  external_id: string | null;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BillingInvoice = {
  id: string;
  organization_id: string;
  billing_subscription_id: string | null;
  provider: BillingProvider;
  external_id: string | null;
  number: string | null;
  status: InvoiceStatus;
  amount_cents: number;
  currency: string;
  description: string;
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  paid_at: string | null;
  credit_note: boolean;
  line_items: unknown[];
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingPayment = {
  id: string;
  organization_id: string;
  invoice_id: string | null;
  provider: BillingProvider;
  external_id: string | null;
  idempotency_key: string | null;
  status: PaymentStatus;
  amount_cents: number;
  currency: string;
  method: string;
  credits_granted: number;
  credits_granted_at: string | null;
  notes: string;
  metadata: Record<string, unknown>;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingWebhookEvent = {
  id: string;
  provider: BillingProvider;
  external_id: string | null;
  event_type: string;
  organization_id: string | null;
  payload: Record<string, unknown>;
  processed: boolean;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
};

export type LineItem = {
  description: string;
  quantity: number;
  unit_amount_cents: number;
  total_cents: number;
};
