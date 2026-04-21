export type UserRole = "reviewer" | "admin" | "superadmin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
}

export interface RawCall {
  id: string;
  call_id: string;
  date: string;
  duration: number;
  campaign: string;
  lead_type: string | null;
  organization_name: string;
  rooftop_name: string;
  call_status: string;
  ended_reason: string | null;
  review_link_sent: boolean | null;
  direction: string;
  customer_name: string;
  customer_phone: string;
  source_env: string;
  transcript: string;
  recording_url: string;
  ai_nps_score: number | null;
  ai_call_summary: string;
  ai_overall_feedback: string;
  ai_positive_mentions: string[];
  ai_detractors: string[];
  ai_is_resolved: boolean;
  ai_callback_requested: boolean;
  call_metadata?: Record<string, unknown> | null;
}

export interface Eval {
  id: string;
  call_id: string;
  reviewer_id: string;
  status: "pending" | "completed";
  gt_nps_score: number | null;
  gt_call_summary: string | null;
  gt_overall_feedback: string | null;
  gt_positive_mentions: string[] | null;
  gt_detractors: string[] | null;
  gt_is_resolved: boolean | null;
  gt_callback_requested: boolean | null;
  gt_is_incomplete_call: boolean | null;
  gt_incomplete_reason: string | null;
  gt_is_dnc_request: boolean | null;
  gt_escalation_needed: boolean | null;
  corrections: Record<string, { ai_value: unknown; gt_value: unknown }>;
  completed_at: string | null;
}

export interface CallWithEval {
  call: RawCall;
  eval: Eval;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  calls_assigned: number;
  calls_pending: number;
  completed_total: number;
  completed_today: number;
  completion_pct: number;
  correction_rate: number;
  avg_nps: number | null;
}

export interface BugReport {
  id: number;
  external_id: number;
  call_id: number | null;
  organization_id: string | null;
  organization_name: string | null;
  rooftop_id: string | null;
  rooftop_name: string | null;
  bug_types: string[] | null;
  description: string | null;
  submitted_by: number | null;
  submitted_by_name: string | null;
  bug_date: string;
  source_env: string;
  external_created_at: string | null;
  synced_at: string;
  assigned_to: number | null;
  is_resolved: boolean;
}

export interface SystemHealth {
  status: string;
  active_calls?: number;
  queue_depth?: number;
  workers?: number;
}

export type Environment = string;

export interface EnvConfig {
  id: number;
  name: string;
  base_url: string;
  is_active: boolean;
}

export interface CallTargets {
  na: number;
  passive: number;
  detractor: number;
  promoter: number;
  missed: number;
}

export interface AssignmentConfig {
  max_calls_per_user: number;
  call_targets: CallTargets;
}
