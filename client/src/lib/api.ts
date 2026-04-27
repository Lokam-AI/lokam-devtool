import axios from "axios";
import { useAuthStore } from "@/store/auth-store";
import type {
  User,
  RawCall,
  Eval,
  CallWithEval,
  TeamMember,
  BugReport,
  SystemHealth,
  EnvConfig,
  AssignmentConfig,
} from "@/types";

const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: true, // send/receive httpOnly cookies
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  }
);

/* ------------------------------------------------------------------ */
/*  Helper: map backend RawCallRead → frontend RawCall                */
/* ------------------------------------------------------------------ */
function mapCall(r: BackendRawCall): RawCall {
  return {
    id: String(r.lokam_call_id),   // canonical frontend id = lokam_call_id
    call_id: String(r.lokam_call_id),
    date: r.call_date,
    duration: r.duration_sec ?? 0,
    campaign: r.campaign_name ?? "",
    lead_type: r.lead_type ?? null,
    organization_name: r.organization_name ?? "",
    rooftop_name: r.rooftop_name ?? "",
    call_status: r.call_status ?? "",
    ended_reason: r.ended_reason ?? null,
    review_link_sent: r.review_link_sent ?? null,
    direction: r.direction ?? "",
    customer_name: r.customer_name_masked ?? "",
    customer_phone: r.customer_phone_masked ?? "",
    source_env: r.source_env ?? "",
    transcript: r.formatted_transcript ?? r.raw_transcript ?? "",
    recording_url: r.recording_url ?? "",
    ai_nps_score: r.nps_score ?? null,
    ai_call_summary: r.call_summary ?? "",
    ai_overall_feedback: r.overall_feedback ?? "",
    ai_positive_mentions: Array.isArray(r.positive_mentions) ? r.positive_mentions : [],
    ai_detractors: Array.isArray(r.detractors) ? r.detractors : [],
    ai_is_resolved: !r.is_incomplete_call,
    ai_is_dnc_request: r.is_dnc_request ?? false,
    ai_escalation_needed: r.escalation_needed ?? false,
    ai_callback_requested: false,
    call_metadata: r.call_metadata ?? null,
  };
}

/* ------------------------------------------------------------------ */
/*  Helper: map backend EvalRead → frontend Eval                      */
/* ------------------------------------------------------------------ */
function mapEval(r: BackendEval, assignedToId?: string): Eval {
  return {
    id: String(r.id),
    call_id: String(r.call_id),
    reviewer_id: String(r.assigned_to),
    status: r.eval_status === "completed" ? "completed" : "pending",
    gt_nps_score: r.gt_nps_score ?? null,
    gt_call_summary: r.gt_call_summary ?? null,
    gt_overall_feedback: r.gt_overall_feedback ?? null,
    gt_positive_mentions: Array.isArray(r.gt_positive_mentions) ? r.gt_positive_mentions : null,
    gt_detractors: Array.isArray(r.gt_detractors) ? r.gt_detractors : null,
    gt_is_resolved: r.gt_is_incomplete_call !== null ? !r.gt_is_incomplete_call : null,
    gt_callback_requested: null,
    gt_is_incomplete_call: r.gt_is_incomplete_call ?? null,
    gt_incomplete_reason: r.gt_incomplete_reason ?? null,
    gt_is_dnc_request: r.gt_is_dnc_request ?? null,
    gt_escalation_needed: r.gt_escalation_needed ?? null,
    corrections: {},
    completed_at: r.completed_at ?? null,
  };
}

/* ------------------------------------------------------------------ */
/*  Backend response shapes (mirrors Pydantic schemas)                */
/* ------------------------------------------------------------------ */
interface BackendRawCall {
  id: number;
  lokam_call_id: number;
  call_date: string;
  duration_sec: number | null;
  campaign_name: string | null;
  lead_type: string | null;
  organization_name: string | null;
  rooftop_name: string | null;
  call_status: string | null;
  ended_reason: string | null;
  review_link_sent: boolean | null;
  direction: string | null;
  customer_name_masked: string | null;
  customer_phone_masked: string | null;
  source_env: string | null;
  nps_score: number | null;
  call_summary: string | null;
  overall_feedback: string | null;
  positive_mentions: unknown | null;
  detractors: unknown | null;
  is_incomplete_call: boolean | null;
  is_dnc_request: boolean | null;
  escalation_needed: boolean | null;
  formatted_transcript: string | null;
  raw_transcript: string | null;
  recording_url: string | null;
  call_metadata: Record<string, unknown> | null;
}

