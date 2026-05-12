import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

const FF = '"cv01", "ss03"' as const;
const MENU_MARGIN = 6;
const MENU_VIEWPORT_PAD = 8;

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

interface MenuRect {
  top: number;
  left: number;
  width: number;
  placement: "below" | "above";
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
  const [rect, setRect] = useState<MenuRect | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const computeRect = useCallback((): MenuRect | null => {
    const btn = wrapRef.current?.querySelector("button");
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight ?? 0;
    const spaceBelow = window.innerHeight - r.bottom - MENU_VIEWPORT_PAD;
    const placement: "below" | "above" =
      menuH > 0 && spaceBelow < menuH && r.top > spaceBelow ? "above" : "below";
    const top = placement === "below" ? r.bottom + MENU_MARGIN : r.top - MENU_MARGIN - menuH;
    return { top, left: r.left, width: r.width, placement };
  }, []);

  // Two-pass measurement: first pass renders the menu (rect=null → invisible),
  // second pass runs after the menu mounts so menuRef.current.offsetHeight is real,
  // letting us pick the correct above/below placement before paint.
  useLayoutEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    const next = computeRect();
    setRect((prev) => {
      if (!prev) return next;
      if (!next) return prev;
      if (
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.placement === next.placement
      ) return prev;
      return next;
    });
  });

  useEffect(() => {
    if (!open) return;
    const reposition = () => setRect(computeRect());
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", handler);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, computeRect]);

  const selected = options.find((o) => o.value === value);
  const isActive = !!value;
  const h = size === "sm" ? "h-7" : "h-9";
  const text = size === "sm" ? "text-[12px]" : "text-[13px]";

  return (
    <div className={`relative ${fullWidth ? "w-full" : "inline-block"} ${className}`} ref={wrapRef}>
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

      {open && createPortal(
        <div
          ref={menuRef}
          className="rounded-lg overflow-hidden py-1"
          style={{
            position: "fixed",
            top: rect?.top ?? 0,
            left: rect?.left ?? 0,
            minWidth: rect ? Math.max(rect.width, 160) : 160,
            width: fullWidth && rect ? rect.width : undefined,
            zIndex: 9999,
            visibility: rect ? "visible" : "hidden",
            pointerEvents: rect ? "auto" : "none",
            background: "#191a1b",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.2)",
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
        </div>,
        document.body
      )}
    </div>
  );
}
