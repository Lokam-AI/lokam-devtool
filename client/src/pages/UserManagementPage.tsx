import { useState, useMemo } from "react";
import { useUsers, useCreateUser, useUpdateUser } from "@/hooks/use-calls";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth-store";
import { UserPlus, Users, ShieldCheck, Star } from "lucide-react";
import type { UserRole } from "@/types";

const FF = '"cv01", "ss03"' as const;

const ROLE_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  superadmin: { label: "Superadmin", bg: "rgba(234,179,8,0.12)",   color: "#eab308", border: "rgba(234,179,8,0.2)"   },
  admin:      { label: "Admin",      bg: "rgba(113,112,255,0.1)",  color: "#7170ff", border: "rgba(113,112,255,0.2)" },
  reviewer:   { label: "Reviewer",   bg: "rgba(56,189,248,0.1)",   color: "#38bdf8", border: "rgba(56,189,248,0.2)"  },
};

export default function UserManagementPage() {
  const { data, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
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
          <h1
            className="text-3xl tracking-tight"
            style={{ color: "#f7f8f8", fontWeight: 590, letterSpacing: "-0.704px", fontFeatureSettings: FF }}
          >
            User Registry
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>
            Manage system accounts, roles, and access permissions.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm transition-all active:scale-95 border"
          style={
            showCreate
              ? {
                  background: "rgba(255,255,255,0.02)",
                  color: "#8a8f98",
                  borderColor: "rgba(255,255,255,0.08)",
                  fontWeight: 510,
                  fontFeatureSettings: FF,
                }
              : {
                  background: "#5e6ad2",
                  color: "#f7f8f8",
                  borderColor: "transparent",
                  fontWeight: 510,
                  fontFeatureSettings: FF,
                }
          }
          onMouseEnter={(e) => {
            if (!showCreate) (e.currentTarget as HTMLButtonElement).style.background = "#828fff";
          }}
          onMouseLeave={(e) => {
            if (!showCreate) (e.currentTarget as HTMLButtonElement).style.background = "#5e6ad2";
          }}
        >
          <UserPlus className="h-4 w-4" />
          {showCreate ? "Cancel" : "Add User"}
        </button>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: "Total Users",  value: stats.total,     icon: <Users className="h-[18px] w-[18px]" style={{ color: "#62666d" }} /> },
          { label: "Active",       value: stats.active,    icon: <span className="material-symbols-outlined text-lg" style={{ color: "#10b981", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}>check_circle</span> },
          { label: "Admins",       value: stats.admins,    icon: <ShieldCheck className="h-[18px] w-[18px]" style={{ color: "#eab308" }} /> },
          { label: "Reviewers",    value: stats.reviewers, icon: <Star className="h-[18px] w-[18px]" style={{ color: "#38bdf8" }} /> },
        ].map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-xl p-5 border"
            style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <span
                  className="text-[10px] uppercase tracking-[0.05em]"
                  style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
                >
                  {s.label}
                </span>
                {s.icon}
              </div>
              {isLoading ? (
                <Skeleton className="h-9 w-16 mt-1" style={{ background: "rgba(255,255,255,0.05)" }} />
              ) : (
                <span
                  className="text-3xl tracking-tight"
                  style={{ color: "#f7f8f8", fontWeight: 590, fontFeatureSettings: FF }}
                >
                  {s.value}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Create user form ─────────────────────────────────────────── */}
      {showCreate && (
        <div
          className="rounded-2xl p-8 animate-in slide-in-from-top-2 duration-200 border-l-2 border"
          style={{
            background: "#191a1b",
            borderLeftColor: "#7170ff",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(113,112,255,0.1)" }}
            >
              <UserPlus className="h-4 w-4" style={{ color: "#7170ff" }} />
            </div>
            <h2
              className="text-sm uppercase tracking-widest"
              style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
            >
              New User
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
            {/* Full Name */}
            <div className="flex flex-col gap-2">
              <label
                className="text-[10px] uppercase tracking-widest pl-1"
                style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Full Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Jane Smith"
                className="rounded-xl px-5 py-3 text-sm border transition-all focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  color: "#d0d6e0",
                  borderColor: "rgba(255,255,255,0.08)",
                  fontFeatureSettings: FF,
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(113,112,255,0.4)"; }}
                onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label
                className="text-[10px] uppercase tracking-widest pl-1"
                style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Email
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="jane@lokam.dev"
                className="rounded-xl px-5 py-3 text-sm border transition-all focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  color: "#d0d6e0",
                  borderColor: "rgba(255,255,255,0.08)",
                  fontFeatureSettings: FF,
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(113,112,255,0.4)"; }}
                onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label
                className="text-[10px] uppercase tracking-widest pl-1"
                style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Temporary password"
                className="rounded-xl px-5 py-3 text-sm border transition-all focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  color: "#d0d6e0",
                  borderColor: "rgba(255,255,255,0.08)",
                  fontFeatureSettings: FF,
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(113,112,255,0.4)"; }}
                onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
            </div>

            {/* Role */}
            <div className="flex flex-col gap-2">
              <label
                className="text-[10px] uppercase tracking-widest pl-1"
                style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
              >
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
                      className="flex-1 rounded-xl text-[10px] uppercase tracking-widest transition-all"
                      style={
                        active
                          ? {
                              background: cfg.bg,
                              color: cfg.color,
                              border: `1px solid ${cfg.border}`,
                              fontWeight: 510,
                              fontFeatureSettings: FF,
                            }
                          : {
                              background: "rgba(255,255,255,0.02)",
                              color: "#8a8f98",
                              border: "1px solid rgba(255,255,255,0.08)",
                              fontWeight: 510,
                              fontFeatureSettings: FF,
                            }
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
            className="px-8 py-3 rounded-xl text-sm transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: "#5e6ad2",
              color: "#f7f8f8",
              fontWeight: 510,
              fontFeatureSettings: FF,
            }}
            onMouseEnter={(e) => { if (!createUser.isPending) (e.currentTarget as HTMLButtonElement).style.background = "#828fff"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#5e6ad2"; }}
          >
            {createUser.isPending ? "Creating…" : "Create User"}
          </button>
        </div>
      )}

      {/* ── Users table ──────────────────────────────────────────────── */}
      <div
        className="rounded-3xl overflow-hidden border"
        style={{
          background: "#191a1b",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {[
                { label: "User",   cls: "w-64" },
                { label: "Email",  cls: ""     },
                { label: "Role",   cls: "w-36" },
                { label: "Status", cls: "w-32" },
                { label: "",       cls: "w-32" },
              ].map(({ label, cls }) => (
                <th
                  key={label}
                  className={`px-6 py-5 text-[10px] uppercase tracking-[0.1em] ${cls} ${label === "" ? "text-right" : ""}`}
                  style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
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
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      {/* User */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[10px] border"
                            style={{
                              background: "rgba(113,112,255,0.08)",
                              color: "#7170ff",
                              borderColor: "rgba(113,112,255,0.2)",
                              fontWeight: 510,
                              fontFeatureSettings: FF,
                            }}
                          >
                            {initials}
                          </div>
                          <span
                            className="text-sm"
                            style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
                          >
                            {u.name}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td
                        className="px-6 py-5 text-sm"
                        style={{
                          color: "#8a8f98",
                          fontFamily: "Berkeley Mono, ui-monospace, monospace",
                        }}
                      >
                        {u.email}
                      </td>

                      {/* Role */}
                      <td className="px-6 py-5">
                        {isSuperadmin && u.role !== "superadmin" ? (
                          <DropdownSelect
                            size="sm"
                            value={u.role}
                            options={[
                              { value: "reviewer", label: "Reviewer" },
                              { value: "admin",    label: "Admin" },
                            ]}
                            onChange={(newRoleVal) => {
                              updateUser.mutate(
                                { userId: u.id, patch: { role: newRoleVal } },
                                {
                                  onSuccess: () => toast.success(`${u.name} is now ${newRoleVal}`),
                                  onError: () => toast.error("Failed to update role"),
                                }
                              );
                            }}
                          />
                        ) : (
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider border"
                            style={{
                              background: role.bg,
                              color: role.color,
                              borderColor: role.border,
                              fontWeight: 510,
                              fontFeatureSettings: FF,
                            }}
                          >
                            {role.label}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: u.is_active ? "#10b981" : "rgba(255,255,255,0.2)" }}
                          />
                          <span
                            className="text-[10px] uppercase tracking-wider"
                            style={{
                              color: u.is_active ? "#10b981" : "#62666d",
                              fontWeight: 510,
                              fontFeatureSettings: FF,
                            }}
                          >
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-5 text-right">
                        <button
                          disabled={updateUser.isPending}
                          onClick={() => {
                            updateUser.mutate(
                              { userId: u.id, patch: { is_active: !u.is_active } },
                              {
                                onSuccess: () => toast.success(u.is_active ? `${u.name} deactivated` : `${u.name} activated`),
                                onError: () => toast.error("Failed to update user"),
                              }
                            );
                          }}
                          className="px-4 py-1.5 rounded-lg text-xs border transition-all opacity-0 group-hover:opacity-100 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                          style={
                            u.is_active
                              ? {
                                  background: "rgba(255,255,255,0.02)",
                                  color: "#8a8f98",
                                  borderColor: "rgba(255,255,255,0.08)",
                                  fontWeight: 510,
                                  fontFeatureSettings: FF,
                                }
                              : {
                                  background: "rgba(113,112,255,0.08)",
                                  color: "#7170ff",
                                  borderColor: "rgba(113,112,255,0.2)",
                                  fontWeight: 510,
                                  fontFeatureSettings: FF,
                                }
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
            style={{ background: "rgba(255,255,255,0.01)", borderColor: "rgba(255,255,255,0.06)" }}
          >
            <span
              className="text-xs"
              style={{ color: "#8a8f98", fontFeatureSettings: FF }}
            >
              {data?.length ?? 0} users in registry
            </span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#10b981" }} />
              <span
                className="text-[10px] uppercase tracking-widest"
                style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Registry Live
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
