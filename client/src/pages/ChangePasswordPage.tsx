import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";
import api from "@/lib/api";
import { Loader2 } from "lucide-react";

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

  // Outside AppLayout — validate session ourselves.
  useEffect(() => {
    if (!initialized) refreshMe();
  }, [initialized, refreshMe]);

  useEffect(() => {
    if (initialized && !user) navigate("/login", { replace: true });
  }, [initialized, user, navigate]);

  if (!initialized) return null;
  if (!user) return null;

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
      style={{ background: "#050505" }}
    >
      {/* Aurora glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(34,219,198,0.05) 0%, transparent 60%)",
        }}
      />

      {/* Card */}
      <main className="relative z-10 w-full max-w-[420px] px-6">
        <div
          className="rounded-2xl border p-8"
          style={{
            background: "#131313",
            borderColor: "rgba(73,72,71,0.2)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}
        >
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: "#ffffff" }}>
              Change Password
            </h1>
            <p className="text-sm" style={{ color: "#adaaaa" }}>
              You must set a new password before continuing.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Current password */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[10px] font-bold uppercase tracking-[0.1em]"
                style={{ color: "#adaaaa" }}
              >
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-colors"
                style={{
                  background: "#000000",
                  borderColor: "rgba(255,255,255,0.07)",
                  color: "#ffffff",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(79,245,223,0.4)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
              />
            </div>

            {/* New password */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[10px] font-bold uppercase tracking-[0.1em]"
                style={{ color: "#adaaaa" }}
              >
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-colors"
                style={{
                  background: "#000000",
                  borderColor: "rgba(255,255,255,0.07)",
                  color: "#ffffff",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(79,245,223,0.4)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
              />
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[10px] font-bold uppercase tracking-[0.1em]"
                style={{ color: "#adaaaa" }}
              >
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-colors"
                style={{
                  background: "#000000",
                  borderColor: "rgba(255,255,255,0.07)",
                  color: "#ffffff",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(79,245,223,0.4)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs font-semibold" style={{ color: "#ff716c" }}>
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #4ff5df, #22dbc6)",
                color: "#00473f",
                boxShadow: "0 8px 24px rgba(79,245,223,0.15)",
              }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Update Password
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
