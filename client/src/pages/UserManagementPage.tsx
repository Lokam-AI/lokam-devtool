import { useState, useMemo } from "react";
import { useUsers, useCreateUser } from "@/hooks/use-calls";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { UserPlus, Users, ShieldCheck, Star } from "lucide-react";
import type { UserRole } from "@/types";

const ROLE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  superadmin: { label: "Superadmin", bg: "rgba(234,179,8,0.15)",   color: "#eab308" },
  admin:      { label: "Admin",      bg: "rgba(79,245,223,0.15)",  color: "#4ff5df" },
  reviewer:   { label: "Reviewer",   bg: "rgba(56,189,248,0.15)",  color: "#38bdf8" },
};

export default function UserManagementPage() {
  const { data, isLoading } = useUsers();
  const createUser = useCreateUser();
  const isSuperadmin = useAuthStore((s) => s.hasRole)("superadmin");
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail]         = useState("");
  const [newName, setNewName]           = useState("");
  const [newPassword, setNewPassword]   = useState("");
  const [newRole, setNewRole]           = useState<UserRole>("reviewer");

  const stats = useMemo(() => ({
    total:     data?.length ?? 0,
    active:    data?.filter((u) => u.is_active).length ?? 0,
    admins:    data?.filter((u) => u.role === "admin" || u.role === "superadmin").length ?? 0,
    reviewers: data?.filter((u) => u.role === "reviewer").length ?? 0,
  }), [data]);

  const handleCreate = async () => {
    if (!newEmail || !newName || !newPassword) return;
    try {
      await createUser.mutateAsync({ email: newEmail, name: newName, password: newPassword, role: newRole });
      toast.success(`User ${newName} created as ${newRole}`);
      setShowCreate(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("reviewer");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? "Failed to create user");
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-[0.02em]" style={{ color: "#ffffff" }}>
            User Registry
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#adaaaa" }}>
            Manage system accounts, roles, and access permissions.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
          style={
            showCreate
              ? { background: "rgba(255,255,255,0.07)", color: "#adaaaa" }
              : { background: "linear-gradient(135deg,#4ff5df,#22dbc6)", color: "#00594f", boxShadow: "0 8px 24px rgba(79,245,223,0.2)" }
          }
        >
          <UserPlus className="h-4 w-4" />
          {showCreate ? "Cancel" : "Add User"}
        </button>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: "Total Users",  value: stats.total,     icon: <Users className="h-[18px] w-[18px]" style={{ color: "#4ff5df" }} />,     aurora: true  },
          { label: "Active",       value: stats.active,    icon: <span className="material-symbols-outlined text-lg" style={{ color: "#4ff5df", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span>, aurora: false },
          { label: "Admins",       value: stats.admins,    icon: <ShieldCheck className="h-[18px] w-[18px]" style={{ color: "#eab308" }} />, aurora: false },
          { label: "Reviewers",    value: stats.reviewers, icon: <Star className="h-[18px] w-[18px]" style={{ color: "#38bdf8" }} />,        aurora: false },
        ].map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-xl p-5 border"
            style={{ background: "#1a1919", borderColor: "rgba(73,72,71,0.05)", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}
          >
            {s.aurora && (
              <div
                className="absolute pointer-events-none"
                style={{
                  top: "-20px", left: "-20px", right: "-20px", bottom: "-20px",
                  background: "radial-gradient(circle at center, rgba(79,245,223,0.08) 0%, transparent 70%)",
                  filter: "blur(40px)",
                }}
              />
            )}
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: "#adaaaa" }}>
                  {s.label}
                </span>
                {s.icon}
              </div>
              {isLoading ? (
                <Skeleton className="h-9 w-16 mt-1" style={{ background: "rgba(255,255,255,0.05)" }} />
              ) : (
                <span className="text-3xl font-black tracking-tight" style={{ color: "#ffffff" }}>{s.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Create user form ─────────────────────────────────────────── */}
      {showCreate && (
        <div
          className="rounded-2xl p-8 animate-in slide-in-from-top-2 duration-200 border-l-4"
          style={{ background: "#1a1919", borderLeftColor: "#4ff5df" }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(79,245,223,0.1)" }}
            >
              <UserPlus className="h-4 w-4" style={{ color: "#4ff5df" }} />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#ffffff" }}>
              New User
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
            {/* Full Name */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest pl-1" style={{ color: "#adaaaa" }}>
                Full Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Jane Smith"
                className="rounded-xl px-5 py-3 text-sm border transition-all focus:outline-none"
                style={{
                  background: "#000000",
                  color: "#ffffff",
                  borderColor: "rgba(255,255,255,0.07)",
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(79,245,223,0.4)"; }}
                onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest pl-1" style={{ color: "#adaaaa" }}>
                Email
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="jane@lokam.dev"
                className="rounded-xl px-5 py-3 text-sm border transition-all focus:outline-none"
                style={{
                  background: "#000000",
                  color: "#ffffff",
                  borderColor: "rgba(255,255,255,0.07)",
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(79,245,223,0.4)"; }}
                onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest pl-1" style={{ color: "#adaaaa" }}>
                Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Temporary password"
                className="rounded-xl px-5 py-3 text-sm border transition-all focus:outline-none"
                style={{
                  background: "#000000",
                  color: "#ffffff",
                  borderColor: "rgba(255,255,255,0.07)",
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(79,245,223,0.4)"; }}
                onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
              />
            </div>

            {/* Role */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold uppercase tracking-widest pl-1" style={{ color: "#adaaaa" }}>
                Role
              </label>
              <div className="flex gap-2 h-[46px]">
                {(["reviewer", "admin", ...(isSuperadmin ? ["superadmin"] : [])] as UserRole[]).map((r) => {
                  const active = newRole === r;
                  const cfg = ROLE_CONFIG[r];
                  return (
                    <button
                      key={r}
                      onClick={() => setNewRole(r)}
                      className="flex-1 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                      style={
                        active
                          ? { background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }
                          : { background: "rgba(255,255,255,0.04)", color: "#adaaaa", border: "1px solid rgba(255,255,255,0.06)" }
                      }
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!newEmail || !newName || !newPassword || createUser.isPending}
            className="px-8 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg,#4ff5df,#22dbc6)",
              color: "#00594f",
              boxShadow: "0 8px 24px rgba(79,245,223,0.2)",
            }}
          >
            {createUser.isPending ? "Creating…" : "Create User"}
          </button>
        </div>
      )}

      {/* ── Users table ──────────────────────────────────────────────── */}
      <div
        className="rounded-3xl overflow-hidden border"
        style={{
          background: "#1a1919",
          borderColor: "rgba(73,72,71,0.05)",
          boxShadow: "0px 24px 48px rgba(0,0,0,0.5)",
        }}
      >
        {/* Table head */}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ background: "rgba(32,31,31,0.5)" }}>
              {[
                { label: "User",   cls: "w-64" },
                { label: "Email",  cls: ""     },
                { label: "Role",   cls: "w-36" },
                { label: "Status", cls: "w-32" },
                { label: "",       cls: "w-32" },
              ].map(({ label, cls }) => (
                <th
                  key={label}
                  className={`px-6 py-5 text-[10px] font-bold uppercase tracking-[0.1em] ${cls} ${label === "" ? "text-right" : ""}`}
                  style={{ color: "#adaaaa" }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(73,72,71,0.05)" }}>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-9 h-9 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
                        <Skeleton className="h-4 w-28" style={{ background: "rgba(255,255,255,0.05)" }} />
                      </div>
                    </td>
                    <td className="px-6 py-5"><Skeleton className="h-4 w-44" style={{ background: "rgba(255,255,255,0.05)" }} /></td>
                    <td className="px-6 py-5"><Skeleton className="h-6 w-20 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} /></td>
                    <td className="px-6 py-5"><Skeleton className="h-4 w-16" style={{ background: "rgba(255,255,255,0.05)" }} /></td>
                    <td className="px-6 py-5 text-right"><Skeleton className="h-7 w-20 rounded-lg ml-auto" style={{ background: "rgba(255,255,255,0.05)" }} /></td>
                  </tr>
                ))
              : data?.map((u) => {
                  const role = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.reviewer;
                  const initials = u.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr
                      key={u.id}
                      className="group transition-colors"
                      style={{ borderBottom: "1px solid rgba(73,72,71,0.05)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#262626"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      {/* User */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold border"
                            style={{
                              background: "rgba(79,245,223,0.08)",
                              color: "#4ff5df",
                              borderColor: "rgba(79,245,223,0.2)",
                            }}
                          >
                            {initials}
                          </div>
                          <span className="text-sm font-semibold" style={{ color: "#ffffff" }}>{u.name}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-6 py-5 font-mono text-sm" style={{ color: "#adaaaa" }}>
                        {u.email}
                      </td>

                      {/* Role */}
                      <td className="px-6 py-5">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: role.bg, color: role.color }}
                        >
                          {role.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: u.is_active ? "#4ff5df" : "rgba(255,255,255,0.2)" }}
                          />
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: u.is_active ? "#4ff5df" : "rgba(255,255,255,0.3)" }}
                          >
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-5 text-right">
                        <button
                          className="px-4 py-1.5 rounded-lg text-xs font-bold border transition-all opacity-0 group-hover:opacity-100 active:scale-95"
                          style={
                            u.is_active
                              ? { background: "#262626", color: "#adaaaa", borderColor: "rgba(255,255,255,0.06)" }
                              : { background: "rgba(79,245,223,0.08)", color: "#4ff5df", borderColor: "rgba(79,245,223,0.2)" }
                          }
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>

        {/* Footer */}
        {!isLoading && (
          <div
            className="px-6 py-4 flex items-center justify-between border-t"
            style={{ background: "rgba(32,31,31,0.3)", borderColor: "rgba(73,72,71,0.05)" }}
          >
            <span className="text-xs font-medium" style={{ color: "#adaaaa" }}>
              {data?.length ?? 0} users in registry
            </span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4ff5df" }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(173,170,170,0.5)" }}>
                Registry Live
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