interface BackendEval {
  id: number;
  call_id: number;
  assigned_to: number;
  eval_status: "pending" | "in_progress" | "completed";
  gt_nps_score: number | null;
  gt_call_summary: string | null;
  gt_overall_feedback: string | null;
  gt_positive_mentions: unknown | null;
  gt_detractors: unknown | null;
  gt_is_incomplete_call: boolean | null;
  gt_incomplete_reason: string | null;
  gt_is_dnc_request: boolean | null;
  gt_escalation_needed: boolean | null;
  completed_at: string | null;
  has_corrections: boolean;
}

interface UserMeResponse {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
}

/* ------------------------------------------------------------------ */
/*  Real API functions                                                */
/* ------------------------------------------------------------------ */

/** POST /auth/login — sets httpOnly cookie, returns { access_token } */
export const apiLogin = async (email: string, password: string) => {
  const { data } = await api.post<{ access_token: string; token_type: string }>("/auth/login", {
    email,
    password,
  });
  return data;
};

/** GET /auth/me — returns the current user profile */
export const apiMe = async (): Promise<User> => {
  const { data } = await api.get<UserMeResponse>("/auth/me");
  return {
    id: String(data.id),
    email: data.email,
    name: data.name,
    role: data.role as User["role"],
    is_active: data.is_active,
    must_change_password: data.must_change_password,
  };
};

/** POST /auth/logout */
export const apiLogout = async () => {
  await api.post("/auth/logout");
};

interface BackendCallWithEval {
  call: BackendRawCall;
  eval: BackendEval;
}

export interface MyCallsParams {
  eval_status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  organization_name?: string;
  nps_filter?: string;
  sort_by?: string;
  sort_dir?: string;
  limit?: number;
  offset?: number;
}

/** GET /evals/my/calls — paginated call+eval pairs for the current reviewer */
export const apiGetCalls = async (params?: MyCallsParams): Promise<CallWithEval[]> => {
  const { data } = await api.get<BackendCallWithEval[]>("/evals/my/calls", { params });
  return data.map((item) => ({ call: mapCall(item.call), eval: mapEval(item.eval) }));
};

/** GET /evals/my/calls/count — total count matching reviewer filters */
export const apiGetCallsCount = async (params?: Omit<MyCallsParams, "limit" | "offset" | "sort_by" | "sort_dir">): Promise<number> => {
  const { data } = await api.get<{ count: number }>("/evals/my/calls/count", { params });
  return data.count;
};

export interface MyCallsStatsResult {
  avg_duration_sec: number | null;
}

/** GET /evals/my/calls/stats — avg duration across all reviewer-assigned calls matching filters */
export const apiGetMyCallsStats = async (params?: Omit<MyCallsParams, "limit" | "offset" | "sort_by" | "sort_dir">): Promise<MyCallsStatsResult> => {
  const { data } = await api.get<MyCallsStatsResult>("/evals/my/calls/stats", { params });
  return data;
};

/** GET single call with its eval by lokam_call_id.
 *  Fetches the call directly (1 request) then scans /evals/my to match (1 request).
 *  Total: 2 requests regardless of how many evals the user has.
 */
export const apiGetCall = async (id: string): Promise<CallWithEval | undefined> => {
  try {
    // Fetch call and evals concurrently
    const [callRes, evalsRes] = await Promise.all([
      api.get<BackendRawCall>(`/calls/${id}`).catch(() => null),
      api.get<BackendEval[]>(`/evals/my?call_id=${id}`).catch(() => ({ data: [] as BackendEval[] })),
    ]);

    if (!callRes) return undefined;
    const call = mapCall(callRes.data);
    const callIdNum = Number(id);
    const matchedEval = evalsRes.data.find((e) => e.call_id === callIdNum);

    if (matchedEval) {
      return { call, eval: mapEval(matchedEval) };
    }

    // Admin fallback — no eval assigned for this call
    const placeholderEval: Eval = {
      id: "",
      call_id: call.id,
      reviewer_id: useAuthStore.getState().user?.id ?? "0",
      status: "pending",
      gt_nps_score: null,
      gt_call_summary: null,
      gt_overall_feedback: null,
      gt_positive_mentions: null,
      gt_detractors: null,
      gt_is_resolved: null,
      gt_callback_requested: null,
      corrections: {},
      completed_at: null,
    };
    return { call, eval: placeholderEval };
  } catch {
    return undefined;
  }
};

/** GET /calls/:id — fetch a single raw call by lokam_call_id without eval context */
export const apiGetRawCall = async (id: string): Promise<RawCall> => {
  const res = await api.get<BackendRawCall>(`/calls/${id}`);
  return mapCall(res.data);
};

