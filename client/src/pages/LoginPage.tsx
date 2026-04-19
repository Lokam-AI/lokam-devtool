import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";
import lokamIcon from "../../assets/LOKAM_SECONDARY_LOGO_WHITE.svg";

const FF = '"cv01", "ss03"' as const;

export default function LoginPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const login    = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "#08090a" }}
    >
      {/* Radial glow — indigo */}
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

      {/* ── Main card ── */}
      <main className="relative z-10 w-full max-w-[400px] px-6">

        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 border"
            style={{
              background: "rgba(94,106,210,0.1)",
              borderColor: "rgba(113,112,255,0.2)",
            }}
          >
            <img src={lokamIcon} alt="Lokam" className="w-7 h-7" />
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
            Lokam DevTool
          </h1>
          <p
            className="text-[11px] uppercase tracking-[0.18em] mt-1.5"
            style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
          >
            Secure Access
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

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[10px] uppercase tracking-[0.12em] pl-0.5"
                style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@lokam.ai"
                required
                autoFocus
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

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[10px] uppercase tracking-[0.12em] pl-0.5"
                style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
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
                  Signing in…
                </>
              ) : (
                "Sign In"
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
