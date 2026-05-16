import { useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Bug, Plus, Check, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useSuperConfigs, useCreateSuperConfig, useUpdateSuperConfig } from "@/hooks/use-super-configs";
import { Skeleton } from "@/components/ui/skeleton";
import type { SuperConfig } from "@/types";

const FF = '"cv01", "ss03"' as const;
const CATEGORY = "voice_bug_type";

const SEVERITY_OPTIONS = [
  { value: "low",    label: "Low",    color: "#10b981" },
  { value: "medium", label: "Medium", color: "#f59e0b" },
  { value: "high",   label: "High",   color: "#f87171" },
];

function getSeverityColor(severity?: string | null): string {
  return SEVERITY_OPTIONS.find((s) => s.value === severity)?.color ?? "#62666d";
}

export default function BugTypeConfigPage() {
  const isSuperadmin = useAuthStore((s) => s.isAtLeast)("superadmin");
  if (!isSuperadmin) return <Navigate to="/dashboard" replace />;
  return <BugTypeConfigInner />;
}

function BugTypeConfigInner() {
  const { data: configs = [], isLoading } = useSuperConfigs(CATEGORY);
  const createConfig = useCreateSuperConfig();
  const updateConfig = useUpdateSuperConfig(CATEGORY);

  const [showInactive, setShowInactive] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSeverity, setNewSeverity] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSeverity, setEditSeverity] = useState("");

  const activeConfigs   = configs.filter((c) => c.is_active);
  const inactiveConfigs = configs.filter((c) => !c.is_active);

  const startEdit = (cfg: SuperConfig) => {
    setEditingId(cfg.id);
    setEditName(cfg.name);
    setEditDesc(cfg.description ?? "");
    setEditSeverity((cfg.options as Record<string, string> | null)?.severity ?? "");
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: number) => {
    try {
      await updateConfig.mutateAsync({
        id,
        patch: {
          name: editName.trim(),
          description: editDesc.trim() || null,
          options: editSeverity ? { severity: editSeverity } : null,
        },
      });
      toast.success("Bug type updated");
      setEditingId(null);
    } catch {
      toast.error("Failed to update bug type");
    }
  };

  const toggleActive = async (cfg: SuperConfig) => {
    try {
      await updateConfig.mutateAsync({ id: cfg.id, patch: { is_active: !cfg.is_active } });
      toast.success(cfg.is_active ? "Bug type deactivated" : "Bug type reactivated");
    } catch {
      toast.error("Failed to update bug type");
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error("Name is required"); return; }
    try {
      await createConfig.mutateAsync({
        category: CATEGORY,
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        options: newSeverity ? { severity: newSeverity } : undefined,
      });
      toast.success("Bug type created");
      setAddingNew(false);
      setNewName(""); setNewDesc(""); setNewSeverity("");
    } catch {
      toast.error("Failed to create bug type — name may already exist");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8 animate-in fade-in duration-500">
        <PageHeader />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500 max-w-2xl">
      <PageHeader />

      {/* Active bug types */}
      <div className="flex flex-col gap-3">
        <SectionLabel label="Active Bug Types" count={activeConfigs.length} />

        {activeConfigs.map((cfg) =>
          editingId === cfg.id ? (
            <EditRow
              key={cfg.id}
              name={editName} onName={setEditName}
              desc={editDesc} onDesc={setEditDesc}
              severity={editSeverity} onSeverity={setEditSeverity}
              onSave={() => saveEdit(cfg.id)}
              onCancel={cancelEdit}
              saving={updateConfig.isPending}
            />
          ) : (
            <BugTypeRow
              key={cfg.id}
              cfg={cfg}
              onEdit={() => startEdit(cfg)}
              onToggle={() => toggleActive(cfg)}
              toggling={updateConfig.isPending}
            />
          )
        )}

        {activeConfigs.length === 0 && (
          <p className="text-xs py-4 text-center" style={{ color: "#62666d", fontFeatureSettings: FF }}>
            No active bug types. Add one below.
          </p>
        )}
      </div>

      {/* Add new */}
      {addingNew ? (
        <EditRow
          name={newName} onName={setNewName}
          desc={newDesc} onDesc={setNewDesc}
          severity={newSeverity} onSeverity={setNewSeverity}
          onSave={handleCreate}
          onCancel={() => { setAddingNew(false); setNewName(""); setNewDesc(""); setNewSeverity(""); }}
          saving={createConfig.isPending}
          isNew
        />
      ) : (
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs transition-all self-start"
          style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)", color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(113,112,255,0.3)"; (e.currentTarget as HTMLButtonElement).style.color = "#7170ff"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98"; }}
        >
          <Plus className="h-3.5 w-3.5" /> Add Bug Type
        </button>
      )}

      {/* Deactivated */}
      {inactiveConfigs.length > 0 && (
        <div className="flex flex-col gap-3">
          <button
            className="flex items-center gap-2 text-[10px] uppercase tracking-widest self-start transition-colors"
            style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
            onClick={() => setShowInactive((v) => !v)}
          >
            {showInactive ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Deactivated ({inactiveConfigs.length})
          </button>
          {showInactive && inactiveConfigs.map((cfg) => (
            <BugTypeRow
              key={cfg.id}
              cfg={cfg}
              onEdit={() => startEdit(cfg)}
              onToggle={() => toggleActive(cfg)}
              toggling={updateConfig.isPending}
              inactive
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1">
        <Bug className="h-5 w-5" style={{ color: "#f87171" }} />
        <h1
          className="text-3xl"
          style={{ color: "#f7f8f8", fontWeight: 510, letterSpacing: "-0.704px", fontFeatureSettings: FF }}
        >
          Bug Type Config
        </h1>
      </div>
      <p className="mt-1.5 text-sm" style={{ color: "#8a8f98", fontWeight: 400, fontFeatureSettings: FF }}>
        Manage the voice agent bug type options shown in the bug report modal.
      </p>
    </div>
  );
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-[10px] uppercase tracking-widest" style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}>
        {label}
      </p>
      <span
        className="text-[9px] px-1.5 py-0.5 rounded-full border"
        style={{ color: "#62666d", borderColor: "rgba(255,255,255,0.08)", fontFeatureSettings: FF }}
      >
        {count}
      </span>
    </div>
  );
}

function BugTypeRow({
  cfg, onEdit, onToggle, toggling, inactive = false,
}: {
  cfg: SuperConfig;
  onEdit: () => void;
  onToggle: () => void;
  toggling: boolean;
  inactive?: boolean;
}) {
  const severity = (cfg.options as Record<string, string> | null)?.severity;
  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-xl border"
      style={{
        background: inactive ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.02)",
        borderColor: inactive ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.08)",
        opacity: inactive ? 0.6 : 1,
      }}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: inactive ? "#62666d" : "#d0d6e0", fontWeight: 510, fontFeatureSettings: FF }}>
            {cfg.name}
          </span>
          {severity && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full border uppercase tracking-widest"
              style={{
                color: getSeverityColor(severity),
                borderColor: `${getSeverityColor(severity)}40`,
                background: `${getSeverityColor(severity)}12`,
                fontFeatureSettings: FF,
              }}
            >
              {severity}
            </span>
          )}
        </div>
        {cfg.description && (
          <p className="text-[10px] truncate max-w-xs" style={{ color: "#62666d", fontFeatureSettings: FF }}>
            {cfg.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        <button
          onClick={onEdit}
          className="text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-md border transition-all"
          style={{ color: "#8a8f98", borderColor: "rgba(255,255,255,0.08)", fontWeight: 510, fontFeatureSettings: FF }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f7f8f8"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98"; }}
        >
          Edit
        </button>
        <button
          onClick={onToggle}
          disabled={toggling}
          className="text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-md border transition-all disabled:opacity-40"
          style={{
            color: inactive ? "#10b981" : "#f87171",
            borderColor: inactive ? "rgba(16,185,129,0.2)" : "rgba(248,113,113,0.2)",
            fontWeight: 510, fontFeatureSettings: FF,
          }}
        >
          {inactive ? "Reactivate" : "Deactivate"}
        </button>
      </div>
    </div>
  );
}

