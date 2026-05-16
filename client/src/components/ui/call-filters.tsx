import { useState, useRef, useEffect } from "react";
import { Search, X, ArrowUpDown, ChevronDown, Check, SlidersHorizontal } from "lucide-react";
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
  callType: "all" | "service" | "sales";
  isBookmarked: boolean;
  qualityTag: "all" | "AGENT_HANDLED_WELL" | "AGENT_FAILED";
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
  callType: "all",
  isBookmarked: false,
  qualityTag: "all",
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
  showCallType?: boolean;
  showBookmarked?: boolean;
  showQualityTag?: boolean;
  envOptions?: string[];
  orgOptions?: string[];
  placeholder?: string;
}

/* ── Internal sub-components ────────────────────────────────────────── */

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p
        className="text-[10px] uppercase tracking-widest font-medium"
        style={{ color: "#4a4f58", fontFeatureSettings: FF }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

type SegOpt<T extends string> = { value: T; label: string };

function SegmentedGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegOpt<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="px-2.5 py-1 rounded-md text-[12px] transition-all cursor-pointer"
            style={{
              background: active ? "rgba(113,112,255,0.15)" : "rgba(255,255,255,0.03)",
              color: active ? "#a5a4ff" : "#8a8f98",
              border: `1px solid ${active ? "rgba(113,112,255,0.3)" : "rgba(255,255,255,0.06)"}`,
              fontFeatureSettings: FF,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function TogglePill({
  active,
  label,
  onToggle,
}: {
  active: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] transition-all cursor-pointer"
      style={{
        background: active ? "rgba(113,112,255,0.15)" : "rgba(255,255,255,0.03)",
        color: active ? "#a5a4ff" : "#8a8f98",
        border: `1px solid ${active ? "rgba(113,112,255,0.3)" : "rgba(255,255,255,0.06)"}`,
        fontFeatureSettings: FF,
      }}
    >
      {active && <Check className="h-3 w-3 shrink-0" />}
      {label}
    </button>
  );
}

/* ── Sort labels ────────────────────────────────────────────────────── */

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

/* ── Main component ─────────────────────────────────────────────────── */

export function CallFilterBar(props: CallFilterBarProps) {
  const { value, onChange } = props;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const filtersRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filtersOpen) return;
    const handler = (e: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filtersOpen]);

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

  const activeFilterCount = [
    props.showCallStatus  && value.callStatus  !== "all",
    props.showCallType    && value.callType    !== "all",
    props.showNps         && value.npsFilter   !== "all",
    props.showEvalStatus  && value.evalStatus  !== "all",
    props.showPostCallSms && value.postCallSms !== "all",
    props.showBookmarked  && value.isBookmarked,
    props.showQualityTag  && value.qualityTag  !== "all",
    props.showOrg         && value.org         !== "all",
    props.showEnv         && value.env         !== "all",
  ].filter(Boolean).length;

  const hasSecondaryFilters = !!(
    props.showCallStatus ||
    props.showCallType ||
    props.showNps ||
    props.showEvalStatus ||
    props.showPostCallSms ||
    props.showBookmarked ||
    props.showQualityTag ||
    (props.showOrg && props.orgOptions && props.orgOptions.length > 0) ||
    (props.showEnv && props.envOptions && props.envOptions.length > 0)
  );

  const sortKey = `${value.sortBy}_${value.sortDir}`;

  const hasAny = !!(
    value.search ||
    (props.showDateRange   && value.dateRange?.from) ||
    activeFilterCount > 0 ||
    (props.showSort && (value.sortBy !== "date" || value.sortDir !== "desc"))
  );

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
          <button onClick={() => set({ search: "" })} className="cursor-pointer">
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

      {/* Filters popover */}
      {hasSecondaryFilters && (
        <div className="relative" ref={filtersRef}>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center h-9 gap-1.5 px-3 rounded-md border text-[13px] transition-all cursor-pointer"
            style={{
              background:   filtersOpen || activeFilterCount > 0 ? "rgba(113,112,255,0.06)" : "rgba(255,255,255,0.02)",
              borderColor:  filtersOpen || activeFilterCount > 0 ? "rgba(113,112,255,0.2)"  : "rgba(255,255,255,0.08)",
              color:        filtersOpen || activeFilterCount > 0 ? "#a5a4ff" : "#8a8f98",
              fontFeatureSettings: FF,
            }}
          >
            <SlidersHorizontal
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: filtersOpen || activeFilterCount > 0 ? "#a5a4ff" : "#62666d" }}
            />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-semibold"
                style={{ background: "rgba(113,112,255,0.3)", color: "#a5a4ff" }}
              >
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              className="h-3 w-3 transition-transform duration-150"
              style={{
                color: "#62666d",
                transform: filtersOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          {filtersOpen && (
            <div
              className="absolute top-full mt-1.5 left-0 z-50 rounded-xl p-4 space-y-4"
              style={{
                background: "#191a1b",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.2)",
                width: "300px",
              }}
            >
              {props.showCallStatus && (
                <FilterSection label="Call Status">
                  <SegmentedGroup
                    value={value.callStatus}
                    onChange={(v) => set({ callStatus: v })}
                    options={[
                      { value: "all",       label: "All"       },
                      { value: "Completed", label: "Completed" },
                      { value: "Missed",    label: "Missed"    },
                    ]}
                  />
                </FilterSection>
              )}

              {props.showCallType && (
                <FilterSection label="Call Type">
                  <SegmentedGroup
                    value={value.callType}
                    onChange={(v) => set({ callType: v })}
                    options={[
                      { value: "all",     label: "All"     },
                      { value: "service", label: "Service" },
                      { value: "sales",   label: "Sales"   },
                    ]}
                  />
                </FilterSection>
              )}

              {props.showNps && (
                <FilterSection label="NPS Score">
                  <SegmentedGroup
                    value={value.npsFilter}
                    onChange={(v) => set({ npsFilter: v })}
                    options={[
                      { value: "all",       label: "All"       },
                      { value: "promoter",  label: "Promoter"  },
                      { value: "passive",   label: "Passive"   },
                      { value: "detractor", label: "Detractor" },
                    ]}
                  />
                </FilterSection>
              )}

              {props.showEvalStatus && (
                <FilterSection label="Review Status">
                  <SegmentedGroup
                    value={value.evalStatus}
                    onChange={(v) => set({ evalStatus: v })}
                    options={[
                      { value: "all",       label: "All"       },
                      { value: "pending",   label: "Pending"   },
                      { value: "completed", label: "Completed" },
                    ]}
                  />
                </FilterSection>
              )}

              {(props.showPostCallSms || props.showBookmarked) && (
                <FilterSection label="Tags">
                  <div className="flex flex-wrap gap-1.5">
                    {props.showPostCallSms && (
                      <TogglePill
                        active={value.postCallSms === "yes"}
                        label="Post-call SMS"
                        onToggle={() => set({ postCallSms: value.postCallSms === "yes" ? "all" : "yes" })}
                      />
                    )}
                    {props.showBookmarked && (
                      <TogglePill
                        active={value.isBookmarked}
                        label="Bookmarked"
                        onToggle={() => set({ isBookmarked: !value.isBookmarked, ...(!value.isBookmarked ? {} : { qualityTag: "all" }) })}
                      />
                    )}
                  </div>
                </FilterSection>
              )}

              {props.showQualityTag && value.isBookmarked && (
                <FilterSection label="Quality Tag">
                  <SegmentedGroup
                    value={value.qualityTag}
                    onChange={(v) => set({ qualityTag: v })}
                    options={[
                      { value: "all",                label: "All"          },
                      { value: "AGENT_HANDLED_WELL", label: "Handled Well" },
                      { value: "AGENT_FAILED",       label: "Agent Failed" },
                    ]}
                  />
                </FilterSection>
              )}

              {props.showOrg && props.orgOptions && props.orgOptions.length > 0 && (
                <FilterSection label="Organization">
                  <DropdownSelect
                    value={value.org === "all" ? "" : value.org}
                    onChange={(v) => set({ org: v || "all" })}
                    options={[
                      { value: "", label: "All orgs" },
                      ...props.orgOptions.map((o) => ({ value: o, label: o })),
                    ]}
                  />
                </FilterSection>
              )}

              {props.showEnv && props.envOptions && props.envOptions.length > 0 && (
                <FilterSection label="Environment">
                  <DropdownSelect
                    value={value.env === "all" ? "" : value.env}
                    onChange={(v) => set({ env: v || "all" })}
                    options={[
                      { value: "", label: "All envs" },
                      ...props.envOptions.map((e) => ({ value: e, label: e })),
                    ]}
                  />
                </FilterSection>
              )}

              {activeFilterCount > 0 && (
                <button
                  className="w-full text-[12px] py-1.5 rounded-md transition-all cursor-pointer"
                  style={{
                    color: "#8a8f98",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    fontFeatureSettings: FF,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#d0d6e0"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98"; }}
                  onClick={() => {
                    onChange({ ...DEFAULT_FILTERS, search: value.search, dateRange: value.dateRange, sortBy: value.sortBy, sortDir: value.sortDir, qualityTag: "all" });
                    setFiltersOpen(false);
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sort */}
      {props.showSort && (
        <div className="relative" ref={sortRef}>
          <button
            className="flex items-center h-9 gap-1.5 px-3 rounded-md border text-[13px] transition-all cursor-pointer"
            style={{
              background:  sortOpen || sortKey !== "date_desc" ? "rgba(113,112,255,0.06)" : "rgba(255,255,255,0.02)",
              borderColor: sortOpen || sortKey !== "date_desc" ? "rgba(113,112,255,0.2)"  : "rgba(255,255,255,0.08)",
              color:       sortOpen || sortKey !== "date_desc" ? "#a5a4ff" : "#8a8f98",
              fontFeatureSettings: FF,
            }}
            onClick={() => setSortOpen((v) => !v)}
          >
            <ArrowUpDown
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: sortOpen || sortKey !== "date_desc" ? "#a5a4ff" : "#62666d" }}
            />
            <span>{SORT_LABELS[sortKey]}</span>
            <ChevronDown
              className="h-3 w-3 transition-transform duration-150"
              style={{ color: "#62666d", transform: sortOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {sortOpen && (
            <div
              className="absolute top-full mt-1.5 right-0 z-50 rounded-lg overflow-hidden py-1"
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
                      const by  = k.slice(0, idx) as CallFilterState["sortBy"];
                      const dir = k.slice(idx + 1) as CallFilterState["sortDir"];
                      set({ sortBy: by, sortDir: dir });
                      setSortOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors cursor-pointer"
                    style={{
                      color:      active ? "#a5a4ff" : "#8a8f98",
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
                    {active && <Check className="h-3 w-3 shrink-0" style={{ color: "#a5a4ff" }} />}
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
          className="h-9 px-3 rounded-md text-[13px] transition-all cursor-pointer"
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
