import { useState, useRef, useEffect } from "react";
import { Search, X, ArrowUpDown, ChevronDown, Check } from "lucide-react";
import { DateRangePicker } from "./date-range-picker";
import { DropdownSelect } from "./dropdown-select";
import type { DateRange } from "react-day-picker";

const FF = '"cv01", "ss03"' as const;

/* ── Types ─────────────────────────────────────────────────────────── */

export interface CallFilterState {
  search: string;
  evalStatus: "all" | "pending" | "completed";
  callStatus: "all" | "Completed" | "Missed";
  npsFilter: "all" | "promoter" | "passive" | "detractor";
  env: string;
  org: string;
  dateRange: DateRange | undefined;
  sortBy: "date" | "nps" | "duration" | "status";
  sortDir: "asc" | "desc";
  postCallSms: "all" | "yes" | "no";
}

export const DEFAULT_FILTERS: CallFilterState = {
  search: "",
  evalStatus: "all",
  callStatus: "all",
  npsFilter: "all",
  env: "all",
  org: "all",
  dateRange: undefined,
  sortBy: "date",
  sortDir: "desc",
  postCallSms: "all",
};

/* ── Props ─────────────────────────────────────────────────────────── */

export interface CallFilterBarProps {
  value: CallFilterState;
  onChange: (next: CallFilterState) => void;
  showEvalStatus?: boolean;
  showCallStatus?: boolean;
  showNps?: boolean;
  showEnv?: boolean;
  showOrg?: boolean;
  showDateRange?: boolean;
  showSort?: boolean;
  showPostCallSms?: boolean;
  envOptions?: string[];
  orgOptions?: string[];
  placeholder?: string;
}

/* ── Main component ─────────────────────────────────────────────────── */

