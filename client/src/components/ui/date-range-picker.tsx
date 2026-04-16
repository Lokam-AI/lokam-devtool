import * as React from "react";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function buildPresets() {
  const today = new Date();
  const d = (offset: number) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return [
    { label: "Today",         range: { from: d(0),  to: d(0)  } },
    { label: "Yesterday",     range: { from: d(-1), to: d(-1) } },
    { label: "Last 7 days",   range: { from: d(-6), to: d(0)  } },
    { label: "Last 30 days",  range: { from: d(-29), to: d(0) } },
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

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [presets, setPresets] = React.useState(buildPresets);

  React.useEffect(() => {
    if (open) setPresets(buildPresets());
  }, [open]);

  const label = React.useMemo(() => {
    if (!value?.from) return "Pick a date range";
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
            "px-4 py-2 rounded-xl flex items-center gap-2 text-sm transition-all border",
            className
          )}
          style={{
            background: open ? "rgba(79,245,223,0.08)" : "#1a1919",
            color: value?.from ? "#ffffff" : "#adaaaa",
            borderColor: open ? "rgba(79,245,223,0.3)" : "rgba(73,72,71,0.2)",
          }}
        >
          <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "#4ff5df" }} />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto p-0 border"
        style={{ background: "#1a1919", borderColor: "rgba(73,72,71,0.3)" }}
      >
        <div className="flex">
          {/* Presets */}
          <div className="flex flex-col gap-0.5 p-3 border-r" style={{ borderColor: "rgba(73,72,71,0.3)" }}>
            {presets.map((p) => {
              const active =
                value?.from?.toDateString() === p.range.from.toDateString() &&
                (value?.to ?? value?.from)?.toDateString() === p.range.to.toDateString();
              return (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p.range)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-all whitespace-nowrap"
                  style={
                    active
                      ? { background: "rgba(79,245,223,0.12)", color: "#4ff5df" }
                      : { color: "#adaaaa" }
                  }
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  {p.label}
                </button>
              );
            })}
            {value && (
              <button
                onClick={() => { onChange(undefined); setOpen(false); }}
                className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-all"
                style={{ color: "rgba(255,113,108,0.8)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ff716c"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,113,108,0.8)"; }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={value}
              onSelect={handleSelect}
              defaultMonth={value?.from}
              numberOfMonths={2}
              className="rounded-lg"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
