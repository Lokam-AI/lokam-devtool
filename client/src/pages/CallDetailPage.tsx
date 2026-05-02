import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRawCall } from "@/hooks/use-calls";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft, Bot, Play, Pause, Phone, MapPin,
  Clock, Star, Mail, Mic, ArrowRight, ArrowLeft,
  TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle, AlertCircle, MessageSquare,
} from "lucide-react";
import type { RawCall } from "@/types";
import { parseUtc } from "@/lib/utils";
import { PostCallSmsPanel } from "@/components/PostCallSmsPanel";

const FF = '"cv01", "ss03"' as const;
const MONO = "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace" as const;
const SPEED_OPTIONS = [1, 1.5, 2, 2.5, 3, 0.5] as const;

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useRawCall(id!);
  const navigate = useNavigate();

  if (isLoading) return <CallDetailSkeleton />;
  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <XCircle className="h-8 w-8" style={{ color: "#ff716c" }} />
        <p className="text-xs uppercase tracking-widest" style={{ color: "#ff716c", fontWeight: 510, fontFeatureSettings: FF }}>
          {isError ? "Failed to load call" : "Call not found"}
        </p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest transition-opacity hover:opacity-70 mt-1"
          style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
        >
          <ChevronLeft className="h-3 w-3" /> Go back
        </button>
      </div>
    );
  }

  return <CallDetailInner call={data} navigate={navigate} />;
}