function EditRow({
  name, onName, desc, onDesc, severity, onSeverity, onSave, onCancel, saving, isNew = false,
}: {
  name: string; onName: (v: string) => void;
  desc: string; onDesc: (v: string) => void;
  severity: string; onSeverity: (v: string) => void;
  onSave: () => void; onCancel: () => void;
  saving: boolean; isNew?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-3 px-4 py-4 rounded-xl border"
      style={{ background: "rgba(113,112,255,0.04)", borderColor: "rgba(113,112,255,0.2)" }}
    >
      <input
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder="Bug type name…"
        className="w-full rounded-lg px-3 py-2 text-sm border focus:outline-none placeholder:text-[#3e3e44]"
        style={{ background: "rgba(255,255,255,0.03)", color: "#f7f8f8", borderColor: "rgba(255,255,255,0.1)", fontFeatureSettings: FF }}
        onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(113,112,255,0.4)"; }}
        onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
      />
      <input
        value={desc}
        onChange={(e) => onDesc(e.target.value)}
        placeholder="Description (optional)…"
        className="w-full rounded-lg px-3 py-2 text-xs border focus:outline-none placeholder:text-[#3e3e44]"
        style={{ background: "rgba(255,255,255,0.03)", color: "#d0d6e0", borderColor: "rgba(255,255,255,0.1)", fontFeatureSettings: FF }}
        onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(113,112,255,0.4)"; }}
        onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
      />
      <div className="flex items-center gap-2">
        <p className="text-[9px] uppercase tracking-widest shrink-0" style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}>
          Severity
        </p>
        {SEVERITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSeverity(severity === opt.value ? "" : opt.value)}
            className="px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest border transition-all"
            style={severity === opt.value
              ? { color: opt.color, background: `${opt.color}18`, borderColor: `${opt.color}40`, fontWeight: 510, fontFeatureSettings: FF }
              : { color: "#62666d", background: "transparent", borderColor: "rgba(255,255,255,0.08)", fontFeatureSettings: FF }
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs border transition-all"
          style={{ color: "#62666d", borderColor: "rgba(255,255,255,0.08)", fontFeatureSettings: FF }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving || !name.trim()}
          className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all disabled:opacity-40"
          style={{ background: "#5e6ad2", color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {isNew ? "Add" : "Save"}
        </button>
      </div>
    </div>
  );
}

