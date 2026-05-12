import type { CallType } from "@/types";

const FF = '"cv01", "ss03"' as const;

const STYLES: Record<CallType, { bg: string; color: string; border: string; label: string }> = {
  service: {
    bg: "rgba(94,106,210,0.1)",
    color: "#7170ff",
    border: "rgba(113,112,255,0.2)",
    label: "Service",
  },
  sales: {
    bg: "rgba(168,85,247,0.1)",
    color: "#c084fc",
    border: "rgba(168,85,247,0.25)",
    label: "Sales",
  },
};

export function CallTypePill({ callType, size = "md" }: { callType: CallType; size?: "sm" | "md" }) {
  const s = STYLES[callType] ?? STYLES.service;
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";
  const text = size === "sm" ? "text-[10px]" : "text-[10px]";
  return (
    <span
      className={`${padding} ${text} rounded-full uppercase tracking-widest border inline-flex items-center gap-1`}
      style={{
        background: s.bg,
        color: s.color,
        borderColor: s.border,
        fontWeight: 510,
        fontFeatureSettings: FF,
      }}
    >
      <span className="w-1 h-1 rounded-full bg-current" />
      {s.label}
    </span>
  );
}
