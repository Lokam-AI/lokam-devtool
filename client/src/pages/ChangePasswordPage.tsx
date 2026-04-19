import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";
import api from "@/lib/api";

const FF = '"cv01", "ss03"' as const;

export default function ChangePasswordPage() {
  const user        = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const refreshMe   = useAuthStore((s) => s.refreshMe);
  const logout      = useAuthStore((s) => s.logout);
  const navigate    = useNavigate();

  const [currentPassword,  setCurrentPassword]  = useState("");
  const [newPassword,      setNewPassword]       = useState("");
  const [confirmPassword,  setConfirmPassword]   = useState("");
  const [error,            setError]             = useState("");
  const [loading,          setLoading]           = useState(false);

  useEffect(() => {
    if (!initialized) refreshMe();
  }, [initialized, refreshMe]);

  useEffect(() => {
    if (initialized && !user) navigate("/login", { replace: true });
  }, [initialized, user, navigate]);

  if (!initialized || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password:     newPassword,
      });
      await logout();
      navigate("/login", { replace: true });
    } catch {
      setError("Failed to change password. Check your current password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "#08090a" }}
    >
      {/* Radial glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(94,106,210,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Fine grid texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <main className="relative z-10 w-full max-w-[400px] px-6">

        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 border"
            style={{
              background: "rgba(94,106,210,0.1)",
              borderColor: "rgba(113,112,255,0.2)",
            }}
          >
            <span
              className="material-symbols-outlined text-lg"
              style={{ color: "#7170ff", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
            >
              lock_reset
            </span>
          </div>
          <h1
            className="text-2xl tracking-tight"
            style={{
              color: "#f7f8f8",
              fontWeight: 590,
              letterSpacing: "-0.288px",
              fontFeatureSettings: FF,
            }}
          >
            Set New Password
          </h1>
          <p
            className="text-xs mt-1.5 text-center"
            style={{ color: "#62666d", fontFeatureSettings: FF }}
          >
            You must set a new password before continuing.
          </p>
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl p-8 border"
          style={{
            background: "#0f1011",
            borderColor: "rgba(255,255,255,0.08)",
            boxShadow: "rgba(0,0,0,0) 0px 8px 2px, rgba(0,0,0,0.01) 0px 5px 2px, rgba(0,0,0,0.04) 0px 3px 2px, rgba(0,0,0,0.07) 0px 1px 1px, rgba(0,0,0,0.08) 0px 0px 1px",
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">

            {/* Current password */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[10px] uppercase tracking-[0.12em] pl-0.5"
                style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoFocus
                placeholder="••••••••••••"
                className="w-full rounded-lg px-4 py-3 text-sm border transition-all focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "rgba(255,255,255,0.08)",
                  color: "#f7f8f8",
                  fontFeatureSettings: FF,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(113,112,255,0.45)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
            </div>

            {/* Divider */}
            <div style={{ height: "1px", background: "rgba(255,255,255,0.05)" }} />

            {/* New password */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[10px] uppercase tracking-[0.12em] pl-0.5"
                style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
              >
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Min. 6 characters"
                className="w-full rounded-lg px-4 py-3 text-sm border transition-all focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "rgba(255,255,255,0.08)",
                  color: "#f7f8f8",
                  fontFeatureSettings: FF,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(113,112,255,0.45)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[10px] uppercase tracking-[0.12em] pl-0.5"
                style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••••••"
                className="w-full rounded-lg px-4 py-3 text-sm border transition-all focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "rgba(255,255,255,0.08)",
                  color: "#f7f8f8",
                  fontFeatureSettings: FF,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(113,112,255,0.45)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
            </div>

            {/* Error */}
            {error && (
              <div
                className="px-4 py-2.5 rounded-lg text-xs border"
                style={{
                  background: "rgba(255,113,108,0.06)",
                  color: "#ff716c",
                  borderColor: "rgba(255,113,108,0.2)",
                  fontFeatureSettings: FF,
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              style={{
                background: loading ? "rgba(94,106,210,0.2)" : "#5e6ad2",
                color: loading ? "#7170ff" : "#f7f8f8",
                fontWeight: 510,
                fontFeatureSettings: FF,
              }}
              onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#828fff"; }}
              onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#5e6ad2"; }}
            >
              {loading ? (
                <>
                  <span
                    className="material-symbols-outlined text-base animate-spin"
                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                  >
                    refresh
                  </span>
                  Updating…
                </>
              ) : (
                "Update Password"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-center gap-2 mt-6"
          style={{ opacity: 0.35 }}
        >
          <span
            className="material-symbols-outlined text-base"
            style={{ color: "#62666d", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
          >
            shield_lock
          </span>
          <span
            className="text-[10px] uppercase tracking-[0.15em]"
            style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
          >
            Encrypted session
          </span>
        </div>
      </main>
    </div>
  );
}
