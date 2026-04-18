import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-6 sm:gap-8",
        month: "space-y-3",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-normal",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "h-7 w-7 bg-transparent p-0 rounded-md flex items-center justify-center transition-colors",
          "text-[#62666d] hover:text-[#d0d6e0] hover:bg-white/5 border border-white/8"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell: "w-9 text-center text-[11px] font-normal text-[#62666d] pb-2",
        row: "flex w-full mt-1",
        cell: cn(
          "h-9 w-9 text-center text-sm p-0 relative",
          "[&:has([aria-selected].day-range-end)]:rounded-r-md",
          "[&:has([aria-selected].day-outside)]:bg-[#5e6ad2]/5",
          "[&:has([aria-selected])]:bg-[#5e6ad2]/10",
          "first:[&:has([aria-selected])]:rounded-l-md",
          "last:[&:has([aria-selected])]:rounded-r-md",
          "focus-within:relative focus-within:z-20"
        ),
        day: cn(
          "h-9 w-9 p-0 font-normal rounded-md text-[#8a8f98] text-sm transition-colors",
          "hover:bg-white/5 hover:text-[#d0d6e0]",
          "aria-selected:opacity-100 focus:outline-none focus:ring-1 focus:ring-[#5e6ad2]/40"
        ),
        day_range_end: "day-range-end",
        day_selected: cn(
          "!bg-[#5e6ad2] !text-[#f7f8f8]",
          "hover:!bg-[#828fff] focus:!bg-[#5e6ad2]"
        ),
        day_today: "!text-[#7170ff] ring-1 ring-[#7170ff]/30 rounded-md",
        day_outside: cn(
          "day-outside !text-[#62666d] opacity-40",
          "aria-selected:!bg-[#5e6ad2]/5 aria-selected:!text-[#62666d] aria-selected:opacity-30"
        ),
        day_disabled: "!text-[#62666d] opacity-30 cursor-not-allowed",
        day_range_middle: cn(
          "aria-selected:!bg-[#5e6ad2]/10 aria-selected:!text-[#d0d6e0]",
          "aria-selected:rounded-none"
        ),
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-3.5 w-3.5" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-3.5 w-3.5" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