/** PATCH /evals/:evalId — submit ground-truth corrections */
export const apiSubmitEval = async (evalId: string, data: Partial<Eval>): Promise<Eval> => {
  const body: Record<string, unknown> = {};

  // Map frontend gt_* fields → backend EvalUpdate schema
  if (data.gt_nps_score !== undefined) body.gt_nps_score = data.gt_nps_score;
  if (data.gt_call_summary !== undefined) body.gt_call_summary = data.gt_call_summary;
  if (data.gt_overall_feedback !== undefined) body.gt_overall_feedback = data.gt_overall_feedback;
  if (data.gt_positive_mentions !== undefined) body.gt_positive_mentions = data.gt_positive_mentions;
  if (data.gt_detractors !== undefined) body.gt_detractors = data.gt_detractors;
  if (data.gt_is_incomplete_call !== undefined) body.gt_is_incomplete_call = data.gt_is_incomplete_call;
  if (data.gt_incomplete_reason  !== undefined) body.gt_incomplete_reason  = data.gt_incomplete_reason;
  if (data.gt_is_dnc_request     !== undefined) body.gt_is_dnc_request     = data.gt_is_dnc_request;
  if (data.gt_escalation_needed  !== undefined) body.gt_escalation_needed  = data.gt_escalation_needed;
  if (data.status) body.eval_status = data.status;

  // Default to completed when submitting
  if (!body.eval_status) body.eval_status = "completed";
  body.has_corrections = Object.keys(data.corrections ?? {}).length > 0;

  const { data: result } = await api.patch<BackendEval>(`/evals/${evalId}`, body);
  return mapEval(result);
};

/** POST /users — create a new user (admin+ only) */
export const apiCreateUser = async (payload: {
  email: string;
  password: string;
  name: string;
  role: string;
}): Promise<User> => {
  const { data } = await api.post<BackendUser>("/users", payload);
  return {
    id: String(data.id),
    email: data.email,
    name: data.name,
    role: data.role as User["role"],
    is_active: data.is_active,
    must_change_password: data.must_change_password,
  };
};

/** PATCH /users/:id — update user fields (admin+ only) */
export const apiUpdateUser = async (userId: string, patch: { is_active?: boolean; role?: string }): Promise<User> => {
  const { data } = await api.patch<BackendUser>(`/users/${userId}`, patch);
  return {
    id: String(data.id),
    email: data.email,
    name: data.name,
    role: data.role as User["role"],
    is_active: data.is_active,
    must_change_password: data.must_change_password,
  };
};

/** GET /users — returns all users (admin+ only) */
export const apiGetUsers = async (): Promise<User[]> => {
  const { data } = await api.get<BackendUser[]>("/users");
  return data.map((u) => ({
    id: String(u.id),
    email: u.email,
    name: u.name,
    role: u.role as User["role"],
    is_active: u.is_active,
    must_change_password: u.must_change_password,
  }));
};

interface BackendUser {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
}

/** GET /admin/assignment-config — returns current assignment config (superadmin only) */
export const apiGetAssignmentConfig = async (): Promise<AssignmentConfig> => {
  const { data } = await api.get<AssignmentConfig>("/admin/assignment-config");
  return data;
};

/** PATCH /admin/assignment-config — update assignment config (superadmin only) */
export const apiUpdateAssignmentConfig = async (
  patch: Partial<AssignmentConfig>
): Promise<AssignmentConfig> => {
  const { data } = await api.patch<AssignmentConfig>("/admin/assignment-config", patch);
  return data;
};

/** GET /health — returns backend liveness status */
export const apiGetHealth = async (): Promise<SystemHealth> => {
  try {
    const { data } = await api.get<{ status: string }>("/health");
    return { status: data.status ?? "ok" };
  } catch {
    return { status: "unreachable" };
  }
};

