import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";
import lokamIcon from "../../assets/LOKAM_SECONDARY_LOGO_WHITE.svg";

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
      style={{ background: "#050505" }}
    >
      {/* ── Background: concentric rings in teal ── */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center" style={{ opacity: 0.06 }}>
        <div
          className="absolute rounded-full border"
          style={{ width: 800, height: 800, borderColor: "#4ff5df" }}
        />
        <div
          className="absolute rounded-full border"
          style={{ width: 560, height: 560, borderColor: "#4ff5df", opacity: 0.6 }}
        />
        <div
          className="absolute rounded-full border"
          style={{ width: 320, height: 320, borderColor: "#4ff5df", opacity: 0.3 }}
        />
      </div>

      {/* Aurora center glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(34,219,198,0.06) 0%, transparent 60%)",
        }}
      />

      {/* Vertical editorial watermark */}
      <div className="hidden lg:block fixed right-10 top-1/2 -translate-y-1/2 rotate-90 origin-right pointer-events-none select-none">
        <span
          className="font-black text-[10rem] leading-none tracking-tighter"
          style={{ color: "#1c1c1e", opacity: 0.8 }}
        >
          LOKAM
        </span>
      </div>

      {/* Bottom fade */}
      <div
        className="fixed bottom-0 left-0 w-full h-1/3 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}
      />

      {/* ── Main card ── */}
      <main className="relative z-10 w-full max-w-[420px] px-6">

        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <img src={lokamIcon} alt="Lokam" className="w-14 h-14 rounded-2xl mb-5" />
          <h1 className="font-bold text-3xl tracking-[0.04em]" style={{ color: "#ffffff" }}>
            Lokam Dev
          </h1>
          <p className="text-[10px] tracking-widest uppercase font-semibold mt-1.5" style={{ color: "#adaaaa" }}>
            Secure Authentication
          </p>
        </div>

        {/* Credentials card */}
        <div
          className="rounded-3xl p-8 relative overflow-hidden"
          style={{
            background: "#1c1c1e",
            boxShadow: "0px 24px 64px rgba(0,0,0,0.6)",
          }}
        >
          {/* Corner accent — top right teal line */}
          <div
            className="absolute top-0 right-0 w-24 h-px pointer-events-none"
            style={{ background: "linear-gradient(to left, #4ff5df, transparent)", opacity: 0.5 }}
          />
          <div
            className="absolute top-0 right-0 w-px h-16 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, #4ff5df, transparent)", opacity: 0.5 }}
          />

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Email */}
            <div className="space-y-2">
              <label
                className="block text-[10px] tracking-[0.1em] uppercase font-bold pl-1"
                style={{ color: "#adaaaa" }}
              >
                Email
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-sm"
                  style={{ color: "rgba(173,170,170,0.5)", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  alternate_email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoFocus
                  className="w-full rounded-xl py-3.5 pl-11 pr-4 text-sm border transition-all focus:outline-none"
                  style={{
                    background: "#000000",
                    color: "#ffffff",
                    borderColor: "rgba(73,72,71,0.2)",
                  }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(79,245,223,0.5)"; }}
                  onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(73,72,71,0.2)"; }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center px-1">
                <label
                  className="block text-[10px] tracking-[0.1em] uppercase font-bold"
                  style={{ color: "#adaaaa" }}
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-sm"
                  style={{ color: "rgba(173,170,170,0.5)", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                >
                  key
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full rounded-xl py-3.5 pl-11 pr-4 text-sm border transition-all focus:outline-none"
                  style={{
                    background: "#000000",
                    color: "#ffffff",
                    borderColor: "rgba(73,72,71,0.2)",
                  }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(79,245,223,0.5)"; }}
                  onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(73,72,71,0.2)"; }}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="px-4 py-3 rounded-xl text-xs font-semibold tracking-wide"
                style={{ background: "rgba(255,113,108,0.12)", color: "#ff716c", border: "1px solid rgba(255,113,108,0.2)" }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading ? "rgba(79,245,223,0.2)" : "linear-gradient(135deg, #4ff5df, #22dbc6)",
                color: loading ? "#4ff5df" : "#00594f",
                boxShadow: loading ? "none" : "0 8px 32px rgba(79,245,223,0.25)",
              }}
            >
              {loading ? (
                <>
                  <span
                    className="material-symbols-outlined text-lg animate-spin"
                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                  >
                    refresh
                  </span>
                  Authenticating…
                </>
              ) : (
                <>
                  Sign In
                  <span
                    className="material-symbols-outlined text-lg"
                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
                  >
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer status bar */}
        <div className="mt-8 flex justify-between items-center px-2" style={{ opacity: 0.5 }}>
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4ff5df" }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#adaaaa" }}>
              Online
            </span>
          </div>
          <div className="flex gap-5">
            <span
              className="material-symbols-outlined text-lg"
              style={{ color: "#adaaaa", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
            >
              shield_lock
            </span>
            <span
              className="material-symbols-outlined text-lg"
              style={{ color: "#adaaaa", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
            >
              database
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