export function CallFilterBar(props: CallFilterBarProps) {
  const { value, onChange } = props;
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sortOpen]);

  const set = (patch: Partial<CallFilterState>) => onChange({ ...value, ...patch });
  const hasAny = !!(
    value.search ||
    (props.showEvalStatus  && value.evalStatus  !== "all") ||
    (props.showCallStatus  && value.callStatus  !== "all") ||
    (props.showNps         && value.npsFilter   !== "all") ||
    (props.showEnv         && value.env         !== "all") ||
    (props.showOrg         && value.org         !== "all") ||
    (props.showDateRange   && value.dateRange?.from)       ||
    (props.showSort        && (value.sortBy !== "date" || value.sortDir !== "desc")) ||
    (props.showPostCallSms && value.postCallSms !== "all")
  );

  const SORT_LABELS: Record<string, string> = {
    date_desc:     "Newest first",
    date_asc:      "Oldest first",
    status_asc:    "Pending first",
    status_desc:   "Completed first",
    nps_desc:      "NPS high→low",
    nps_asc:       "NPS low→high",
    duration_desc: "Longest first",
    duration_asc:  "Shortest first",
  };
  const sortKey = `${value.sortBy}_${value.sortDir}`;

  return (
    <div className="flex items-center gap-2 flex-wrap">

      {/* Search */}
      <div
        className="flex items-center gap-2 px-3 h-9 rounded-md border flex-1 min-w-[180px] max-w-xs transition-all"
        style={{
          background: "rgba(255,255,255,0.02)",
          borderColor: "rgba(255,255,255,0.08)",
        }}
        onFocusCapture={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(113,112,255,0.35)";
        }}
        onBlurCapture={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
        }}
      >
        <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "#62666d" }} />
        <input
          className="bg-transparent border-none text-[13px] focus:outline-none w-full placeholder:text-[#62666d]"
          style={{ color: "#d0d6e0", fontFeatureSettings: FF }}
          placeholder={props.placeholder ?? "Search…"}
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
        />
        {value.search && (
          <button onClick={() => set({ search: "" })}>
            <X className="h-3 w-3" style={{ color: "#62666d" }} />
          </button>
        )}
      </div>

      {/* Date range */}
      {props.showDateRange && (
        <DateRangePicker
          value={value.dateRange}
          onChange={(r) => set({ dateRange: r })}
        />
      )}

      {/* Review Status */}
      {props.showEvalStatus && (
        <DropdownSelect
          value={value.evalStatus === "all" ? "" : value.evalStatus}
          onChange={(v) => set({ evalStatus: (v || "all") as CallFilterState["evalStatus"] })}
          options={[
            { value: "",          label: "All statuses" },
            { value: "pending",   label: "Pending"      },
            { value: "completed", label: "Completed"    },
          ]}
        />
      )}

      {/* Call Status */}
      {props.showCallStatus && (
        <DropdownSelect
          value={value.callStatus === "all" ? "" : value.callStatus}
          onChange={(v) => set({ callStatus: (v || "all") as CallFilterState["callStatus"] })}
          options={[
            { value: "",          label: "All calls"  },
            { value: "Completed", label: "Completed"  },
            { value: "Missed",    label: "Missed"     },
          ]}
        />
      )}

      {/* NPS Score */}
      {props.showNps && (
        <DropdownSelect
          value={value.npsFilter === "all" ? "" : value.npsFilter}
          onChange={(v) => set({ npsFilter: (v || "all") as CallFilterState["npsFilter"] })}
          options={[
            { value: "",           label: "All NPS"          },
            { value: "promoter",   label: "Promoter (9–10)"  },
            { value: "passive",    label: "Passive (7–8)"    },
            { value: "detractor",  label: "Detractor (≤6)"   },
          ]}
        />
      )}

      {/* Post-call SMS */}
      {props.showPostCallSms && (
        <button
          className="flex items-center h-9 gap-1.5 px-3 rounded-md border text-[13px] transition-all"
          aria-pressed={value.postCallSms === "yes"}
          aria-label="Filter calls with post-call SMS"
          style={{
            background: value.postCallSms === "yes" ? "rgba(113,112,255,0.15)" : "rgba(255,255,255,0.02)",
            borderColor: value.postCallSms === "yes" ? "rgba(113,112,255,0.4)" : "rgba(255,255,255,0.08)",
            color: value.postCallSms === "yes" ? "#fff" : "#8a8f98",
            fontFeatureSettings: FF,
          }}
          onClick={() => set({ postCallSms: value.postCallSms === "yes" ? "all" : "yes" })}
          onMouseEnter={(e) => {
            if (value.postCallSms !== "yes") {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(113,112,255,0.3)";
            }
          }}
          onMouseLeave={(e) => {
            if (value.postCallSms !== "yes") {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)";
            }
          }}
        >
          SMS
        </button>
      )}

      {/* Environment */}
      {props.showEnv && props.envOptions && (
        <DropdownSelect
          value={value.env === "all" ? "" : value.env}
          onChange={(v) => set({ env: v || "all" })}
          options={[
            { value: "", label: "All envs" },
            ...props.envOptions.map((e) => ({ value: e, label: e })),
          ]}
        />
      )}

      {/* Organization */}
      {props.showOrg && props.orgOptions && props.orgOptions.length > 0 && (
        <DropdownSelect
          value={value.org === "all" ? "" : value.org}
          onChange={(v) => set({ org: v || "all" })}
          options={[
            { value: "", label: "All orgs" },
            ...props.orgOptions.map((o) => ({ value: o, label: o })),
          ]}
        />
      )}

      {/* Sort */}
      {props.showSort && (
        <div className="relative" ref={sortRef}>
          <button
            className="flex items-center h-9 gap-1.5 px-3 rounded-md border text-[13px] transition-all"
            style={{
              background: sortOpen || sortKey !== "date_desc" ? "rgba(113,112,255,0.06)" : "rgba(255,255,255,0.02)",
              borderColor: sortOpen || sortKey !== "date_desc" ? "rgba(113,112,255,0.2)" : "rgba(255,255,255,0.08)",
              color: sortOpen || sortKey !== "date_desc" ? "#7170ff" : "#8a8f98",
              fontFeatureSettings: FF,
            }}
            onClick={() => setSortOpen((v) => !v)}
          >
            <ArrowUpDown className="h-3.5 w-3.5 shrink-0" style={{ color: sortOpen || sortKey !== "date_desc" ? "#7170ff" : "#62666d" }} />
            <span>{SORT_LABELS[sortKey]}</span>
            <ChevronDown
              className="h-3 w-3 transition-transform duration-150"
              style={{ color: "#62666d", transform: sortOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {sortOpen && (
            <div
              className="absolute top-full mt-1.5 left-0 z-50 rounded-lg overflow-hidden py-1"
              style={{
                background: "#191a1b",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.2)",
                minWidth: "168px",
              }}
            >
              {Object.entries(SORT_LABELS).map(([k, label]) => {
                const active = k === sortKey;
                return (
                  <button
                    key={k}
                    onClick={() => {
                      const idx = k.lastIndexOf("_");
                      const by = k.slice(0, idx) as CallFilterState["sortBy"];
                      const dir = k.slice(idx + 1) as CallFilterState["sortDir"];
                      set({ sortBy: by, sortDir: dir });
                      setSortOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors"
                    style={{
                      color: active ? "#7170ff" : "#8a8f98",
                      background: active ? "rgba(113,112,255,0.08)" : "transparent",
                      fontWeight: active ? 510 : 400,
                      fontFeatureSettings: FF,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                        (e.currentTarget as HTMLButtonElement).style.color = "#d0d6e0";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98";
                      }
                    }}
                  >
                    <span className="flex-1">{label}</span>
                    {active && <Check className="h-3 w-3 shrink-0" style={{ color: "#7170ff" }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Clear all */}
      {hasAny && (
        <button
          className="h-9 px-3 rounded-md text-[13px] transition-all"
          style={{ color: "#62666d", fontFeatureSettings: FF }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#d0d6e0"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#62666d"; }}
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
        >
          Clear all
        </button>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────── */

const SORT_LABELS: Record<string, string> = {
  date_desc:     "Newest first",
  date_asc:      "Oldest first",
  status_asc:    "Pending first",
  status_desc:   "Completed first",
  nps_desc:      "NPS high→low",
  nps_asc:       "NPS low→high",
  duration_desc: "Longest first",
  duration_asc:  "Shortest first",
};

/* ── Client-side filter + sort helper ──────────────────────────────── */

export function applyCallFilters<T extends {
  call: {
    call_id: string; campaign: string; organization_name: string;
    rooftop_name: string; date: string; duration: number; ai_nps_score: number | null;
  };
  eval: { status: string };
}>(data: T[], f: CallFilterState): T[] {
  return data
    .filter((c) => {
      if (f.evalStatus !== "all" && c.eval.status !== f.evalStatus) return false;

      if (f.npsFilter !== "all") {
        const s = c.call.ai_nps_score;
        if (s === null) return false;
        if (f.npsFilter === "promoter"  && s < 9) return false;
        if (f.npsFilter === "passive"   && (s < 7 || s > 8)) return false;
        if (f.npsFilter === "detractor" && s > 6) return false;
      }

      if (f.dateRange?.from) {
        const callDate = new Date(c.call.date);
        const from = new Date(f.dateRange.from); from.setHours(0, 0, 0, 0);
        const to = f.dateRange.to ? new Date(f.dateRange.to) : new Date(from);
        to.setHours(23, 59, 59, 999);
        if (callDate < from || callDate > to) return false;
      }

      if (f.org !== "all" && c.call.organization_name !== f.org) return false;

      if (f.search) {
        const q = f.search.toLowerCase();
        const hit =
          c.call.call_id.toLowerCase().includes(q) ||
          c.call.campaign.toLowerCase().includes(q) ||
          c.call.organization_name.toLowerCase().includes(q) ||
          c.call.rooftop_name.toLowerCase().includes(q);
        if (!hit) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const mul = f.sortDir === "asc" ? 1 : -1;
      if (f.sortBy === "date") {
        return mul * (new Date(a.call.date).getTime() - new Date(b.call.date).getTime());
      }
      if (f.sortBy === "nps") {
        const an = a.call.ai_nps_score ?? -1;
        const bn = b.call.ai_nps_score ?? -1;
        return mul * (an - bn);
      }
      if (f.sortBy === "duration") {
        return mul * (a.call.duration - b.call.duration);
      }
      if (f.sortBy === "status") {
        const order: Record<string, number> = { pending: 0, completed: 1 };
        return mul * ((order[a.eval.status] ?? 2) - (order[b.eval.status] ?? 2));
      }
      return 0;
    });
}