function CallDetailInner({ call, navigate }: { call: RawCall; navigate: ReturnType<typeof useNavigate> }) {
  const [speedIndex, setSpeedIndex]       = useState(0);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTime, setCurrentTime]     = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const speedRef = useRef<number>(SPEED_OPTIONS[0]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      setAudioProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
    };
    const onLoad = () => setAudioDuration(audio.duration);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoad);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoad);
    };
  }, []);

  const cycleSpeed = () => {
    setSpeedIndex((prev) => {
      const next = (prev + 1) % SPEED_OPTIONS.length;
      speedRef.current = SPEED_OPTIONS[next];
      if (audioRef.current) audioRef.current.playbackRate = SPEED_OPTIONS[next];
      return next;
    });
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = speedRef.current;
    if (audioRef.current.paused) { audioRef.current.play(); setIsPlaying(true); }
    else { audioRef.current.pause(); setIsPlaying(false); }
  };

  const seekAudio = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * audioDuration;
  };

  const durationStr   = `${Math.floor(call.duration / 60)}m ${call.duration % 60}s`;
  const positiveTags  = (call.ai_positive_mentions ?? []).filter(Boolean);
  const detractorTags = (call.ai_detractors ?? []).filter(Boolean);
  const callDate      = parseUtc(call.date);
  const nps           = call.ai_nps_score;
  const npsConfig     = nps !== null ? npsColors(nps) : null;
  const npsLabel      = nps !== null ? (nps <= 6 ? "Detractor" : nps <= 8 ? "Passive" : "Promoter") : null;
  const npsIcon       = nps !== null ? (nps <= 6 ? TrendingDown : nps <= 8 ? Minus : TrendingUp) : null;

  const extraMeta = call.call_metadata
    ? Object.entries(call.call_metadata).filter(([k]) => k !== "email_escalated")
    : [];

  return (
    <div
      className="flex overflow-hidden -m-6"
      style={{ height: "calc(100vh - 3.5rem)", fontFamily: "Inter Variable, system-ui, sans-serif" }}
    >

      {/* ════════════ LEFT PANEL — 60% ════════════ */}
      <div
        className="flex flex-col overflow-hidden border-r"
        style={{ width: "60%", background: "#0f1011", borderColor: "rgba(255,255,255,0.05)" }}
      >
        {/* ── Sticky Header ── */}
        <div
          className="shrink-0 px-7 pt-5 pb-4 border-b"
          style={{ background: "#141516", borderColor: "rgba(255,255,255,0.06)" }}
        >
          {/* Back nav + call badge + date */}
          <div className="flex items-center gap-2.5 mb-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] uppercase tracking-widest transition-all"
              style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#d0d6e0"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#62666d"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
            >
              <ChevronLeft className="h-3 w-3" /> Back
            </button>

            <div className="h-3 w-px" style={{ background: "rgba(255,255,255,0.08)" }} />

            <span
              className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest border"
              style={{ background: "rgba(113,112,255,0.1)", color: "#7170ff", borderColor: "rgba(113,112,255,0.2)", fontWeight: 510, fontFeatureSettings: FF, fontFamily: MONO }}
            >
              #{call.call_id}
            </span>

            <span className="text-[11px]" style={{ color: "#4a4f58", fontFeatureSettings: FF }}>
              {callDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            </span>

            <span className="text-[11px]" style={{ color: "#4a4f58", fontFamily: MONO }}>
              {callDate.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>

            <div className="ml-auto">
              <StatusBadge status={call.call_status} />
            </div>
          </div>

          {/* Org + campaign */}
          <div className="mb-3">
            <h1
              className="text-[22px] leading-tight mb-1"
              style={{ fontWeight: 600, letterSpacing: "-0.3px", fontFeatureSettings: FF }}
            >
              <span style={{ color: "#f7f8f8" }}>{call.organization_name || "Unknown Organization"}</span>
              {call.campaign && (
                <span style={{ color: "#5e6ad2" }}> / {call.campaign}</span>
              )}
            </h1>
            <div className="flex items-center flex-wrap gap-3">
              {call.rooftop_name && (
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>
                  <MapPin className="h-3 w-3 shrink-0" style={{ color: "#62666d" }} />
                  {call.rooftop_name}
                </span>
              )}
              {call.customer_phone && (
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>
                  <Phone className="h-3 w-3 shrink-0" style={{ color: "#62666d" }} />
                  {call.customer_phone}
                </span>
              )}
              {call.customer_name && call.customer_name !== call.customer_phone && (
                <span className="text-[12px]" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>
                  {call.customer_name}
                </span>
              )}
              {call.source_env && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded border"
                  style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)", color: "#4a4f58", fontFeatureSettings: FF }}
                >
                  {call.source_env}
                </span>
              )}
            </div>
          </div>

          {/* Stat pills row */}
          <div className="flex items-center flex-wrap gap-2">
            <MiniStat label="Duration" value={durationStr} icon={<Clock className="h-3 w-3" />} />
            {call.direction && (
              <MiniStat
                label={call.direction}
                value=""
                icon={call.direction.toLowerCase() === "inbound"
                  ? <ArrowLeft className="h-3 w-3" />
                  : <ArrowRight className="h-3 w-3" />
                }
              />
            )}
            {call.lead_type && (
              <MiniStat label="Lead" value={call.lead_type} />
            )}
            {call.ended_reason && (
              <MiniStat label="Ended" value={call.ended_reason} />
            )}
            {call.is_post_call_sms_survey && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] uppercase tracking-widest"
                style={{
                  background: "rgba(245,158,11,0.07)",
                  borderColor: "rgba(245,158,11,0.2)",
                  color: "#f59e0b",
                  fontWeight: 510,
                  fontFeatureSettings: FF,
                }}
              >
                <MessageSquare className="h-3 w-3" />
                Post-call SMS
              </div>
            )}
            {call.review_link_sent && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] uppercase tracking-widest"
                style={{ background: "rgba(16,185,129,0.07)", borderColor: "rgba(16,185,129,0.2)", color: "#10b981", fontWeight: 510, fontFeatureSettings: FF }}
              >
                <Star className="h-3 w-3 fill-current" />
                Review Sent
              </div>
            )}
            {call.call_metadata?.email_escalated && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] uppercase tracking-widest"
                style={{ background: "rgba(251,146,60,0.07)", borderColor: "rgba(251,146,60,0.2)", color: "#fb923c", fontWeight: 510, fontFeatureSettings: FF }}
              >
                <Mail className="h-3 w-3" />
                Email Sent
              </div>
            )}
          </div>
        </div>

        {/* ── Audio Player ── */}
        {call.recording_url && (
          <div
            className="shrink-0 px-7 py-3 border-b flex items-center gap-4"
            style={{ background: "#141516", borderColor: "rgba(255,255,255,0.05)" }}
          >
            <button
              onClick={togglePlay}
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95"
              style={{ background: isPlaying ? "#828fff" : "#5e6ad2" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#828fff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isPlaying ? "#828fff" : "#5e6ad2"; }}
            >
              {isPlaying
                ? <Pause className="h-3.5 w-3.5" style={{ color: "#f7f8f8" }} />
                : <Play className="h-3.5 w-3.5 ml-0.5" style={{ color: "#f7f8f8" }} />
              }
            </button>

            <div className="flex-1 flex flex-col gap-1.5">
              <div
                className="w-full h-1 rounded-full overflow-hidden cursor-pointer group"
                style={{ background: "rgba(255,255,255,0.06)" }}
                onClick={seekAudio}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${audioProgress}%`, background: "linear-gradient(90deg, #5e6ad2, #7170ff)" }}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-[10px]" style={{ color: "#62666d", fontFamily: MONO }}>{formatTimestamp(currentTime)}</span>
                <span className="text-[10px]" style={{ color: "#62666d", fontFamily: MONO }}>{formatTimestamp(audioDuration)}</span>
              </div>
            </div>

            <button
              onClick={cycleSpeed}
              className="px-2.5 py-1 rounded-md text-[10px] uppercase tracking-widest border transition-all min-w-[40px] text-center"
              style={{ background: "transparent", color: "#8a8f98", borderColor: "rgba(255,255,255,0.08)", fontWeight: 510, fontFeatureSettings: FF }}
              onMouseEnter={(e) => { (e.currentTarget).style.color = "#7170ff"; (e.currentTarget).style.borderColor = "rgba(113,112,255,0.3)"; }}
              onMouseLeave={(e) => { (e.currentTarget).style.color = "#8a8f98"; (e.currentTarget).style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              {SPEED_OPTIONS[speedIndex]}×
            </button>

            <audio
              ref={audioRef}
              preload="metadata"
              src={call.recording_url}
              onPlay={() => { if (audioRef.current) audioRef.current.playbackRate = speedRef.current; }}
              onEnded={() => setIsPlaying(false)}
            />
          </div>
        )}

        {/* ── Scrollable body ── */}
        <ScrollArea className="flex-1">
          <div className="px-7 py-6 space-y-7">

            {/* AI Summary */}
            {call.ai_call_summary && (
              <div
                className="relative rounded-xl p-5 overflow-hidden border"
                style={{ background: "rgba(94,106,210,0.04)", borderColor: "rgba(94,106,210,0.15)", borderLeft: "2px solid #5e6ad2" }}
              >
                <div
                  className="absolute pointer-events-none inset-0"
                  style={{ background: "radial-gradient(ellipse at 0% 50%, rgba(94,106,210,0.07) 0%, transparent 65%)" }}
                />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ background: "rgba(113,112,255,0.15)" }}
                    >
                      <Bot className="h-3 w-3" style={{ color: "#7170ff" }} />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest" style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }}>
                      AI Summary
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed" style={{ color: "#a0a6b0", fontFeatureSettings: FF }}>
                    {call.ai_call_summary}
                  </p>
                </div>
              </div>
            )}

            {/* Post-call SMS panel */}
            <PostCallSmsPanel callData={call} />

            {/* Transcript */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                  >
                    <Mic className="h-3 w-3" style={{ color: "#62666d" }} />
                  </div>
                  <h3 className="text-[11px] uppercase tracking-widest" style={{ color: "#d0d6e0", fontWeight: 510, fontFeatureSettings: FF }}>
                    Call Transcript
                  </h3>
                </div>
                <span
                  className="px-2 py-1 rounded-md text-[10px] uppercase tracking-widest"
                  style={{ background: "rgba(255,255,255,0.03)", color: "#4a4f58", fontWeight: 510, fontFeatureSettings: FF, border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  Auto-Generated
                </span>
              </div>
              <div className="space-y-4">
                {call.transcript
                  ? formatTranscript(call.transcript)
                  : <p className="text-xs italic" style={{ color: "#4a4f58", fontFeatureSettings: FF }}>No transcript available</p>
                }
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* ════════════ RIGHT PANEL — 40% ════════════ */}
      <div className="flex flex-col" style={{ width: "40%", background: "#0c0d0e" }}>
        {/* Panel header */}
        <div
          className="shrink-0 px-5 py-4 border-b"
          style={{ background: "#0f1011", borderColor: "rgba(255,255,255,0.05)" }}
        >
          <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "#4a4f58", fontWeight: 510, fontFeatureSettings: FF }}>
            Call Intelligence
          </p>
          <h2 className="text-[14px]" style={{ color: "#f7f8f8", fontWeight: 560, fontFeatureSettings: FF }}>
            AI Analysis
          </h2>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 py-4 space-y-3">

            {/* NPS Hero Card */}
            {nps !== null && npsConfig && npsLabel && npsIcon && (
              <div
                className="rounded-xl p-4 border overflow-hidden relative"
                style={{ background: `${npsConfig.bg}`, borderColor: npsConfig.border }}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at 100% 0%, ${npsConfig.glow} 0%, transparent 60%)` }}
                />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: npsConfig.muted, fontWeight: 510, fontFeatureSettings: FF }}>
                        NPS Score
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl" style={{ color: npsConfig.text, fontWeight: 700, fontFamily: MONO, lineHeight: 1 }}>
                          {nps}
                        </span>
                        <span className="text-[14px]" style={{ color: npsConfig.muted, fontFamily: MONO }}>/10</span>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border"
                      style={{ background: "rgba(0,0,0,0.2)", borderColor: npsConfig.border }}
                    >
                      {(() => { const Icon = npsIcon; return <Icon className="h-3.5 w-3.5" style={{ color: npsConfig.text }} />; })()}
                      <span className="text-[11px] uppercase tracking-widest" style={{ color: npsConfig.text, fontWeight: 510, fontFeatureSettings: FF }}>
                        {npsLabel}
                      </span>
                    </div>
                  </div>
                  {/* NPS bar */}
                  <div className="space-y-1.5">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.25)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${nps * 10}%`, background: npsConfig.bar }}
                      />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[9px]" style={{ color: npsConfig.muted, fontFamily: MONO }}>0</span>
                      <span className="text-[9px]" style={{ color: npsConfig.muted, fontFamily: MONO }}>10</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Call Flags */}
            <Section label="Call Flags">
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                <FlagRow label="Call Completed" value={call.ai_is_resolved} positiveIsTrue icon={call.ai_is_resolved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} />
                <FlagRow label="DNC Request" value={call.ai_callback_requested} icon={<AlertCircle className="h-3.5 w-3.5" />} />
                {call.review_link_sent != null && (
                  <FlagRow label="Review Link Sent" value={!!call.review_link_sent} positiveIsTrue icon={<Star className="h-3.5 w-3.5" />} />
                )}
                {call.call_metadata?.email_escalated != null && (
                  <FlagRow label="Email Escalated" value={!!call.call_metadata.email_escalated} icon={<Mail className="h-3.5 w-3.5" />} />
                )}
              </div>
            </Section>

            {/* AI Overall Feedback */}
            {call.ai_overall_feedback && (
              <Section label="AI Feedback">
                <p className="text-[12px] leading-relaxed" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>
                  {call.ai_overall_feedback}
                </p>
              </Section>
            )}

            {/* Positive Mentions */}
            <Section label={`Positive Mentions${positiveTags.length > 0 ? ` · ${positiveTags.length}` : ""}`}>
              {positiveTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {positiveTags.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider border"
                      style={{ background: "rgba(16,185,129,0.07)", color: "#10b981", borderColor: "rgba(16,185,129,0.18)", fontWeight: 510, fontFeatureSettings: FF }}
                    >
                      <span className="w-1 h-1 rounded-full bg-current shrink-0" />
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px]" style={{ color: "#4a4f58", fontFeatureSettings: FF }}>None detected</p>
              )}
            </Section>

            {/* Detractors */}
            <Section label={`Detractors${detractorTags.length > 0 ? ` · ${detractorTags.length}` : ""}`}>
              {detractorTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {detractorTags.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider border"
                      style={{ background: "rgba(255,113,108,0.07)", color: "#ff716c", borderColor: "rgba(255,113,108,0.18)", fontWeight: 510, fontFeatureSettings: FF }}
                    >
                      <span className="w-1 h-1 rounded-full bg-current shrink-0" />
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px]" style={{ color: "#4a4f58", fontFeatureSettings: FF }}>None detected</p>
              )}
            </Section>

            {/* Extra Metadata */}
            {extraMeta.filter(([, v]) => v !== null && v !== undefined).length > 0 && (
              <Section label="Metadata">
                <div className="space-y-2">
                  {extraMeta
                    .filter(([, v]) => v !== null && v !== undefined)
                    .map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between py-0.5">
                        <span className="text-[11px] capitalize" style={{ color: "#62666d", fontFeatureSettings: FF }}>
                          {k.replace(/_/g, " ")}
                        </span>
                        <MetaValue value={v} />
                      </div>
                    ))}
                </div>
              </Section>
            )}

          </div>
        </ScrollArea>

        {/* Footer back button */}
        <div
          className="shrink-0 px-4 py-3 border-t"
          style={{ background: "#0f1011", borderColor: "rgba(255,255,255,0.05)" }}
        >
          <button
            onClick={() => navigate(-1)}
            className="w-full py-2.5 rounded-lg text-[12px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] border"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#d0d6e0"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#62666d"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  NPS color config                              */
/* ────────────────────────────────────────────── */
type NpsConfig = { bg: string; border: string; text: string; muted: string; bar: string; glow: string };

function npsColors(score: number): NpsConfig {
  if (score <= 6) return {
    bg: "rgba(255,113,108,0.06)",
    border: "rgba(255,113,108,0.18)",
    text: "#ff716c",
    muted: "rgba(255,113,108,0.6)",
    bar: "linear-gradient(90deg, #ff716c, #ff9a96)",
    glow: "rgba(255,113,108,0.08)",
  };
  if (score <= 8) return {
    bg: "rgba(113,112,255,0.06)",
    border: "rgba(113,112,255,0.18)",
    text: "#7170ff",
    muted: "rgba(113,112,255,0.6)",
    bar: "linear-gradient(90deg, #5e6ad2, #7170ff)",
    glow: "rgba(113,112,255,0.08)",
  };
  return {
    bg: "rgba(16,185,129,0.06)",
    border: "rgba(16,185,129,0.18)",
    text: "#10b981",
    muted: "rgba(16,185,129,0.6)",
    bar: "linear-gradient(90deg, #059669, #10b981)",
    glow: "rgba(16,185,129,0.08)",
  };
}

/* ────────────────────────────────────────────── */
/*  StatusBadge                                   */
/* ────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  if (!status) return null;
  const isCompleted = status === "Completed";
  return (
    <span
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest border"
      style={{
        background: isCompleted ? "rgba(16,185,129,0.1)" : "rgba(255,113,108,0.1)",
        color: isCompleted ? "#10b981" : "#ff716c",
        borderColor: isCompleted ? "rgba(16,185,129,0.2)" : "rgba(255,113,108,0.2)",
        fontWeight: 510,
        fontFeatureSettings: FF,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

/* ────────────────────────────────────────────── */
/*  MiniStat pill                                 */
/* ────────────────────────────────────────────── */
function MiniStat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] uppercase tracking-widest"
      style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)", fontWeight: 510, fontFeatureSettings: FF }}
    >
      {icon && <span style={{ color: "#62666d" }}>{icon}</span>}
      <span style={{ color: "#62666d" }}>{label}</span>
      {value && <span style={{ color: "#a0a6b0" }}>{value}</span>}
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  Section card                                  */
/* ────────────────────────────────────────────── */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "rgba(255,255,255,0.015)", borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
        <p className="text-[9px] uppercase tracking-widest" style={{ color: "#4a4f58", fontWeight: 510, fontFeatureSettings: FF }}>
          {label}
        </p>
      </div>
      <div className="px-4 py-3">
        {children}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  FlagRow                                       */
/* ────────────────────────────────────────────── */
function FlagRow({
  label, value, positiveIsTrue, icon,
}: {
  label: string; value: boolean; positiveIsTrue?: boolean; icon?: React.ReactNode;
}) {
  const isGood = positiveIsTrue ? value : !value;
  const color = value
    ? (positiveIsTrue ? "#10b981" : "#ff716c")
    : (positiveIsTrue ? "#4a4f58" : "#10b981");

  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2">
        <span style={{ color: "#4a4f58" }}>{icon}</span>
        <span className="text-[12px]" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>{label}</span>
      </div>
      <span
        className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-md"
        style={{
          background: isGood ? "rgba(16,185,129,0.1)" : value ? "rgba(255,113,108,0.1)" : "rgba(255,255,255,0.04)",
          color,
          fontWeight: 510,
          fontFeatureSettings: FF,
        }}
      >
        {value ? "Yes" : "No"}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  MetaValue — smart formatter for metadata      */
/* ────────────────────────────────────────────── */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function MetaValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-[11px]" style={{ color: "#4a4f58", fontFamily: MONO }}>—</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span
        className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-md"
        style={{
          background: value ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
          color: value ? "#10b981" : "#62666d",
          fontWeight: 510,
          fontFeatureSettings: FF,
        }}
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    const d = parseUtc(value);
    return (
      <span className="text-[11px]" style={{ color: "#8a8f98", fontFamily: MONO }}>
        {d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
      </span>
    );
  }
  return (
    <span className="text-[11px]" style={{ color: "#8a8f98", fontFamily: MONO }}>
      {String(value)}
    </span>
  );
}

/* ────────────────────────────────────────────── */
/*  Transcript formatter                          */
/* ────────────────────────────────────────────── */
function formatTranscript(transcript: string): React.ReactNode {
  let elapsed = 0;
  return transcript.split("\n").filter(Boolean).map((line, i) => {
    const isAgent    = line.startsWith("assistant:");
    const isCustomer = line.startsWith("human:");
    const text = line.replace(/^(assistant|human):\s*/, "").trim();
    if (!text) return null;
    const ts = formatTimestamp(elapsed);
    elapsed += Math.max(2, Math.round(text.split(/\s+/).length / 2.5));

    if (isCustomer) {
      return (
        <div key={i} className="flex gap-3 max-w-[88%] ml-auto flex-row-reverse">
          <div
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px]"
            style={{ background: "#5e6ad2", color: "#f7f8f8", fontWeight: 600 }}
          >
            C
          </div>
          <div className="space-y-1 text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-[10px]" style={{ color: "#4a4f58", fontFamily: MONO }}>{ts}</span>
              <span className="text-[10px] uppercase tracking-widest" style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }}>
                Customer
              </span>
            </div>
            <div
              className="px-4 py-3 rounded-2xl rounded-tr-sm"
              style={{ background: "rgba(94,106,210,0.1)", border: "1px solid rgba(113,112,255,0.18)" }}
            >
              <p className="text-[13px] leading-relaxed text-left" style={{ color: "#d0d6e0", fontFeatureSettings: FF }}>{text}</p>
            </div>
          </div>
        </div>
      );
    }

    if (isAgent) {
      return (
        <div key={i} className="flex gap-3 max-w-[88%]">
          <div
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center border"
            style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}
          >
            <Bot className="h-3.5 w-3.5" style={{ color: "#4a4f58" }} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest" style={{ color: "#4a4f58", fontWeight: 510, fontFeatureSettings: FF }}>
                System Agent
              </span>
              <span className="text-[10px]" style={{ color: "#4a4f58", fontFamily: MONO }}>{ts}</span>
            </div>
            <div
              className="px-4 py-3 rounded-2xl rounded-tl-sm"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-[13px] leading-relaxed" style={{ color: "#8a8f98", fontFeatureSettings: FF }}>{text}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={i} className="px-4 py-2 text-[11px] italic" style={{ color: "#4a4f58", fontFeatureSettings: FF }}>
        {line}
      </div>
    );
  });
}

function formatTimestamp(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ────────────────────────────────────────────── */
/*  Loading skeleton                              */
/* ────────────────────────────────────────────── */
function CallDetailSkeleton() {
  return (
    <div className="flex overflow-hidden -m-6" style={{ height: "calc(100vh - 3.5rem)" }}>
      <div className="flex flex-col gap-6 px-7 py-6" style={{ width: "60%", background: "#0f1011" }}>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-md" style={{ background: "rgba(255,255,255,0.05)" }} />
            <Skeleton className="h-6 w-28 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>
          <Skeleton className="h-7 w-72" style={{ background: "rgba(255,255,255,0.05)" }} />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-24 rounded-md" style={{ background: "rgba(255,255,255,0.05)" }} />)}
          </div>
        </div>
        <Skeleton className="h-20 w-full rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.04)" }} />)}
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 py-4 border-l" style={{ width: "40%", background: "#0c0d0e", borderColor: "rgba(255,255,255,0.05)" }}>
        <Skeleton className="h-32 w-full rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }} />
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }} />)}
      </div>
    </div>
  );
}
