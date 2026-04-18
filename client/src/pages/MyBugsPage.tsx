import { useState, useMemo, useEffect } from "react";
import { Bug, AlertTriangle, RefreshCw, Filter, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useMyBugs, useMyBugsCount, useResolveBug } from "@/hooks/use-calls";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { BugDetailDrawer } from "@/components/bugs/BugDetailDrawer";
import { BugTypeChip } from "@/pages/BugsPage";
import type { BugReport } from "@/types";

const FF = '"cv01", "ss03"' as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const PAGE_SIZE = 30;

export default function MyBugsPage() {
  const resolveBug = useResolveBug();
  const [selected, setSelected] = useState<BugReport | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("all");
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [bugTypeFilter, setBugTypeFilter] = useState<string>("");
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [statusFilter, orgFilter, bugTypeFilter]);

  const bugsParams = useMemo(() => ({
    is_resolved:       statusFilter === "open" ? false : statusFilter === "resolved" ? true : undefined,
    organization_name: orgFilter || undefined,
    bug_type:          bugTypeFilter || undefined,
    limit:             PAGE_SIZE,
    offset:            page * PAGE_SIZE,
  }), [statusFilter, orgFilter, bugTypeFilter, page]);

  const countParams = useMemo(() => ({
    is_resolved:       statusFilter === "open" ? false : statusFilter === "resolved" ? true : undefined,
    organization_name: orgFilter || undefined,
    bug_type:          bugTypeFilter || undefined,
  }), [statusFilter, orgFilter, bugTypeFilter]);

  const { data: bugs = [], isLoading, isFetching, refetch } = useMyBugs(bugsParams);
  const { data: totalCount = 0 } = useMyBugsCount(countParams);
  const { data: openCount = 0 } = useMyBugsCount({ is_resolved: false });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const selectedLive = selected ? (bugs.find((b) => b.id === selected.id) ?? selected) : null;

  const orgOptions     = useMemo(() => Array.from(new Set(bugs.map((b) => b.organization_name).filter(Boolean) as string[])).sort(), [bugs]);
  const bugTypeOptions = useMemo(() => Array.from(new Set(bugs.flatMap((b) => b.bug_types ?? []))).sort(), [bugs]);

  const activeFilterCount = [statusFilter !== "all", !!orgFilter, !!bugTypeFilter].filter(Boolean).length;

  return (
    <div
      className="min-h-screen p-6 space-y-6"
      style={{ background: "#0f1011", fontFamily: "Inter Variable, system-ui, sans-serif" }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1
            className="text-[22px] leading-none mb-1"
            style={{ color: "#f7f8f8", fontWeight: 510, letterSpacing: "-0.3px", fontFeatureSettings: FF }}
          >
            My Bugs
          </h1>
          <p className="text-[13px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>
            Bug reports assigned to you
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-9 flex items-center gap-1.5 rounded-md px-3 text-[13px]"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#8a8f98",
            fontFeatureSettings: FF,
          }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Count badge ────────────────────────────────────────── */}
      {!isLoading && (
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4" style={{ color: openCount > 0 ? "#7170ff" : "#10b981" }} />
          <span className="text-[13px]" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>
            {openCount > 0
              ? <><span style={{ color: "#7170ff", fontWeight: 510 }}>{openCount}</span> open bug{openCount !== 1 ? "s" : ""} assigned to you</>
              : <span style={{ color: "#10b981", fontWeight: 510 }}>All bugs resolved</span>
            }
          </span>
        </div>
      )}

      {/* ── Filter bar ─────────────────────────────────────────── */}
      {!isLoading && bugs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5" style={{ color: activeFilterCount > 0 ? "#7170ff" : "#62666d" }}>
            <Filter className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[12px]" style={{ fontWeight: 510, fontFeatureSettings: FF }}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </span>
          </div>

          {(["all", "open", "resolved"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="h-7 px-2.5 rounded-md text-[12px] capitalize"
              style={statusFilter === s
                ? { background: "rgba(113,112,255,0.12)", border: "1px solid rgba(113,112,255,0.25)", color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#8a8f98", fontFeatureSettings: FF }
              }
            >
              {s}
            </button>
          ))}

          <div className="h-4 w-px mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

          {orgOptions.length > 1 && (
            <DropdownSelect
              value={orgFilter}
              onChange={setOrgFilter}
              options={[
                { value: "", label: "All orgs" },
                ...orgOptions.map((o) => ({ value: o, label: o })),
              ]}
              size="sm"
            />
          )}

          {bugTypeOptions.length > 1 && (
            <DropdownSelect
              value={bugTypeFilter}
              onChange={setBugTypeFilter}
              options={[
                { value: "", label: "All bug types" },
                ...bugTypeOptions.map((t) => ({ value: t, label: t })),
              ]}
              size="sm"
            />
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={() => { setStatusFilter("all"); setOrgFilter(""); setBugTypeFilter(""); }}
              className="h-7 px-2 text-[12px] flex items-center gap-1 rounded-md"
              style={{ color: "#62666d", fontFeatureSettings: FF }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ff716c"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#62666d"; }}
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}

          <span className="ml-auto text-[12px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>
            {totalCount > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} of ${totalCount}` : "0 results"}
          </span>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div
          className="grid text-[11px] px-4 py-2.5"
          style={{
            gridTemplateColumns: "60px 1fr 1fr 160px 1fr 100px 120px",
            background: "#141516",
            color: "#62666d",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            fontWeight: 510,
            letterSpacing: "0.04em",
            fontFeatureSettings: FF,
            textTransform: "uppercase",
          }}
        >
          <span>ID</span>
          <span>Organization</span>
          <span>Rooftop</span>
          <span>Bug Types</span>
          <span>Reporter</span>
          <span>Status</span>
          <span>Time</span>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16" style={{ background: "#191a1b" }}>
            <div
              className="h-5 w-5 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(113,112,255,0.3)", borderTopColor: "#7170ff" }}
            />
          </div>
        )}

        {!isLoading && bugs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ background: "#191a1b" }}>
            <AlertTriangle className="h-8 w-8" style={{ color: "#34343a" }} />
            <p className="text-[13px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>
              No bugs assigned to you
            </p>
          </div>
        )}
        {!isLoading && bugs.map((bug, idx) => (
          <MyBugRow
            key={bug.id}
            bug={bug}
            even={idx % 2 === 0}
            active={selected?.id === bug.id}
            onClick={() => setSelected(bug)}
          />
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="px-4 py-3 flex items-center justify-between border-t"
            style={{ borderColor: "rgba(255,255,255,0.05)", background: "#141516" }}
          >
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="w-7 h-7 rounded-md flex items-center justify-center border disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)", color: "#8a8f98" }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[12px]" style={{ color: "#62666d", fontFeatureSettings: FF }}>
              Page {page + 1} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="w-7 h-7 rounded-md flex items-center justify-center border disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)", color: "#8a8f98" }}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── Detail drawer ──────────────────────────────────────── */}
      <BugDetailDrawer
        bug={selectedLive}
        canAssign={false}
        onClose={() => setSelected(null)}
        onResolve={(isResolved) => {
          if (!selectedLive) return;
          resolveBug.mutate({ bugId: selectedLive.id, isResolved });
        }}
        resolving={resolveBug.isPending}
      />
    </div>
  );
}

function MyBugRow({ bug, even, active, onClick }: {
  bug: BugReport; even: boolean; active: boolean; onClick: () => void;
}) {
  return (
    <div
      className="grid items-start px-4 py-3 text-[13px] cursor-pointer"
      style={{
        gridTemplateColumns: "60px 1fr 1fr 160px 1fr 100px 120px",
        background: active ? "rgba(113,112,255,0.07)" : even ? "#191a1b" : "rgba(255,255,255,0.01)",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        borderLeft: active ? "2px solid #7170ff" : "2px solid transparent",
        fontFeatureSettings: FF,
        opacity: bug.is_resolved ? 0.6 : 1,
      }}
      onClick={onClick}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLDivElement).style.background = even ? "#191a1b" : "rgba(255,255,255,0.01)"; }}
    >
      <span style={{ color: "#62666d", fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace", fontSize: "11px" }}>
        #{bug.external_id}
      </span>

      <div>
        <span style={{ color: "#d0d6e0", fontWeight: 400 }}>{bug.organization_name ?? "—"}</span>
        {bug.source_env && (
          <span
            className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#8a8f98" }}
          >
            {bug.source_env}
          </span>
        )}
      </div>

      <span style={{ color: "#8a8f98" }}>{bug.rooftop_name ?? "—"}</span>

      <div className="flex flex-wrap gap-1">
        {(bug.bug_types ?? []).length > 0
          ? bug.bug_types!.map((t) => <BugTypeChip key={t} label={t} />)
          : <span style={{ color: "#3e3e44" }}>—</span>
        }
      </div>

      <span style={{ color: "#8a8f98" }}>
        {bug.submitted_by_name ?? (bug.submitted_by ? `#${bug.submitted_by}` : "—")}
      </span>

      <span>
        {bug.is_resolved
          ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", fontWeight: 510 }}
            >
              ✓ Resolved
            </span>
          ) : (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px]"
              style={{ background: "rgba(113,112,255,0.08)", border: "1px solid rgba(113,112,255,0.15)", color: "#7170ff", fontWeight: 400 }}
            >
              Open
            </span>
          )
        }
      </span>

      <span style={{ color: "#62666d", fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace", fontSize: "11px" }}>
        {formatDate(bug.external_created_at)}
      </span>
    </div>
  );
}
