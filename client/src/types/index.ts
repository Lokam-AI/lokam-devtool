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
  organization_name: string;
  rooftop_name: string;
  call_status: string;
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
  calls_assigned: number;
  completed_today: number;
  completion_pct: number;
}

export interface SystemHealth {
  active_calls: number;
  queue_depth: number;
  workers: number;
  uptime: string;
}

export type Environment = string;

export interface EnvConfig {
  id: number;
  name: string;
  base_url: string;
  is_active: boolean;
}
