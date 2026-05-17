import { useState } from "react";
import { ChevronRight } from "lucide-react";

export interface LogEntryData {
  timestamp: number;
  level: string;
  service: string;
  message: string;
  raw: Record<string, unknown>;
}

const LEVEL_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  debug:    { color: "#62666d", bg: "rgba(98,102,109,0.12)",   label: "DEBUG"    },
  info:     { color: "#7170ff", bg: "rgba(113,112,255,0.12)",  label: "INFO"     },
  warning:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",   label: "WARN"     },
  warn:     { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",   label: "WARN"     },
  error:    { color: "#ef4444", bg: "rgba(239,68,68,0.12)",    label: "ERROR"    },
  critical: { color: "#ff4444", bg: "rgba(255,68,68,0.15)",    label: "CRITICAL" },
};

const FF = '"cv01", "ss03"' as const;
const MONO = "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace";

function formatTs(ms: number): string {
  const d = new Date(ms);
  return d.toISOString().replace("T", " ").slice(0, 23);
}

export function LogEntry({ entry }: { entry: LogEntryData }) {
  const [expanded, setExpanded] = useState(false);
  const style = LEVEL_STYLES[entry.level] ?? LEVEL_STYLES.info;

  return (
    <div
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer",
      }}
      onClick={() => setExpanded((v) => !v)}
    >
      <div
        className="flex items-start gap-2 px-3 py-1.5 transition-colors"
        style={{ fontFamily: MONO }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
      >
        <ChevronRight
          className="h-3 w-3 shrink-0 mt-0.5 transition-transform"
          style={{
            color: "#3e3e44",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />

        {/* Timestamp */}
        <span
          className="text-[11px] shrink-0 tabular-nums"
          style={{ color: "#42464d", minWidth: 152 }}
        >
          {formatTs(entry.timestamp)}
        </span>

        {/* Level badge */}
        <span
          className="text-[10px] shrink-0 px-1.5 rounded font-semibold tabular-nums"
          style={{
            color: style.color,
            background: style.bg,
            minWidth: 52,
            textAlign: "center",
            lineHeight: "18px",
          }}
        >
          {style.label}
        </span>

        {/* Service chip */}
        <span
          className="text-[10px] shrink-0 px-1.5 rounded tabular-nums"
          style={{
            color: "#8a8f98",
            background: "rgba(255,255,255,0.05)",
            lineHeight: "18px",
            maxWidth: 140,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.service}
        </span>

        {/* Message */}
        <span
          className="text-[12px] flex-1 min-w-0"
          style={{
            color: "#d0d6e0",
            fontFeatureSettings: FF,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: expanded ? "pre-wrap" : "nowrap",
            wordBreak: "break-all",
          }}
        >
          {entry.message}
        </span>
      </div>

      {expanded && (
        <pre
          className="px-12 pb-2 text-[11px] overflow-x-auto"
          style={{
            color: "#8a8f98",
            fontFamily: MONO,
            background: "rgba(255,255,255,0.015)",
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {JSON.stringify(entry.raw, null, 2)}
        </pre>
      )}
    </div>
  );
}
