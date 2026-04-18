import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

const FF = '"cv01", "ss03"' as const;

export interface SelectOption {
  value: string;
  label: string;
}

interface DropdownSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
}

export function DropdownSelect({
  value,
  onChange,
  options,
  size = "md",
  fullWidth = false,
  className = "",
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const isActive = !!value;
  const h = size === "sm" ? "h-7" : "h-9";
  const text = size === "sm" ? "text-[12px]" : "text-[13px]";

  return (
    <div className={`relative ${fullWidth ? "w-full" : "inline-block"} ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 ${h} px-2.5 rounded-md border ${text} transition-all ${fullWidth ? "w-full" : ""}`}
        style={{
          background: open || isActive ? "rgba(113,112,255,0.06)" : "rgba(255,255,255,0.02)",
          borderColor: open || isActive ? "rgba(113,112,255,0.2)" : "rgba(255,255,255,0.08)",
          color: open || isActive ? "#d0d6e0" : "#8a8f98",
          fontFeatureSettings: FF,
        }}
      >
        <span className="flex-1 text-left truncate">{selected?.label ?? options[0]?.label}</span>
        <ChevronDown
          className="h-3 w-3 shrink-0 transition-transform duration-150"
          style={{ color: "#62666d", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full mt-1.5 left-0 z-50 rounded-lg overflow-hidden py-1"
          style={{
            background: "#191a1b",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.2)",
            minWidth: "160px",
            width: fullWidth ? "100%" : undefined,
          }}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 ${text} text-left transition-colors`}
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
                <span className="flex-1">{opt.label}</span>
                {active && <Check className="h-3 w-3 shrink-0" style={{ color: "#7170ff" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