interface BackendTeamMember {
  id: number;
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

/** GET /team — returns per-reviewer eval stats (admin+) */
export const apiGetTeam = async (): Promise<TeamMember[]> => {
  const { data } = await api.get<BackendTeamMember[]>("/team");
  return data.map((m) => ({
    id: String(m.id),
    name: m.name,
    email: m.email,
    role: m.role,
    calls_assigned: m.calls_assigned,
    calls_pending: m.calls_pending,
    completed_total: m.completed_total,
    completed_today: m.completed_today,
    completion_pct: m.completion_pct,
    correction_rate: m.correction_rate,
    avg_nps: m.avg_nps,
  }));
};

export interface AllCallsParams {
  source_env?: string;
  call_status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  organization_name?: string;
  nps_filter?: string;
  sort_by?: string;
  sort_dir?: string;
  limit?: number;
  offset?: number;
}

/** GET /calls/all — paginated calls from the DB (admin+) */
export const apiGetAllCalls = async (params?: AllCallsParams): Promise<RawCall[]> => {
  const { data } = await api.get<BackendRawCall[]>("/calls/all", { params });
  return data.map(mapCall);
};

/** GET /calls/all/count — total count of calls matching filters (admin+) */
export const apiGetAllCallsCount = async (params?: Omit<AllCallsParams, "limit" | "offset" | "sort_by" | "sort_dir">): Promise<number> => {
  const { data } = await api.get<{ count: number }>("/calls/all/count", { params });
  return data.count;
};

export interface AllCallsStatsResult {
  avg_duration_sec: number | null;
  avg_nps: number | null;
}

/** GET /calls/all/stats — avg duration and avg NPS across all calls matching filters (reviewer+) */
export const apiGetAllCallsStats = async (params?: Omit<AllCallsParams, "limit" | "offset" | "sort_by" | "sort_dir">): Promise<AllCallsStatsResult> => {
  const { data } = await api.get<AllCallsStatsResult>("/calls/all/stats", { params });
  return data;
};

/** GET /admin/envs — returns all environment configurations (admin+) */
export const apiGetEnvs = async (): Promise<EnvConfig[]> => {
  const { data } = await api.get<EnvConfig[]>("/admin/envs");
  return data;
};

export interface BugsParams {
  date_from: string;
  date_to: string;
  source_env?: string;
  organization_name?: string;
  is_resolved?: boolean;
  bug_type?: string;
  is_internal?: boolean;
  limit?: number;
  offset?: number;
}

export interface BugsStatsResult {
  total_bugs: number;
  unique_orgs: number;
  unique_rooftops: number;
  top_bug_type: string | null;
}

export interface MyBugsParams {
  is_resolved?: boolean;
  organization_name?: string;
  bug_type?: string;
  is_internal?: boolean;
  limit?: number;
  offset?: number;
}

/** GET /bugs — paginated bug reports for a date range (admin+) */
export const apiGetBugs = async (params: BugsParams): Promise<BugReport[]> => {
  const { data } = await api.get<BugReport[]>("/bugs", { params });
  return data;
};

/** GET /bugs/count — total count of bugs matching filters (admin+) */
export const apiGetBugsCount = async (params: Omit<BugsParams, "limit" | "offset">): Promise<number> => {
  const { data } = await api.get<{ count: number }>("/bugs/count", { params });
  return data.count;
};

/** GET /bugs/stats — summary stats for a date range (admin+) */
export const apiGetBugsStats = async (params: { date_from: string; date_to: string; source_env?: string; organization_name?: string; bug_type?: string }): Promise<BugsStatsResult> => {
  const { data } = await api.get<BugsStatsResult>("/bugs/stats", { params });
  return data;
};

/** GET /bugs/my — paginated bugs assigned to the current user (any role) */
export const apiGetMyBugs = async (params?: MyBugsParams): Promise<BugReport[]> => {
  const { data } = await api.get<BugReport[]>("/bugs/my", { params });
  return data;
};

/** GET /bugs/my/count — total count of bugs assigned to the current user */
export const apiGetMyBugsCount = async (params?: Omit<MyBugsParams, "limit" | "offset">): Promise<number> => {
  const { data } = await api.get<{ count: number }>("/bugs/my/count", { params });
  return data.count;
};

/** PATCH /bugs/:id/assign — assign or unassign a bug (admin+) */
export const apiAssignBug = async (bugId: number, userId: number | null): Promise<BugReport> => {
  const { data } = await api.patch<BugReport>(`/bugs/${bugId}/assign`, { user_id: userId });
  return data;
};

/** PATCH /bugs/:id/resolve — mark a bug resolved or reopen it (any role) */
export const apiResolveBug = async (bugId: number, isResolved: boolean): Promise<BugReport> => {
  const { data } = await api.patch<BugReport>(`/bugs/${bugId}/resolve`, { is_resolved: isResolved });
  return data;
};

export interface CreateBugPayload {
  call_id?: number | null;
  organization_name?: string | null;
  rooftop_name?: string | null;
  bug_types: string[];
  description?: string | null;
}

export const apiCreateBug = async (payload: CreateBugPayload): Promise<BugReport> => {
  const { data } = await api.post<BugReport>("/bugs", payload);
  return data;
};

export interface DashboardStats {
  nps: { promoters: number; neutrals: number; detractors: number; unscored: number };
  correction_rate: number;
  open_bugs: number;
  sync: {
    last_call_sync: string | null;
    calls_today: number;
    last_bug_sync: string | null;
    bugs_today: number;
  };
}

/** GET /stats/dashboard — aggregate stats for the admin dashboard */
export const apiGetDashboardStats = async (): Promise<DashboardStats> => {
  const { data } = await api.get<DashboardStats>("/stats/dashboard");
  return data;
};

export default api;
