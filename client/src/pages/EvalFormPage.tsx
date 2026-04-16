import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCall, useCalls, useSubmitEval } from "@/hooks/use-calls";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Phone, MapPin, ArrowUpRight, ArrowDownLeft,
  Bot, Play, Pause, Check, X, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import type { RawCall, Eval } from "@/types";

type FieldState = { correct: boolean; value: unknown };
const SPEED_OPTIONS = [1, 1.5, 2, 2.5, 3, 0.5] as const;

const EVAL_TAGS = [
  "Staff Professionalism",
  "Service Quality",
  "Timeliness & Wait Times",
  "Vehicle Condition Post Service",
  "Pricing Transparency",
  "Amenities & Waiting Area",
  "Communication & Updates",
  "Scheduling & Logistics",
  "Warranty & Coverage",
  "Others",
] as const;

/* ══════════════════════════════════════════════════════════════════════
   Page shell — resolves data, delegates to inner
══════════════════════════════════════════════════════════════════════ */
export default function EvalFormPage() {
  const { id }    = useParams<{ id: string }>();
  const { data, isLoading, isError } = useCall(id!);
  const { data: allCalls }  = useCalls();
  const submitEval = useSubmitEval();
  const navigate   = useNavigate();

  if (isLoading) return <EvalSkeleton />;
  if (isError) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#ff716c" }}>
        Failed to load call. Please go back and try again.
      </p>
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>
        Call not found
      </p>
    </div>
  );

  return (
    <EvalFormInner
      callData={data.call}
      evalData={data.eval}
      allCalls={allCalls}
      navigate={navigate}
      submitEval={submitEval}
    />
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Inner — full 60/40 split layout
══════════════════════════════════════════════════════════════════════ */
function EvalFormInner({
  callData, evalData, allCalls, navigate, submitEval,
}: {
  callData: RawCall;
  evalData: Eval;
  allCalls: ReturnType<typeof useCalls>["data"];
  navigate: ReturnType<typeof useNavigate>;
  submitEval: ReturnType<typeof useSubmitEval>;
}) {
  /* ── Eval field state ── */
  const [fields, setFields] = useState<Record<string, FieldState>>(() => ({
    nps_score:         { correct: true, value: callData.ai_nps_score },
    call_summary:      { correct: true, value: callData.ai_call_summary },
    overall_feedback:  { correct: true, value: callData.ai_overall_feedback },
    positive_mentions: { correct: true, value: callData.ai_positive_mentions ?? [] },
    detractors:        { correct: true, value: callData.ai_detractors ?? [] },
  }));

  // Explicit boolean / classification fields
  const [isNotIncomplete, setIsNotIncomplete]   = useState<boolean>(callData.ai_is_resolved ?? true);
  const [incompleteReason, setIncompleteReason] = useState<string>("");
  const [isDncRequest, setIsDncRequest]         = useState<boolean>(false);
  const [escalationNeeded, setEscalationNeeded] = useState<boolean>(false);

  const setField = useCallback((key: string, update: Partial<FieldState>) => {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...update } }));
  }, []);

  /* ── Audio player state ── */
  const [speedIndex, setSpeedIndex]     = useState(0);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTime, setCurrentTime]   = useState(0);
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

  /* ── Submit ── */
  const handleSubmit = async () => {
    const corrections: Record<string, { ai_value: unknown; gt_value: unknown }> = {};
    const evalUpdate: Partial<Eval> = {};

    const GT_KEY_MAP: Record<string, keyof Eval> = {
      nps_score:         "gt_nps_score",
      call_summary:      "gt_call_summary",
      overall_feedback:  "gt_overall_feedback",
      positive_mentions: "gt_positive_mentions",
      detractors:        "gt_detractors",
    };
    const AI_KEY_MAP: Record<string, keyof RawCall> = {
      nps_score:         "ai_nps_score",
      call_summary:      "ai_call_summary",
      overall_feedback:  "ai_overall_feedback",
      positive_mentions: "ai_positive_mentions",
      detractors:        "ai_detractors",
    };

    Object.entries(fields).forEach(([key, state]) => {
      const gtKey = GT_KEY_MAP[key];
      const aiKey = AI_KEY_MAP[key];
      if (!gtKey || !aiKey) return;
      const aiVal = callData[aiKey];
      if (state.correct) {
        (evalUpdate[gtKey] as unknown) = aiVal;
      } else {
        (evalUpdate[gtKey] as unknown) = state.value;
        corrections[key] = { ai_value: aiVal, gt_value: state.value };
      }
    });

    // Boolean / classification fields handled explicitly
    evalUpdate.gt_is_incomplete_call = !isNotIncomplete;
    evalUpdate.gt_incomplete_reason  = !isNotIncomplete ? incompleteReason || null : null;
    evalUpdate.gt_is_dnc_request     = isDncRequest;
    evalUpdate.gt_escalation_needed  = escalationNeeded;
    evalUpdate.corrections = corrections;

    try {
      await submitEval.mutateAsync({ evalId: evalData.id, data: evalUpdate });
      toast.success("Evaluation submitted");
      const next = allCalls?.find((c) => c.eval.status === "pending" && c.call.id !== callData.id);
      if (next) navigate(`/eval/${next.call.id}`, { replace: true });
      else navigate("/calls", { replace: true });
    } catch {
      toast.error("Failed to submit evaluation");
    }
  };

  const isReadOnly  = !evalData.id;
  const durationStr = `${Math.floor(callData.duration / 60)}m ${callData.duration % 60}s`;
  const positiveTags = (callData.ai_positive_mentions ?? []).filter(Boolean);
  const detractorTags = (callData.ai_detractors ?? []).filter(Boolean);

  const textFields = [
    { key: "call_summary",     label: "Call Summary",    aiValue: callData.ai_call_summary,     type: "textarea" },
    { key: "overall_feedback", label: "Overall Feedback", aiValue: callData.ai_overall_feedback, type: "textarea" },
  ];

  const INCOMPLETE_REASONS = ["Voicemail", "Callback", "Call Screening"] as const;

  return (
    <div
      className="flex overflow-hidden -m-6"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >

      {/* ════════════════════════════════════════════════
          LEFT PANEL — 60% — call info + transcript
      ════════════════════════════════════════════════ */}
      <div
        className="flex flex-col overflow-hidden border-r"
        style={{ width: "60%", background: "#131313", borderColor: "rgba(73,72,71,0.15)" }}
      >
        {/* ── Sticky call header ── */}
        <div
          className="shrink-0 px-8 py-5 border-b"
          style={{ background: "#1c1c1e", borderColor: "rgba(73,72,71,0.15)" }}
        >
          {/* Call ID + date */}
          <div className="flex items-center gap-3 mb-3">
            <span
              className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
              style={{ background: "rgba(79,245,223,0.15)", color: "#4ff5df" }}
            >
              Call_ID #{callData.call_id}
            </span>
            <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>
              {new Date(callData.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>

          {/* Org + campaign headline */}
          <div className="flex items-start justify-between gap-4 mb-2">
            <h2 className="text-2xl font-extrabold tracking-tight leading-tight">
              <span style={{ color: "#ffffff" }}>{callData.organization_name || "Unknown Org"}</span>
              {callData.campaign && (
                <span style={{ color: "#4ff5df" }}> / {callData.campaign}</span>
              )}
            </h2>
            {callData.call_status && (
              <span
                className="shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mt-1"
                style={{
                  background: callData.call_status === "Completed"
                    ? "rgba(79,245,223,0.12)"
                    : "rgba(255,113,108,0.12)",
                  color: callData.call_status === "Completed" ? "#4ff5df" : "#ff716c",
                }}
              >
                {callData.call_status}
              </span>
            )}
          </div>

          {/* Sub-meta row */}
          <div className="flex items-center gap-4 mb-4">
            {callData.rooftop_name && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "#adaaaa" }}>
                <MapPin className="h-3 w-3" />{callData.rooftop_name}
              </span>
            )}
            {callData.customer_phone && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "#adaaaa" }}>
                <Phone className="h-3 w-3" />{callData.customer_phone}
              </span>
            )}
          </div>

          {/* Stat pills row */}
          <div className="flex items-center gap-3">
            <StatPill label="Duration"  value={durationStr} />
            <StatPill
              label="Direction"
              value={callData.direction?.toUpperCase() ?? "—"}
              teal
              icon={callData.direction === "outbound"
                ? <ArrowUpRight className="h-3 w-3" />
                : <ArrowDownLeft className="h-3 w-3" />}
            />
            {callData.ai_nps_score !== null && (
              <StatPill label="NPS Score" value={`${callData.ai_nps_score}/10`} highlight />
            )}
          </div>
        </div>

        {/* ── Sticky audio player ── */}
        {callData.recording_url && (
          <div
            className="shrink-0 px-8 py-3 border-b flex items-center gap-4"
            style={{ background: "#1c1c1e", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95"
              style={{ background: "linear-gradient(135deg, #4ff5df, #22dbc6)" }}
            >
              {isPlaying
                ? <Pause className="h-4 w-4" style={{ color: "#00443d" }} />
                : <Play className="h-4 w-4 ml-0.5" style={{ color: "#00443d" }} />
              }
            </button>

            <div className="flex-1 flex flex-col gap-1.5">
              <div
                className="w-full h-1 rounded-full overflow-hidden cursor-pointer"
                style={{ background: "rgba(255,255,255,0.06)" }}
                onClick={seekAudio}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${audioProgress}%`, background: "#4ff5df", boxShadow: "0 0 6px rgba(79,245,223,0.5)" }}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {formatTimestamp(currentTime)}
                </span>
                <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {formatTimestamp(audioDuration)}
                </span>
              </div>
            </div>

            <button
              onClick={cycleSpeed}
              className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all"
              style={{ background: "transparent", color: "#adaaaa", borderColor: "rgba(255,255,255,0.08)" }}
              onMouseEnter={(e) => { (e.currentTarget).style.color = "#4ff5df"; (e.currentTarget).style.borderColor = "rgba(79,245,223,0.3)"; }}
              onMouseLeave={(e) => { (e.currentTarget).style.color = "#adaaaa"; (e.currentTarget).style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              {SPEED_OPTIONS[speedIndex]}×
            </button>

            <audio
              ref={audioRef}
              preload="metadata"
              src={callData.recording_url}
              onPlay={() => { if (audioRef.current) audioRef.current.playbackRate = speedRef.current; }}
              onEnded={() => setIsPlaying(false)}
            />
          </div>
        )}

        {/* ── Scrollable content: summary + transcript ── */}
        <ScrollArea className="flex-1">
          <div className="px-8 py-6 space-y-6">

            {/* AI Summary */}
            {callData.ai_call_summary && (
              <div
                className="relative rounded-2xl p-5 border-l-4 overflow-hidden"
                style={{ background: "#1c1c1e", borderLeftColor: "#4ff5df" }}
              >
                {/* Aurora glow */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: "-20px", left: "-20px", right: "-20px", bottom: "-20px",
                    background: "radial-gradient(circle at 0% 50%, rgba(79,245,223,0.06) 0%, transparent 60%)",
                    filter: "blur(20px)",
                  }}
                />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="h-3.5 w-3.5" style={{ color: "#4ff5df" }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#4ff5df" }}>
                      AI Summary
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {callData.ai_call_summary}
                  </p>
                </div>
              </div>
            )}

            {/* Transcript */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#ffffff" }}>
                    Call Transcript
                  </h3>
                  <div className="h-px flex-1 w-8" style={{ background: "rgba(79,245,223,0.3)" }} />
                </div>
                <span
                  className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" }}
                >
                  Auto-Generated
                </span>
              </div>
              <div className="space-y-5">
                {callData.transcript
                  ? formatTranscript(callData.transcript)
                  : <p className="text-sm italic" style={{ color: "rgba(255,255,255,0.2)" }}>No transcript available</p>
                }
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* ════════════════════════════════════════════════
          RIGHT PANEL — 40% — eval fields
      ════════════════════════════════════════════════ */}
      <div
        className="flex flex-col"
        style={{ width: "40%", background: "#0a0a0a" }}
      >
        {/* ── Panel header ── */}
        <div
          className="shrink-0 px-5 py-3 border-b"
          style={{ background: "#0a0a0a", borderColor: "rgba(73,72,71,0.1)" }}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest mb-0" style={{ color: "#adaaaa" }}>
            Review Panel
          </p>
          <h2 className="text-sm font-extrabold uppercase tracking-tight" style={{ color: "#ffffff" }}>
            Quality Assurance
          </h2>
        </div>

        {/* ── Scrollable fields ── */}
        <ScrollArea className="flex-1">
          <div className="px-5 py-3 space-y-3">

            {/* NPS Score */}
            <EvalField
              label="NPS Score"
              aiValue={callData.ai_nps_score !== null ? `${callData.ai_nps_score}/10` : "N/A"}
              correct={fields.nps_score.correct}
              onToggle={(v) => setField("nps_score", { correct: v })}
              readOnly={isReadOnly}
              highlight
            >
              {!fields.nps_score.correct && (
                <input
                  type="number"
                  min={1} max={10}
                  value={String(fields.nps_score.value ?? "")}
                  onChange={(e) => setField("nps_score", { value: Number(e.target.value) })}
                  placeholder="Corrected NPS (1–10)"
                  className="w-full rounded-xl px-4 py-2.5 text-sm border transition-all focus:outline-none mt-2"
                  style={{ background: "#000000", color: "#ffffff", borderColor: "rgba(255,113,108,0.3)" }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(79,245,223,0.5)"; }}
                  onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,113,108,0.3)"; }}
                />
              )}
            </EvalField>

            {textFields.map((f) => (
              <EvalField
                key={f.key}
                label={f.label}
                aiValue={f.aiValue ?? "—"}
                correct={fields[f.key].correct}
                onToggle={(v) => setField(f.key, { correct: v })}
                readOnly={isReadOnly}
              >
                {!fields[f.key].correct && (
                  f.type === "textarea" ? (
                    <textarea
                      value={String(fields[f.key].value ?? "")}
                      onChange={(e) => setField(f.key, { value: e.target.value })}
                      placeholder={`Corrected ${f.label}…`}
                      rows={2}
                      className="w-full rounded-lg px-3 py-2 text-xs border transition-all focus:outline-none resize-none mt-1"
                      style={{ background: "#000000", color: "#ffffff", borderColor: "rgba(255,113,108,0.3)" }}
                      onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "rgba(79,245,223,0.5)"; }}
                      onBlur={(e)  => { (e.target as HTMLTextAreaElement).style.borderColor = "rgba(255,113,108,0.3)"; }}
                    />
                  ) : (
                    <input
                      value={String(fields[f.key].value ?? "")}
                      onChange={(e) => setField(f.key, { value: e.target.value })}
                      placeholder={`Corrected ${f.label}…`}
                      className="w-full rounded-xl px-4 py-2.5 text-sm border transition-all focus:outline-none mt-2"
                      style={{ background: "#000000", color: "#ffffff", borderColor: "rgba(255,113,108,0.3)" }}
                      onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(79,245,223,0.5)"; }}
                      onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,113,108,0.3)"; }}
                    />
                  )
                )}
              </EvalField>
            ))}

            {/* Positive Mentions — tag selector */}
            <EvalField
              label="Positive Mentions"
              aiValue={positiveTags.length > 0 ? positiveTags.join(", ") : "None detected"}
              correct={fields.positive_mentions.correct}
              onToggle={(v) => setField("positive_mentions", { correct: v })}
              readOnly={isReadOnly}
            >
              {!fields.positive_mentions.correct && (
                <TagSelector
                  selected={fields.positive_mentions.value as string[]}
                  onChange={(tags) => setField("positive_mentions", { value: tags })}
                  variant="positive"
                />
              )}
            </EvalField>

            {/* Detractors — tag selector */}
            <EvalField
              label="Detractors"
              aiValue={detractorTags.length > 0 ? detractorTags.join(", ") : "None detected"}
              correct={fields.detractors.correct}
              onToggle={(v) => setField("detractors", { correct: v })}
              readOnly={isReadOnly}
            >
              {!fields.detractors.correct && (
                <TagSelector
                  selected={fields.detractors.value as string[]}
                  onChange={(tags) => setField("detractors", { value: tags })}
                  variant="detractor"
                />
              )}
            </EvalField>

            {/* ── Not Incomplete ── */}
            <div
              className="rounded-lg border space-y-2 overflow-hidden"
              style={{ background: "#000000", borderColor: isNotIncomplete ? "rgba(73,72,71,0.1)" : "rgba(255,113,108,0.2)" }}
            >
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Not Incomplete
                </span>
                {!isReadOnly ? (
                  <button
                    onClick={() => { setIsNotIncomplete((v) => !v); setIncompleteReason(""); }}
                    className="relative inline-flex h-5 w-9 items-center rounded-full transition-all shrink-0"
                    style={{ background: isNotIncomplete ? "#4ff5df" : "rgba(255,113,108,0.6)" }}
                  >
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
                      style={{
                        transform: isNotIncomplete ? "translateX(20px)" : "translateX(2px)",
                        background: "#ffffff",
                      }}
                    />
                  </button>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isNotIncomplete ? "#4ff5df" : "#ff716c" }}>
                    {isNotIncomplete ? "Yes" : "No"}
                  </span>
                )}
              </div>

              {/* Reason picker — only when incomplete */}
              {!isNotIncomplete && !isReadOnly && (
                <div className="px-3 pb-2 space-y-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#adaaaa" }}>
                    Reason
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {INCOMPLETE_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setIncompleteReason(reason)}
                        className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95 border"
                        style={
                          incompleteReason === reason
                            ? { background: "rgba(255,113,108,0.2)", color: "#ff716c", borderColor: "transparent" }
                            : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", borderColor: "rgba(255,255,255,0.06)" }
                        }
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── DNC Request ── */}
            <SimpleBoolRow
              label="DNC Request"
              value={isDncRequest}
              onChange={setIsDncRequest}
              readOnly={isReadOnly}
            />

            {/* ── Escalation Needed ── */}
            <SimpleBoolRow
              label="Escalation Needed"
              value={escalationNeeded}
              onChange={setEscalationNeeded}
              readOnly={isReadOnly}
            />

          </div>
        </ScrollArea>

        {/* ── Submit footer ── */}
        <div
          className="shrink-0 px-5 py-3 border-t space-y-1.5"
          style={{ background: "#050505", borderColor: "rgba(73,72,71,0.1)" }}
        >
          <button
            className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, #4ff5df, #22dbc6)",
              color: "#00594f",
              boxShadow: "0 8px 32px rgba(79,245,223,0.2)",
            }}
            onClick={isReadOnly ? () => navigate(-1) : handleSubmit}
            disabled={submitEval.isPending}
          >
            {submitEval.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : isReadOnly
                ? <><ChevronRight className="h-4 w-4 rotate-180" /> Back</>
                : <><ChevronRight className="h-4 w-4" /> Complete Evaluation</>
            }
          </button>
          {!isReadOnly && (
            <button
              className="w-full py-2 text-[10px] font-bold uppercase tracking-widest transition-colors"
              style={{ color: "rgba(255,255,255,0.2)" }}
              onMouseEnter={(e) => { (e.currentTarget).style.color = "rgba(255,255,255,0.5)"; }}
              onMouseLeave={(e) => { (e.currentTarget).style.color = "rgba(255,255,255,0.2)"; }}
              onClick={() => navigate("/calls")}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Stat pill                                                           */
/* ──────────────────────────────────────────────────────────────────── */
function StatPill({
  label, value, teal, highlight, icon,
}: {
  label: string; value: string; teal?: boolean; highlight?: boolean; icon?: React.ReactNode;
}) {
  return (
    <div
      className="px-4 py-2 rounded-xl flex items-center gap-2 border"
      style={{
        background: highlight ? "rgba(79,245,223,0.06)" : "#131313",
        borderColor: highlight ? "rgba(79,245,223,0.2)" : "rgba(73,72,71,0.1)",
      }}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>
        {label}
      </span>
      <span
        className="text-sm font-bold flex items-center gap-1"
        style={{ color: teal || highlight ? "#4ff5df" : "#ffffff" }}
      >
        {icon}{value}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Eval field block                                                    */
/* ──────────────────────────────────────────────────────────────────── */
function EvalField({
  label, aiValue, correct, onToggle, children, readOnly, highlight,
}: {
  label: string; aiValue: string; correct: boolean;
  onToggle: (v: boolean) => void; children?: React.ReactNode;
  readOnly?: boolean; highlight?: boolean;
}) {
  return (
    <div className="space-y-1">
      {/* Label + toggles */}
      <div className="flex items-center justify-between">
        <label className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#adaaaa" }}>
          {label}
        </label>
        {!readOnly && (
          <div className="flex gap-1">
            <button
              onClick={() => onToggle(true)}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
              style={
                correct
                  ? { background: "#4ff5df", color: "#00443d" }
                  : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }
              }
              onMouseEnter={(e) => { if (!correct) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(79,245,223,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#4ff5df"; } }}
              onMouseLeave={(e) => { if (!correct) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)"; } }}
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={() => onToggle(false)}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
              style={
                !correct
                  ? { background: "rgba(255,113,108,0.8)", color: "#ffffff" }
                  : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }
              }
              onMouseEnter={(e) => { if (correct) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,113,108,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#ff716c"; } }}
              onMouseLeave={(e) => { if (correct) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)"; } }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* AI value display */}
      <div
        className="px-3 py-2 rounded-lg border transition-all"
        style={{
          background: "#000000",
          borderColor: !correct
            ? "rgba(255,113,108,0.2)"
            : highlight
              ? "rgba(79,245,223,0.15)"
              : "rgba(73,72,71,0.1)",
        }}
      >
        <p
          className="text-xs font-medium leading-snug line-clamp-2"
          style={{ color: highlight ? "#4ff5df" : "rgba(255,255,255,0.55)" }}
        >
          {aiValue}
        </p>
      </div>

      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Simple bool row — direct toggle, no AI value tracking             */
/* ──────────────────────────────────────────────────────────────────── */
function SimpleBoolRow({
  label, value, onChange, readOnly,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void; readOnly?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-lg border"
      style={{ background: "#000000", borderColor: value ? "rgba(255,113,108,0.2)" : "rgba(73,72,71,0.1)" }}
    >
      <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
        {label}
      </span>
      {!readOnly ? (
        <button
          onClick={() => onChange(!value)}
          className="relative inline-flex h-5 w-9 items-center rounded-full transition-all shrink-0"
          style={{ background: value ? "rgba(255,113,108,0.6)" : "rgba(255,255,255,0.08)" }}
        >
          <span
            className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
            style={{
              transform: value ? "translateX(20px)" : "translateX(2px)",
              background: value ? "#ffffff" : "rgba(255,255,255,0.4)",
            }}
          />
        </button>
      ) : (
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: value ? "#ff716c" : "rgba(255,255,255,0.25)" }}
        >
          {value ? "Yes" : "No"}
        </span>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Tag selector — clickable chip multi-select                         */
/* ──────────────────────────────────────────────────────────────────── */
function TagSelector({
  selected,
  onChange,
  variant,
}: {
  selected: string[];
  onChange: (tags: string[]) => void;
  variant: "positive" | "detractor";
}) {
  const toggle = (tag: string) => {
    if (selected.includes(tag)) onChange(selected.filter((t) => t !== tag));
    else onChange([...selected, tag]);
  };

  const activeStyle  = variant === "positive"
    ? { background: "#0b5345",              color: "#a1e1cf" }
    : { background: "rgba(255,113,108,0.2)", color: "#ff716c" };

  const inactiveStyle = { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)" };

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {EVAL_TAGS.map((tag) => {
        const isActive = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 border"
            style={
              isActive
                ? { ...activeStyle, borderColor: "transparent" }
                : { ...inactiveStyle, borderColor: "rgba(255,255,255,0.06)" }
            }
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Transcript formatter                                                */
/* ──────────────────────────────────────────────────────────────────── */
function formatTranscript(transcript: string): React.ReactNode {
  let elapsedSeconds = 0;
  return transcript.split("\n").filter(Boolean).map((line, i) => {
    const isAgent    = line.startsWith("assistant:");
    const isCustomer = line.startsWith("human:");
    const text = line.replace(/^(assistant|human):\s*/, "").trim();
    if (!text) return null;

    const timestamp = formatTimestamp(elapsedSeconds);
    elapsedSeconds += Math.max(2, Math.round(text.split(/\s+/).length / 2.5));

    if (isCustomer) {
      return (
        <div key={i} className="flex gap-3 max-w-[85%] ml-auto flex-row-reverse">
          <div
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: "linear-gradient(135deg, #4ff5df, #22dbc6)", color: "#00443d" }}
          >
            C
          </div>
          <div className="space-y-1 text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{timestamp}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#4ff5df" }}>Customer</span>
            </div>
            <div
              className="px-4 py-3 rounded-2xl rounded-tr-sm"
              style={{
                background: "linear-gradient(135deg, rgba(79,245,223,0.15), rgba(34,219,198,0.1))",
                border: "1px solid rgba(79,245,223,0.2)",
              }}
            >
              <p className="text-sm leading-relaxed text-left" style={{ color: "#ffffff" }}>{text}</p>
            </div>
          </div>
        </div>
      );
    }

    if (isAgent) {
      return (
        <div key={i} className="flex gap-3 max-w-[85%]">
          <div
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: "#1c1c1e", border: "1px solid rgba(79,245,223,0.15)" }}
          >
            <Bot className="h-3.5 w-3.5" style={{ color: "#4ff5df" }} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
                System Agent
              </span>
              <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{timestamp}</span>
            </div>
            <div
              className="px-4 py-3 rounded-2xl rounded-tl-sm"
              style={{ background: "#222121", border: "1px solid rgba(73,72,71,0.12)" }}
            >
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>{text}</p>
            </div>
          </div>
        </div>
      );
    }

    // Unrecognised line format — render as a plain system note rather than dropping it.
    return (
      <div key={i} className="px-4 py-2 text-xs" style={{ color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
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

/* ──────────────────────────────────────────────────────────────────── */
/*  Loading skeleton                                                    */
/* ──────────────────────────────────────────────────────────────────── */
function EvalSkeleton() {
  return (
    <div className="flex overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>
      <div className="flex flex-col gap-6 px-8 py-6" style={{ width: "60%" }}>
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" style={{ background: "rgba(255,255,255,0.05)" }} />
          <Skeleton className="h-8 w-80" style={{ background: "rgba(255,255,255,0.05)" }} />
          <div className="flex gap-3">
            {[1,2,3].map((i) => <Skeleton key={i} className="h-10 w-28 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }} />)}
          </div>
        </div>
        <Skeleton className="h-20 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.05)" }} />
        <Skeleton className="h-10 w-full rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="space-y-4">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.05)" }} />)}
        </div>
      </div>
      <div className="flex flex-col gap-4 px-7 py-6" style={{ width: "40%", background: "#0a0a0a" }}>
        <Skeleton className="h-5 w-28" style={{ background: "rgba(255,255,255,0.05)" }} />
        <Skeleton className="h-6 w-44" style={{ background: "rgba(255,255,255,0.05)" }} />
        {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }} />)}
      </div>
    </div>
  );
}
