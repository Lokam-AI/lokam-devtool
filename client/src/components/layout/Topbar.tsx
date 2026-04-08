import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuthStore } from "@/store/auth-store";

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  superadmin: { bg: "rgba(234,179,8,0.12)",  color: "#eab308" },
  admin:      { bg: "rgba(79,245,223,0.12)", color: "#4ff5df" },
  reviewer:   { bg: "rgba(56,189,248,0.12)", color: "#38bdf8" },
};

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const roleStyle = ROLE_COLORS[user?.role ?? "reviewer"] ?? ROLE_COLORS.reviewer;

  return (
    <header
      className="h-14 flex items-center justify-between px-6 sticky top-0 z-30"
      style={{
        background: "rgba(5,5,5,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(73,72,71,0.15)",
        boxShadow: "0 1px 0 rgba(79,245,223,0.03)",
      }}
    >
      {/* Left — trigger + title */}
      <div className="flex items-center gap-3">
        <SidebarTrigger
          className="transition-colors"
          style={{ color: "rgba(255,255,255,0.3)" }}
        />
        <span
          className="text-sm font-bold tracking-[0.08em] uppercase"
          style={{ color: "#4ff5df" }}
        >
          Lokam Dev Tool
        </span>
      </div>

      {/* Right — role badge + name */}
      {user && (
        <div className="flex items-center gap-4">
          {/* Role chip */}
          <span
            className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
            style={{ background: roleStyle.bg, color: roleStyle.color }}
          >
            {user.role}
          </span>

          {/* Divider */}
          <div className="h-4 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />

          {/* Name */}
          <span
            className="text-sm font-medium"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            {user.name}
          </span>
        </div>
      )}
    </header>
  );
}
