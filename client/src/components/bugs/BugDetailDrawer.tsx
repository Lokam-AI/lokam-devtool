import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, UserCheck, UserX, CheckCircle2, RotateCcw, ExternalLink } from "lucide-react";
import type { BugReport, User } from "@/types";
import { BugTypeChip } from "@/pages/BugsPage";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { parseUtc } from "@/lib/utils";
import { CommentThread } from "@/components/CommentThread";

const FF = '"cv01", "ss03"' as const;

function buildLinearUrl(bug: BugReport): string {
  const title = `Bug #${bug.external_id}${bug.organization_name ? ` — ${bug.organization_name}` : ""}`;

  const lines: string[] = [
    "## Bug Report",
    "",
    `**ID:** #${bug.external_id}`,
    `**Organization:** ${bug.organization_name ?? "—"}`,
    `**Rooftop:** ${bug.rooftop_name ?? "—"}`,
    `**Environment:** ${bug.source_env ?? "—"}`,
    `**Bug Types:** ${(bug.bug_types ?? []).length > 0 ? bug.bug_types!.join(", ") : "—"}`,
    `**Reporter:** ${bug.submitted_by_name ?? (bug.submitted_by ? `#${bug.submitted_by}` : "—")}`,
    `**Reported At:** ${bug.external_created_at ? parseUtc(bug.external_created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}`,
    ...(bug.call_id ? [`**Call ID:** #${bug.call_id}`] : []),
    "",
    "## Description",
    "",
    bug.description ?? "_No description provided._",
  ];

  const params = new URLSearchParams({ title, description: lines.join("\n") });
  return `https://linear.app/lokam-v2/new?${params.toString()}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p
        className="text-[11px] uppercase tracking-widest"
        style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
      >
        {label}
      </p>
      <div className="text-[13px]" style={{ color: "#d0d6e0", fontFeatureSettings: FF }}>
        {children}
      </div>
    </div>
  );
}

interface Props {
  bug: BugReport | null;
  users?: User[];
  canAssign?: boolean;
  onClose: () => void;
  onAssign?: (userId: number | null) => void;
  onResolve: (isResolved: boolean) => void;
  assigning?: boolean;
  resolving: boolean;
}

export function BugDetailDrawer({
  bug,
  users = [],
  canAssign = false,
  onClose,
  onAssign,
  onResolve,
  assigning = false,
  resolving,
}: Props) {
  const navigate = useNavigate();
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  useEffect(() => {
    setSelectedUserId(bug?.assigned_to != null ? String(bug.assigned_to) : "");
  }, [bug?.id, bug?.assigned_to]);

  const assignedUser = users.find((u) => bug?.assigned_to != null && Number(u.id) === bug.assigned_to);
  const isDirty = selectedUserId !== (bug?.assigned_to != null ? String(bug.assigned_to) : "");

  if (!bug) return null;

  const resolved = bug.is_resolved;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden"
        style={{
          width: "420px",
          background: "#191a1b",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
          fontFamily: "Inter Variable, system-ui, sans-serif",
        }}
      >
        {/* ── Header ───────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2.5">
            <span
              style={{
                color: "#62666d",
                fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace",
                fontSize: "12px",
              }}
            >
              #{bug.external_id}
            </span>
            <span className="text-[15px]" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>
              Bug Report
            </span>
            {resolved && (
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
                style={{
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  color: "#10b981",
                  fontWeight: 510,
                }}
              >
                <CheckCircle2 className="h-3 w-3" />
                Resolved
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 transition-colors"
            style={{ color: "#62666d" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLButtonElement).style.color = "#d0d6e0";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "#62666d";
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* ── Resolve button ────────────────────────────── */}
          <button
            disabled={resolving}
            onClick={() => onResolve(!resolved)}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] transition-colors disabled:opacity-50"
            style={
              resolved
                ? {
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#8a8f98",
                    fontWeight: 510,
                    fontFeatureSettings: FF,
                  }
                : {
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    color: "#10b981",
                    fontWeight: 510,
                    fontFeatureSettings: FF,
                  }
            }
          >
            {resolved
              ? <><RotateCcw className="h-3.5 w-3.5" />Reopen Bug</>
              : <><CheckCircle2 className="h-3.5 w-3.5" />Mark as Resolved</>
            }
          </button>

          {/* ── Assignment (admin only) ───────────────────── */}
          {canAssign && (
            <div
              className="rounded-lg p-4 space-y-3"
              style={{ background: "#141516", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-[12px]" style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}>
                Assignee
              </p>

              {assignedUser && !isDirty && (
                <div
                  className="flex items-center gap-2 rounded-md px-3 py-2"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}
                >
                  <UserCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "#10b981" }} />
                  <span className="text-[13px]" style={{ color: "#10b981", fontFeatureSettings: FF }}>
                    {assignedUser.name}
                  </span>
                  <span className="text-[11px] ml-auto" style={{ color: "#62666d" }}>
                    {assignedUser.role}
                  </span>
                </div>
              )}

              <DropdownSelect
                value={selectedUserId}
                onChange={setSelectedUserId}
                options={[
                  { value: "", label: "Unassigned" },
                  ...users.filter((u) => u.is_active).map((u) => ({
                    value: String(u.id),
                    label: `${u.name} — ${u.role}`,
                  })),
                ]}
                fullWidth
              />

              <div className="flex gap-2">
                <button
                  disabled={!isDirty || assigning}
                  onClick={() => onAssign?.(selectedUserId ? Number(selectedUserId) : null)}
                  className="flex-1 rounded-md py-2 text-[13px] transition-colors disabled:opacity-40"
                  style={{
                    background: isDirty ? "rgba(94,106,210,0.9)" : "rgba(94,106,210,0.3)",
                    color: "#f7f8f8",
                    fontFeatureSettings: FF,
                    fontWeight: 510,
                    cursor: isDirty && !assigning ? "pointer" : "not-allowed",
                  }}
                >
                  {assigning ? "Assigning…" : selectedUserId ? "Assign" : "Unassign"}
                </button>

                {bug.assigned_to != null && (
                  <button
                    disabled={assigning}
                    onClick={() => { setSelectedUserId(""); onAssign?.(null); }}
                    className="rounded-md px-3 py-2 transition-colors"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#8a8f98",
                    }}
                  >
                    <UserX className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />

          {/* Details */}
          <div className="space-y-4">
            <Field label="Organization">
              <span>{bug.organization_name ?? "—"}</span>
              {bug.source_env && (
                <span
                  className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#8a8f98" }}
                >
                  {bug.source_env}
                </span>
              )}
            </Field>

            <Field label="Rooftop">
              {bug.rooftop_name ?? "—"}
            </Field>

            <Field label="Bug Types">
              {(bug.bug_types ?? []).length > 0
                ? <div className="flex flex-wrap gap-1">{bug.bug_types!.map((t) => <BugTypeChip key={t} label={t} />)}</div>
                : "—"
              }
            </Field>

            {bug.description && (
              <Field label="Description">
                <p
                  className="text-[13px] leading-relaxed rounded-md p-3"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    color: "#8a8f98",
                  }}
                >
                  {bug.description}
                </p>
              </Field>
            )}

            <Field label="Reporter">
              {bug.submitted_by_name ?? (bug.submitted_by ? `#${bug.submitted_by}` : "—")}
            </Field>

            {bug.call_id && (
              <Field label="Call ID">
                <button
                  onClick={() => navigate(`/call/${bug.call_id}`)}
                  className="flex items-center gap-1 transition-opacity hover:opacity-70"
                  style={{ fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace", fontSize: "12px", color: "#7170ff" }}
                >
                  #{bug.call_id}
                  <ExternalLink className="h-3 w-3" />
                </button>
              </Field>
            )}

            <Field label="Created">
              <span style={{ fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace", fontSize: "12px" }}>
                {bug.external_created_at
                  ? parseUtc(bug.external_created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                  : "—"}
              </span>
            </Field>

            <Field label="Bug Date">
              <span style={{ fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace", fontSize: "12px" }}>
                {bug.bug_date}
              </span>
            </Field>
          </div>

          {/* ── Discussion / Comments ─────────────────────── */}
          <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />
          <CommentThread entityType="bug_report" entityId={bug.id} />

          {/* ── Create Linear Story ───────────────────────── */}
          <a
            href={buildLinearUrl(bug)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] transition-colors"
            style={{
              background: "rgba(94,106,210,0.12)",
              border: "1px solid rgba(94,106,210,0.25)",
              color: "#7170ff",
              fontWeight: 510,
              fontFeatureSettings: FF,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(94,106,210,0.2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(94,106,210,0.12)";
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Create Linear Story
          </a>
        </div>
      </div>
    </>
  );
}
