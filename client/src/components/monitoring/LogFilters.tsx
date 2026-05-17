import { X } from "lucide-react";

const FF = '"cv01", "ss03"' as const;
const MONO = "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace";

export const ALL_LEVELS = ["debug", "info", "warning", "error", "critical"] as const;

export const ALL_ENVS = [
  { id: "prod",       label: "prod",       color: "#ef4444" },
  { id: "arena",      label: "arena",      color: "#f59e0b" },
  { id: "playground", label: "playground", color: "#10b981" },
] as const;

export const TIME_RANGES = [
  { label: "15m",  hours: 0.25 },
  { label: "1h",   hours: 1    },
  { label: "6h",   hours: 6    },
  { label: "24h",  hours: 24   },
  { label: "7d",   hours: 168  },
] as const;

export interface Service { id: string; label: string }

export interface Filters {
  services: string[];
  levels: string[];
  envs: string[];
  hours: number;
  search: string;
  mode: "live" | "history";
}

interface Props {
  services: Service[];
  filters: Filters;
  onChange: (f: Filters) => void;
  tab?: "dashboard" | "logs";
}

const LEVEL_COLORS: Record<string, string> = {
  debug:    "#62666d",
  info:     "#7170ff",
  warning:  "#f59e0b",
  error:    "#ef4444",
  critical: "#ff4444",
};

function Chip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] px-2 py-0.5 rounded transition-all"
      style={{
        fontFamily: MONO,
        fontWeight: active ? 600 : 400,
        color: active ? (color ?? "#f7f8f8") : "#62666d",
        background: active ? (color ? `${color}22` : "rgba(255,255,255,0.08)") : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? (color ?? "rgba(255,255,255,0.2)") : "rgba(255,255,255,0.07)"}`,
      }}
    >
      {label}
    </button>
  );
}

const SEP = <div className="w-px h-4 shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />;

export function LogFilters({ services, filters, onChange, tab = "logs" }: Props) {
  function toggle<T extends string>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
  }

  const envSection = (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "#42464d", fontFamily: MONO }}>Env</span>
      {ALL_ENVS.map((e) => (
        <Chip key={e.id} label={e.label} active={filters.envs.includes(e.id)} color={e.color}
          onClick={() => onChange({ ...filters, envs: toggle(filters.envs, e.id) })} />
      ))}
    </div>
  );

  const timeSection = (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "#42464d", fontFamily: MONO }}>Range</span>
      {TIME_RANGES.map((r) => (
        <Chip key={r.label} label={r.label} active={filters.hours === r.hours}
          onClick={() => onChange({ ...filters, hours: r.hours })} />
      ))}
    </div>
  );

  // Dashboard: only Env + Time Range
  if (tab === "dashboard") {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {envSection}
        {SEP}
        {timeSection}
      </div>
    );
  }

  // Logs tab
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Mode */}
      <div className="flex items-center gap-1">
        {(["live", "history"] as const).map((m) => (
          <Chip key={m} label={m === "live" ? "● Live" : "History"} active={filters.mode === m}
            color={m === "live" ? "#10b981" : undefined}
            onClick={() => onChange({ ...filters, mode: m })} />
        ))}
      </div>

      {SEP}
      {envSection}
      {SEP}

      {/* Services */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: "#42464d", fontFamily: MONO }}>Service</span>
        {filters.services.length === 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: "#42464d", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", fontFamily: MONO }}>all</span>
        )}
        {services.map((s) => (
          <Chip key={s.id} label={s.id} active={filters.services.includes(s.id)}
            onClick={() => onChange({ ...filters, services: toggle(filters.services, s.id) })} />
        ))}
      </div>

      {SEP}

      {/* Levels */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: "#42464d", fontFamily: MONO }}>Level</span>
        {ALL_LEVELS.map((l) => (
          <Chip key={l} label={l.toUpperCase()} active={filters.levels.includes(l)} color={LEVEL_COLORS[l]}
            onClick={() => onChange({ ...filters, levels: toggle(filters.levels, l) })} />
        ))}
      </div>

      {/* Time range: history mode only */}
      {filters.mode === "history" && <>{SEP}{timeSection}</>}

      {/* Search */}
      <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
        <div className="flex items-center gap-1.5 flex-1 rounded px-2 py-0.5"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <input type="text" value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search logs…" className="flex-1 bg-transparent outline-none text-[12px]"
            style={{ color: "#d0d6e0", fontFamily: MONO, fontFeatureSettings: FF }} />
          {filters.search && (
            <button onClick={() => onChange({ ...filters, search: "" })}>
              <X className="h-3 w-3" style={{ color: "#62666d" }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
