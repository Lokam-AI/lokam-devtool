import axios from "axios";
import { useAuthStore } from "@/store/auth-store";
import type {
  User,
  RawCall,
  Eval,
  CallWithEval,
  TeamMember,
  SystemHealth,
  EnvConfig,
} from "@/types";

// Backend base URL — during dev the Vite proxy forwards /api → localhost:8000
const API_BASE = "/api/v1";

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
    organization_name: r.organization_name ?? "",
    rooftop_name: r.rooftop_name ?? "",
    call_status: r.call_status ?? "",
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
    ai_callback_requested: false,
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
  organization_name: string | null;
  rooftop_name: string | null;
  call_status: string | null;
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
  formatted_transcript: string | null;
  raw_transcript: string | null;
  recording_url: string | null;
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

/** GET /evals/my + /calls/:lokam_call_id — returns eval-driven list of calls with their evals */
export const apiGetCalls = async (): Promise<CallWithEval[]> => {
  const evalsRes = await api.get<BackendEval[]>("/evals/my").catch(() => ({ data: [] as BackendEval[] }));
  const evals = evalsRes.data;
  if (!evals.length) return [];

  // Fetch each call by its lokam_call_id (stored in eval.call_id)
  const callResults = await Promise.all(
    evals.map((e) => api.get<BackendRawCall>(`/calls/${e.call_id}`).catch(() => null))
  );

  // Pair by index — key the map by lokam_call_id (eval.call_id)
  const callMap = new Map<number, RawCall>();
  evals.forEach((e, i) => {
    const res = callResults[i];
    if (res) callMap.set(e.call_id, mapCall(res.data));
  });

  return evals
    .filter((e) => callMap.has(e.call_id))
    .map((e) => ({ call: callMap.get(e.call_id)!, eval: mapEval(e) }));
};

/** GET single call with its eval by lokam_call_id */
export const apiGetCall = async (id: string): Promise<CallWithEval | undefined> => {
  // First try to find via assigned evals
  const allCalls = await apiGetCalls();
  const found = allCalls.find((c) => c.call.id === id);
  if (found) return found;

  // Fallback: fetch the call directly (admin+ only, for All Calls page)
  try {
    const { data: raw } = await api.get<BackendRawCall>(`/calls/${id}`);
    const call = mapCall(raw);
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

/** PATCH /evals/:evalId — submit ground-truth corrections */
export const apiSubmitEval = async (evalId: string, data: Partial<Eval>): Promise<Eval> => {
  const body: Record<string, unknown> = {};

  // Map frontend gt_* fields → backend EvalUpdate schema
  if (data.gt_nps_score !== undefined) body.gt_nps_score = data.gt_nps_score;
  if (data.gt_call_summary !== undefined) body.gt_call_summary = data.gt_call_summary;
  if (data.gt_overall_feedback !== undefined) body.gt_overall_feedback = data.gt_overall_feedback;
  if (data.gt_positive_mentions !== undefined) body.gt_positive_mentions = data.gt_positive_mentions;
  if (data.gt_detractors !== undefined) body.gt_detractors = data.gt_detractors;
  if (data.gt_is_resolved !== undefined) body.gt_is_incomplete_call = !data.gt_is_resolved;
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

/** GET /health — system health (backend only returns {status: "ok"}) */
export const apiGetHealth = async (): Promise<SystemHealth> => {
  return { active_calls: 0, queue_depth: 0, workers: 0, uptime: "—" };
};

/** Placeholder — backend doesn't have a team endpoint yet */
export const apiGetTeam = async (): Promise<TeamMember[]> => {
  const users = await apiGetUsers();
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    calls_assigned: 0,
    completed_today: 0,
    completion_pct: 0,
  }));
};

/** GET /calls/all — returns all calls from the DB (admin+) */
export const apiGetAllCalls = async (params?: {
  source_env?: string;
  call_status?: string;
  limit?: number;
  offset?: number;
}): Promise<RawCall[]> => {
  const { data } = await api.get<BackendRawCall[]>("/calls/all", { params });
  return data.map(mapCall);
};

/** GET /calls/all/count — total count of calls (admin+) */
export const apiGetAllCallsCount = async (params?: {
  source_env?: string;
  call_status?: string;
}): Promise<number> => {
  const { data } = await api.get<{ count: number }>("/calls/all/count", { params });
  return data.count;
};

/** GET /admin/envs — returns all environment configurations (admin+) */
export const apiGetEnvs = async (): Promise<EnvConfig[]> => {
  const { data } = await api.get<EnvConfig[]>("/admin/envs");
  return data;
};

export default api;
