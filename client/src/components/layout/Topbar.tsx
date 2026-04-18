import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuthStore } from "@/store/auth-store";

const FF = '"cv01", "ss03"' as const;

const ROLE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  superadmin: { bg: "rgba(234,179,8,0.1)",   color: "#eab308", border: "rgba(234,179,8,0.2)"   },
  admin:      { bg: "rgba(113,112,255,0.1)", color: "#7170ff", border: "rgba(113,112,255,0.2)" },
  reviewer:   { bg: "rgba(56,189,248,0.1)",  color: "#38bdf8", border: "rgba(56,189,248,0.2)"  },
};

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const roleStyle = ROLE_COLORS[user?.role ?? "reviewer"] ?? ROLE_COLORS.reviewer;

  return (
    <header
      className="h-14 flex items-center justify-between px-6 sticky top-0 z-30"
      style={{
        background: "rgba(15,16,17,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <SidebarTrigger
          className="transition-colors"
          style={{ color: "#62666d" }}
        />
        <span
          className="text-xs uppercase tracking-[0.1em]"
          style={{
            color: "#7170ff",
            fontWeight: 510,
            fontFeatureSettings: FF,
          }}
        >
          Lokam DevTool
        </span>
      </div>

      {/* Right */}
      {user && (
        <div className="flex items-center gap-4">
          <span
            className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest border"
            style={{
              background: roleStyle.bg,
              color: roleStyle.color,
              borderColor: roleStyle.border,
              fontWeight: 510,
              fontFeatureSettings: FF,
            }}
          >
            {user.role}
          </span>

          <div className="h-4 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />

          <span
            className="text-sm"
            style={{ color: "#8a8f98", fontWeight: 400, fontFeatureSettings: FF }}
          >
            {user.name}
          </span>
        </div>
      )}
    </header>
  );
}
