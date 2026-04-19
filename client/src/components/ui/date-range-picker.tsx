import * as React from "react";
import { format } from "date-fns";
import { CalendarDays, X } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const FF = '"cv01", "ss03"' as const;

function buildPresets() {
  const today = new Date();
  const d = (offset: number) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return [
    { label: "Today",        range: { from: d(0),   to: d(0)   } },
    { label: "Yesterday",    range: { from: d(-1),  to: d(-1)  } },
    { label: "Last 7 days",  range: { from: d(-6),  to: d(0)   } },
    { label: "Last 30 days", range: { from: d(-29), to: d(0)   } },
    {
      label: "This month",
      range: {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: today,
      },
    },
    {
      label: "Last month",
      range: {
        from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        to: new Date(today.getFullYear(), today.getMonth(), 0),
      },
    },
  ];
}

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

function toDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? undefined : d;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [presets, setPresets] = React.useState(buildPresets);

  // Normalize: sessionStorage rehydration converts Date → ISO string
  const normalized = React.useMemo<DateRange | undefined>(() => {
    const from = toDate(value?.from);
    const to   = toDate(value?.to);
    return from ? { from, to } : undefined;
  }, [value?.from, value?.to]);

  React.useEffect(() => {
    if (open) setPresets(buildPresets());
  }, [open]);

  const label = React.useMemo(() => {
    if (!normalized?.from) return "Pick a date range";
    const value = normalized;
    const matched = presets.find(
      (p) =>
        p.range.from.toDateString() === value.from!.toDateString() &&
        p.range.to.toDateString() === (value.to ?? value.from)!.toDateString()
    );
    if (matched) return matched.label;
    if (value.to) return `${format(value.from, "MMM d")} – ${format(value.to, "MMM d, yyyy")}`;
    return format(value.from, "MMM d, yyyy");
  }, [value, presets]);

  const handlePreset = (range: DateRange) => {
    onChange(range);
    setOpen(false);
  };

  const handleSelect = (range: DateRange | undefined) => {
    onChange(range);
    if (range?.from && range?.to) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-9 px-3 rounded-md flex items-center gap-2 text-[13px] transition-all border",
            className
          )}
          style={{
            background: open ? "rgba(113,112,255,0.06)" : "rgba(255,255,255,0.02)",
            color: normalized?.from ? "#d0d6e0" : "#8a8f98",
            borderColor: open ? "rgba(113,112,255,0.25)" : "rgba(255,255,255,0.08)",
            fontWeight: 400,
            fontFeatureSettings: FF,
          }}
          onMouseEnter={(e) => {
            if (!open) {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLButtonElement).style.color = "#d0d6e0";
            }
          }}
          onMouseLeave={(e) => {
            if (!open) {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.02)";
              (e.currentTarget as HTMLButtonElement).style.color = normalized?.from ? "#d0d6e0" : "#8a8f98";
            }
          }}
        >
          <CalendarDays
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: open ? "#7170ff" : "#62666d" }}
          />
          <span>{label}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-auto p-0 overflow-hidden rounded-xl"
        style={{
          background: "#191a1b",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.2)",
        }}
      >
        <div className="flex">

          {/* ── Presets ──────────────────────────────────────────── */}
          <div
            className="flex flex-col p-1.5 border-r"
            style={{ borderColor: "rgba(255,255,255,0.06)", minWidth: "100px" }}
          >
            <p
              className="px-2 pb-1.5 pt-0.5 text-[9px] uppercase tracking-widest"
              style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
            >
              Quick select
            </p>
            <div className="flex flex-col gap-px">
              {presets.map((p) => {
                const active =
                  normalized?.from?.toDateString() === p.range.from.toDateString() &&
                  (normalized?.to ?? normalized?.from)?.toDateString() === p.range.to.toDateString();
                return (
                  <button
                    key={p.label}
                    onClick={() => handlePreset(p.range)}
                    className="px-2 py-1 rounded-md text-[12px] text-left transition-all whitespace-nowrap"
                    style={
                      active
                        ? {
                            background: "rgba(113,112,255,0.1)",
                            color: "#7170ff",
                            fontWeight: 510,
                            fontFeatureSettings: FF,
                          }
                        : {
                            color: "#8a8f98",
                            fontWeight: 400,
                            fontFeatureSettings: FF,
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
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
                    {p.label}
                  </button>
                );
              })}
            </div>

            {normalized && (
              <>
                <div
                  className="my-1.5 h-px"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                />
                <button
                  onClick={() => { onChange(undefined); setOpen(false); }}
                  className="px-2 py-1 rounded-md text-[12px] text-left transition-all flex items-center gap-1.5"
                  style={{ color: "#62666d", fontWeight: 400, fontFeatureSettings: FF }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,113,108,0.8)";
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,113,108,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = "#62666d";
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <X className="h-2.5 w-2.5" />
                  Clear
                </button>
              </>
            )}
          </div>

          {/* ── Calendar ─────────────────────────────────────────── */}
          <div
            className="p-2"
            style={{ "--rdp-cell-size": "27px" } as React.CSSProperties}
          >
            <Calendar
              mode="range"
              selected={normalized}
              onSelect={handleSelect}
              defaultMonth={normalized?.from}
              numberOfMonths={2}
              classNames={{
                head_cell: "w-7 text-center text-[10px] font-normal text-[#62666d] pb-1.5",
                cell: "h-7 w-7 text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-[#5e6ad2]/5 [&:has([aria-selected])]:bg-[#5e6ad2]/10 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: "h-7 w-7 p-0 font-normal rounded-md text-[#8a8f98] text-xs transition-colors hover:bg-white/5 hover:text-[#d0d6e0] aria-selected:opacity-100 focus:outline-none focus:ring-1 focus:ring-[#5e6ad2]/40",
                row: "flex w-full mt-0.5",
                caption: "flex justify-center pt-0.5 relative items-center",
              }}
            />
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────── */}
        {normalized?.from && (
          <div
            className="px-3 py-2 border-t"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}
          >
            <span
              className="text-[11px]"
              style={{ color: "#62666d", fontFeatureSettings: FF }}
            >
              {normalized.to
                ? `${format(normalized.from, "MMM d, yyyy")} → ${format(normalized.to, "MMM d, yyyy")}`
                : `${format(normalized.from, "MMM d, yyyy")} → select end`}
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
