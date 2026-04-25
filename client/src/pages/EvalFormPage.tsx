import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useCall, useCalls, useSubmitEval, useCreateBug } from "@/hooks/use-calls";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Phone, MapPin,
  Bot, Play, Pause, Check, X, ChevronRight, Bug,
} from "lucide-react";
import { toast } from "sonner";
import type { RawCall, Eval } from "@/types";
import { parseUtc } from "@/lib/utils";

type FieldState = { correct: boolean; value: unknown };
const SPEED_OPTIONS = [1, 1.5, 2, 2.5, 3, 0.5] as const;
const FF = '"cv01", "ss03"' as const;

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
   Page shell
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
      <p
        className="text-xs uppercase tracking-widest"
        style={{ color: "#ff716c", fontWeight: 510, fontFeatureSettings: FF }}
      >
        Failed to load call. Please go back and try again.
      </p>
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center h-full">
      <p
        className="text-xs uppercase tracking-widest"
        style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
      >
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
   Inner — 60/40 split layout
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
  const location = useLocation();
  const saved = evalData.status === "completed";
  const [bugModalOpen, setBugModalOpen] = useState(false);

  const [fields, setFields] = useState<Record<string, FieldState>>(() => {
    const gtMatchesAi = (gt: unknown, ai: unknown) =>
      gt === undefined || JSON.stringify(gt) === JSON.stringify(ai);
    return {
      nps_score: {
        correct: !saved || gtMatchesAi(evalData.gt_nps_score, callData.ai_nps_score),
        value: saved ? evalData.gt_nps_score : callData.ai_nps_score,
      },
      call_summary: {
        correct: !saved || gtMatchesAi(evalData.gt_call_summary, callData.ai_call_summary),
        value: saved ? evalData.gt_call_summary : callData.ai_call_summary,
      },
      positive_mentions: {
        correct: !saved || gtMatchesAi(evalData.gt_positive_mentions, callData.ai_positive_mentions),
        value: saved ? (evalData.gt_positive_mentions ?? []) : (callData.ai_positive_mentions ?? []),
      },
      detractors: {
        correct: !saved || gtMatchesAi(evalData.gt_detractors, callData.ai_detractors),
        value: saved ? (evalData.gt_detractors ?? []) : (callData.ai_detractors ?? []),
      },
    };
  });

  const [isNotIncomplete, setIsNotIncomplete]   = useState<boolean>(
    saved && evalData.gt_is_resolved !== null ? (evalData.gt_is_resolved ?? true) : (callData.ai_is_resolved ?? true)
  );
  const [incompleteReason, setIncompleteReason] = useState<string>(
    saved ? (evalData.gt_incomplete_reason ?? "") : ""
  );
  const [isDncRequest, setIsDncRequest]         = useState<boolean>(
    saved ? (evalData.gt_is_dnc_request ?? false) : (callData.ai_is_dnc_request ?? false)
  );
  const [escalationNeeded, setEscalationNeeded] = useState<boolean>(
    saved ? (evalData.gt_escalation_needed ?? false) : (callData.ai_escalation_needed ?? false)
  );

  // Sync state when React Query delivers fresh data after a stale-cache mount.
  useEffect(() => {
    if (evalData.status !== "completed") return;
    const gtMatchesAi = (gt: unknown, ai: unknown) =>
      gt === undefined || JSON.stringify(gt) === JSON.stringify(ai);
    setFields({
      nps_score: {
        correct: gtMatchesAi(evalData.gt_nps_score, callData.ai_nps_score),
        value: evalData.gt_nps_score,
      },
      call_summary: {
        correct: gtMatchesAi(evalData.gt_call_summary, callData.ai_call_summary),
        value: evalData.gt_call_summary,
      },
      positive_mentions: {
        correct: gtMatchesAi(evalData.gt_positive_mentions, callData.ai_positive_mentions),
        value: evalData.gt_positive_mentions ?? [],
      },
      detractors: {
        correct: gtMatchesAi(evalData.gt_detractors, callData.ai_detractors),
        value: evalData.gt_detractors ?? [],
      },
    });
    setIsNotIncomplete(evalData.gt_is_resolved !== null ? (evalData.gt_is_resolved ?? true) : (callData.ai_is_resolved ?? true));
    setIncompleteReason(evalData.gt_incomplete_reason ?? "");
    setIsDncRequest(evalData.gt_is_dnc_request ?? false);
    setEscalationNeeded(evalData.gt_escalation_needed ?? false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalData.id, evalData.status]);

  const setField = useCallback((key: string, update: Partial<FieldState>) => {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...update } }));
  }, []);

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

  const handleSubmit = async () => {
    const corrections: Record<string, { ai_value: unknown; gt_value: unknown }> = {};
    const evalUpdate: Partial<Eval> = {};

    const GT_KEY_MAP: Record<string, keyof Eval> = {
      nps_score:         "gt_nps_score",
      call_summary:      "gt_call_summary",
      positive_mentions: "gt_positive_mentions",
      detractors:        "gt_detractors",
    };
    const AI_KEY_MAP: Record<string, keyof RawCall> = {
      nps_score:         "ai_nps_score",
      call_summary:      "ai_call_summary",
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

    evalUpdate.gt_overall_feedback   = callData.ai_overall_feedback;
    evalUpdate.gt_is_incomplete_call = !isNotIncomplete;
    evalUpdate.gt_incomplete_reason  = !isNotIncomplete ? incompleteReason || null : null;
    evalUpdate.gt_is_dnc_request     = isDncRequest;
    evalUpdate.gt_escalation_needed  = escalationNeeded;
    evalUpdate.corrections = corrections;

    try {
      await submitEval.mutateAsync({ evalId: evalData.id, data: evalUpdate });
      toast.success("Evaluation submitted");
      const next = allCalls?.find((c) => c.eval.status === "pending" && c.call.id !== callData.id);
      if (next) navigate(`/eval/${next.call.id}`, { replace: true, state: { editable: true } });
      else navigate("/calls", { replace: true });
    } catch {
      toast.error("Failed to submit evaluation");
    }
  };

  const isReadOnly    = !(location.state as { editable?: boolean } | null)?.editable;
  const durationStr   = `${Math.floor(callData.duration / 60)}m ${callData.duration % 60}s`;
  const positiveTags  = (callData.ai_positive_mentions ?? []).filter(Boolean);
  const detractorTags = (callData.ai_detractors ?? []).filter(Boolean);

  const textFields = [
    { key: "call_summary", label: "Call Summary", aiValue: callData.ai_call_summary, type: "textarea" },
  ];

  const INCOMPLETE_REASONS = ["Voicemail", "Callback", "Call Screening"] as const;

  return (
    <div
      className="flex overflow-hidden -m-6"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >

      {/* ════════════════════════════════════════════════
          LEFT PANEL — 60%
      ════════════════════════════════════════════════ */}
      <div
        className="flex flex-col overflow-hidden border-r"
        style={{ width: "60%", background: "#0f1011", borderColor: "rgba(255,255,255,0.05)" }}
      >
        {/* ── Sticky call header ── */}
        <div
          className="shrink-0 px-8 py-5 border-b"
          style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.05)" }}
        >
          {/* Call ID + date */}
          <div className="flex items-center gap-3 mb-3">
            <span
              className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest border"
              style={{
                background: "rgba(113,112,255,0.1)",
                color: "#7170ff",
                borderColor: "rgba(113,112,255,0.2)",
                fontWeight: 510,
                fontFeatureSettings: FF,
              }}
            >
              Call_ID #{callData.call_id}
            </span>
            <span
              className="text-xs"
              style={{ color: "#62666d", fontFeatureSettings: FF }}
            >
              {parseUtc(callData.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>

          {/* Org + campaign */}
          <div className="flex items-start justify-between gap-4 mb-2">
            <h2
              className="text-2xl leading-tight"
              style={{ fontWeight: 590, letterSpacing: "-0.288px", fontFeatureSettings: FF }}
            >
              <span style={{ color: "#f7f8f8" }}>{callData.organization_name || "Unknown Org"}</span>
              {callData.campaign && (
                <span style={{ color: "#7170ff" }}> / {callData.campaign}</span>
              )}
            </h2>
            {callData.call_status && (
              <span
                className="shrink-0 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest mt-1 border"
                style={{
                  background: callData.call_status === "Completed"
                    ? "rgba(16,185,129,0.12)"
                    : "rgba(255,113,108,0.12)",
                  color: callData.call_status === "Completed" ? "#10b981" : "#ff716c",
                  borderColor: callData.call_status === "Completed"
                    ? "rgba(16,185,129,0.2)"
                    : "rgba(255,113,108,0.2)",
                  fontWeight: 510,
                  fontFeatureSettings: FF,
                }}
              >
                {callData.call_status}
              </span>
            )}
          </div>

          {/* Sub-meta */}
          <div className="flex items-center gap-4 mb-4">
            {callData.rooftop_name && (
              <span
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "#8a8f98", fontFeatureSettings: FF }}
              >
                <MapPin className="h-3 w-3" />{callData.rooftop_name}
              </span>
            )}
            {callData.customer_phone && (
              <span
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "#8a8f98", fontFeatureSettings: FF }}
              >
                <Phone className="h-3 w-3" />{callData.customer_phone}
              </span>
            )}
          </div>

          {/* Stat pills */}
          <div className="flex items-center gap-2">
            <StatPill label="Duration"  value={durationStr} />
            {callData.ai_nps_score !== null && (
              <StatPill label="NPS Score" value={`${callData.ai_nps_score}/10`} highlight npsScore={callData.ai_nps_score} />
            )}
            {callData.ended_reason && (
              <StatPill label="Ended Reason" value={callData.ended_reason} />
            )}
            {callData.review_link_sent && (
              <div
                className="px-3 py-1.5 rounded-md flex items-center gap-2 border"
                style={{
                  background: "rgba(16,185,129,0.08)",
                  borderColor: "rgba(16,185,129,0.25)",
                }}
              >
                <span
                  className="material-symbols-outlined text-sm"
                  style={{ color: "#10b981", fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20", fontSize: "14px" }}
                >
                  star
                </span>
                <span
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: "#10b981", fontWeight: 510, fontFeatureSettings: FF }}
                >
                  Review Link Sent
                </span>
              </div>
            )}
            {callData.call_metadata?.email_escalated && (
              <div
                className="px-3 py-1.5 rounded-md flex items-center gap-2 border"
                style={{
                  background: "rgba(251,146,60,0.08)",
                  borderColor: "rgba(251,146,60,0.25)",
                }}
              >
                <span
                  className="material-symbols-outlined text-sm"
                  style={{ color: "#fb923c", fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20", fontSize: "14px" }}
                >
                  mail
                </span>
                <span
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: "#fb923c", fontWeight: 510, fontFeatureSettings: FF }}
                >
                  Email Sent
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Audio player ── */}
        {callData.recording_url && (
          <div
            className="shrink-0 px-8 py-3 border-b flex items-center gap-4"
            style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.05)" }}
          >
            <button
              onClick={togglePlay}
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95"
              style={{ background: "#5e6ad2" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#828fff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#5e6ad2"; }}
            >
              {isPlaying
                ? <Pause className="h-3.5 w-3.5" style={{ color: "#f7f8f8" }} />
                : <Play className="h-3.5 w-3.5 ml-0.5" style={{ color: "#f7f8f8" }} />
              }
            </button>

            <div className="flex-1 flex flex-col gap-1.5">
              <div
                className="w-full h-px rounded-full overflow-hidden cursor-pointer"
                style={{ background: "rgba(255,255,255,0.06)" }}
                onClick={seekAudio}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${audioProgress}%`, background: "#5e6ad2" }}
                />
              </div>
              <div className="flex justify-between">
                <span
                  className="text-[10px]"
                  style={{
                    color: "#62666d",
                    fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace",
                  }}
                >
                  {formatTimestamp(currentTime)}
                </span>
                <span
                  className="text-[10px]"
                  style={{
                    color: "#62666d",
                    fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace",
                  }}
                >
                  {formatTimestamp(audioDuration)}
                </span>
              </div>
            </div>

            <button
              onClick={cycleSpeed}
              className="px-2.5 py-1 rounded-md text-[10px] uppercase tracking-widest border transition-all"
              style={{
                background: "transparent",
                color: "#8a8f98",
                borderColor: "rgba(255,255,255,0.08)",
                fontWeight: 510,
                fontFeatureSettings: FF,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget).style.color = "#7170ff";
                (e.currentTarget).style.borderColor = "rgba(113,112,255,0.3)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget).style.color = "#8a8f98";
                (e.currentTarget).style.borderColor = "rgba(255,255,255,0.08)";
              }}
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

        {/* ── Scrollable: summary + transcript ── */}
        <ScrollArea className="flex-1">
          <div className="px-8 py-6 space-y-6">

            {/* AI Summary */}
            {callData.ai_call_summary && (
              <div
                className="relative rounded-lg p-4 overflow-hidden border"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "rgba(255,255,255,0.08)",
                  borderLeft: "2px solid #7170ff",
                }}
              >
                <div
                  className="absolute pointer-events-none inset-0"
                  style={{
                    background: "radial-gradient(circle at 0% 50%, rgba(94,106,210,0.05) 0%, transparent 60%)",
                  }}
                />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="h-3 w-3" style={{ color: "#7170ff" }} />
                    <span
                      className="text-[10px] uppercase tracking-widest"
                      style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }}
                    >
                      AI Summary
                    </span>
                  </div>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "#8a8f98", fontFeatureSettings: FF }}
                  >
                    {callData.ai_call_summary}
                  </p>
                </div>
              </div>
            )}

            {/* Transcript */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <h3
                    className="text-xs uppercase tracking-widest"
                    style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
                  >
                    Call Transcript
                  </h3>
                  <div className="h-px w-8" style={{ background: "rgba(255,255,255,0.06)" }} />
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest border"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    color: "#62666d",
                    borderColor: "rgba(255,255,255,0.06)",
                    fontWeight: 510,
                    fontFeatureSettings: FF,
                  }}
                >
                  Auto-Generated
                </span>
              </div>
              <div className="space-y-5">
                {callData.transcript
                  ? formatTranscript(callData.transcript)
                  : (
                    <p
                      className="text-xs italic"
                      style={{ color: "#62666d", fontFeatureSettings: FF }}
                    >
                      No transcript available
                    </p>
                  )
                }
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* ════════════════════════════════════════════════
          RIGHT PANEL — 40%
      ════════════════════════════════════════════════ */}
      <div
        className="flex flex-col"
        style={{ width: "40%", background: "#0f1011" }}
      >
        {/* ── Panel header ── */}
        <div
          className="shrink-0 px-5 py-3 border-b flex items-center justify-between"
          style={{ background: "#0f1011", borderColor: "rgba(255,255,255,0.05)" }}
        >
          <div>
            <p
              className="text-[9px] uppercase tracking-widest"
              style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
            >
              Review Panel
            </p>
            <h2
              className="text-sm uppercase"
              style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
            >
              Quality Assurance
            </h2>
          </div>
          <button
            onClick={() => setBugModalOpen(true)}
            title="Report a bug"
            className="w-7 h-7 rounded-md flex items-center justify-center border transition-all active:scale-95"
            style={{ background: "rgba(248,113,113,0.06)", borderColor: "rgba(248,113,113,0.2)", color: "#f87171" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.14)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.06)"; }}
          >
            <Bug className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── Scrollable fields ── */}
        <ScrollArea className="flex-1">
          <div className="px-5 py-3 space-y-2.5">

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
                  value={fields.nps_score.value == null ? "" : String(fields.nps_score.value)}
                  onChange={(e) => setField("nps_score", { value: e.target.value === "" ? null : Number(e.target.value) })}
                  placeholder="Corrected NPS (1–10), blank = N/A"
                  className="w-full rounded-md px-3 py-2 text-xs border transition-all focus:outline-none mt-2 placeholder:text-[#62666d]"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    color: "#d0d6e0",
                    borderColor: "rgba(255,113,108,0.25)",
                    fontFeatureSettings: FF,
                  }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(113,112,255,0.4)"; }}
                  onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,113,108,0.25)"; }}
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
                      className="w-full rounded-md px-3 py-2 text-xs border transition-all focus:outline-none resize-none mt-1 placeholder:text-[#62666d]"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        color: "#d0d6e0",
                        borderColor: "rgba(255,113,108,0.25)",
                        fontFeatureSettings: FF,
                      }}
                      onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "rgba(113,112,255,0.4)"; }}
                      onBlur={(e)  => { (e.target as HTMLTextAreaElement).style.borderColor = "rgba(255,113,108,0.25)"; }}
                    />
                  ) : (
                    <input
                      value={String(fields[f.key].value ?? "")}
                      onChange={(e) => setField(f.key, { value: e.target.value })}
                      placeholder={`Corrected ${f.label}…`}
                      className="w-full rounded-md px-3 py-2 text-xs border transition-all focus:outline-none mt-1 placeholder:text-[#62666d]"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        color: "#d0d6e0",
                        borderColor: "rgba(255,113,108,0.25)",
                        fontFeatureSettings: FF,
                      }}
                      onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(113,112,255,0.4)"; }}
                      onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = "rgba(255,113,108,0.25)"; }}
                    />
                  )
                )}
              </EvalField>
            ))}

            {/* Positive Mentions */}
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

            {/* Detractors */}
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

            {/* Not Incomplete toggle */}
            <div
              className="rounded-md border overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.02)",
                borderColor: isNotIncomplete ? "rgba(255,255,255,0.08)" : "rgba(255,113,108,0.2)",
              }}
            >
              <div className="flex items-center justify-between px-3 py-2">
                <span
                  className="text-[9px] uppercase tracking-widest"
                  style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
                >
                  Not Incomplete
                </span>
                {!isReadOnly ? (
                  <button
                    onClick={() => { setIsNotIncomplete((v) => !v); setIncompleteReason(""); }}
                    className="relative inline-flex h-5 w-9 items-center rounded-full transition-all shrink-0"
                    style={{ background: isNotIncomplete ? "#5e6ad2" : "rgba(255,113,108,0.5)" }}
                  >
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
                      style={{
                        transform: isNotIncomplete ? "translateX(20px)" : "translateX(2px)",
                        background: "#f7f8f8",
                      }}
                    />
                  </button>
                ) : (
                  <span
                    className="text-[10px] uppercase tracking-widest"
                    style={{
                      color: isNotIncomplete ? "#10b981" : "#ff716c",
                      fontWeight: 510,
                      fontFeatureSettings: FF,
                    }}
                  >
                    {isNotIncomplete ? "Yes" : "No"}
                  </span>
                )}
              </div>

              {!isNotIncomplete && !isReadOnly && (
                <div className="px-3 pb-2.5 space-y-2">
                  <p
                    className="text-[9px] uppercase tracking-widest"
                    style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
                  >
                    Reason
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {INCOMPLETE_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setIncompleteReason(reason)}
                        className="px-2.5 py-1 rounded-full text-[9px] uppercase tracking-wider transition-all active:scale-95 border"
                        style={
                          incompleteReason === reason
                            ? {
                                background: "rgba(255,113,108,0.12)",
                                color: "#ff716c",
                                borderColor: "rgba(255,113,108,0.2)",
                                fontWeight: 510,
                                fontFeatureSettings: FF,
                              }
                            : {
                                background: "rgba(255,255,255,0.02)",
                                color: "#62666d",
                                borderColor: "rgba(255,255,255,0.08)",
                                fontWeight: 510,
                                fontFeatureSettings: FF,
                              }
                        }
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* DNC Request */}
            <SimpleBoolRow
              label="DNC Request"
              value={isDncRequest}
              onChange={setIsDncRequest}
              readOnly={isReadOnly}
            />

            {/* Escalation Needed */}
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
          style={{ background: "#0f1011", borderColor: "rgba(255,255,255,0.05)" }}
        >
          <button
            className="w-full py-2.5 rounded-md text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "#5e6ad2",
              color: "#f7f8f8",
              fontWeight: 510,
              fontFeatureSettings: FF,
            }}
            onMouseEnter={(e) => {
              if (!submitEval.isPending) (e.currentTarget as HTMLButtonElement).style.background = "#828fff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#5e6ad2";
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
              className="w-full py-2 text-[10px] uppercase tracking-widest transition-colors"
              style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: FF }}
              onMouseEnter={(e) => { (e.currentTarget).style.color = "#8a8f98"; }}
              onMouseLeave={(e) => { (e.currentTarget).style.color = "#62666d"; }}
              onClick={() => navigate("/calls")}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {bugModalOpen && (
        <ReportBugModal
          callId={Number(callData.call_id)}
          organizationName={callData.organization_name}
          rooftopName={callData.rooftop_name}
          onClose={() => setBugModalOpen(false)}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  ReportBugModal                                                      */
/* ──────────────────────────────────────────────────────────────────── */
const BUG_TYPE_OPTIONS = [
  "Incorrect NPS Score",
  "Missing Transcript",
  "Audio Quality Issue",
  "Wrong Organization",
  "Incorrect Call Status",
  "Missing Recording",
  "Data Mismatch",
  "Duplicate Call",
  "Review Link",
  "Escalation Email",
  "Other",
] as const;

function ReportBugModal({
  callId, organizationName, rooftopName, onClose,
}: {
  callId: number;
  organizationName: string;
  rooftopName: string;
  onClose: () => void;
}) {
  const createBug = useCreateBug();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [description, setDescription]     = useState("");

  const toggleType = (t: string) =>
    setSelectedTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const handleSubmit = async () => {
    if (selectedTypes.length === 0) {
      toast.error("Select at least one bug type");
      return;
    }
    try {
      await createBug.mutateAsync({
        call_id: callId,
        organization_name: organizationName || null,
        rooftop_name: rooftopName || null,
        bug_types: selectedTypes,
        description: description.trim() || null,
      });
      toast.success("Bug reported");
      onClose();
    } catch {
      toast.error("Failed to report bug");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl border overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        style={{ background: "#191a1b", borderColor: "rgba(255,255,255,0.08)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(248,113,113,0.1)" }}
            >
              <Bug className="h-3.5 w-3.5" style={{ color: "#f87171" }} />
            </div>
            <div>
              <h3 className="text-sm" style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}>
                Report a Bug
              </h3>
              <p className="text-[10px] mt-0.5" style={{ color: "#62666d", fontFeatureSettings: FF }}>
                Call #{callId} · {organizationName || "Unknown Org"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
            style={{ color: "#62666d" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f7f8f8"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#62666d"; }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Bug types */}
          <div>
            <p
              className="text-[10px] uppercase tracking-widest mb-3"
              style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
            >
              Bug Type <span style={{ color: "#f87171" }}>*</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {BUG_TYPE_OPTIONS.map((t) => {
                const active = selectedTypes.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider border transition-all active:scale-95"
                    style={active
                      ? { background: "rgba(248,113,113,0.12)", color: "#f87171", borderColor: "rgba(248,113,113,0.25)", fontWeight: 510, fontFeatureSettings: FF }
                      : { background: "rgba(255,255,255,0.02)", color: "#62666d", borderColor: "rgba(255,255,255,0.08)", fontWeight: 400, fontFeatureSettings: FF }
                    }
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <p
              className="text-[10px] uppercase tracking-widest mb-2"
              style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: FF }}
            >
              Description
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue…"
              rows={3}
              className="w-full rounded-xl px-4 py-3 text-xs border focus:outline-none resize-none placeholder:text-[#3e3e44]"
              style={{ background: "rgba(255,255,255,0.02)", color: "#d0d6e0", borderColor: "rgba(255,255,255,0.08)", fontFeatureSettings: FF }}
              onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "rgba(248,113,113,0.3)"; }}
              onBlur={(e)  => { (e.target as HTMLTextAreaElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-end gap-3 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs border transition-all"
            style={{ background: "transparent", color: "#8a8f98", borderColor: "rgba(255,255,255,0.08)", fontWeight: 510, fontFeatureSettings: FF }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f7f8f8"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98"; }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createBug.isPending || selectedTypes.length === 0}
            className="px-5 py-2 rounded-lg text-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: "#f87171", color: "#0f1011", fontWeight: 510, fontFeatureSettings: FF }}
            onMouseEnter={(e) => { if (!createBug.isPending) (e.currentTarget as HTMLButtonElement).style.background = "#fca5a5"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f87171"; }}
          >
            {createBug.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bug className="h-3 w-3" />}
            {createBug.isPending ? "Submitting…" : "Submit Bug"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  StatPill                                                            */
/* ──────────────────────────────────────────────────────────────────── */
function npsColors(score: number): { bg: string; border: string; text: string } {
  if (score <= 6) return { bg: "rgba(255,113,108,0.08)", border: "rgba(255,113,108,0.2)",  text: "#ff716c" };
  if (score <= 8) return { bg: "rgba(113,112,255,0.06)", border: "rgba(113,112,255,0.2)",  text: "#7170ff" };
  return              { bg: "rgba(16,185,129,0.08)",   border: "rgba(16,185,129,0.2)",    text: "#10b981" };
}

function StatPill({
  label, value, accent, highlight, icon, npsScore,
}: {
  label: string; value: string; accent?: boolean; highlight?: boolean; icon?: React.ReactNode; npsScore?: number;
}) {
  const nps = highlight && npsScore !== undefined ? npsColors(npsScore) : null;
  return (
    <div
      className="px-3 py-1.5 rounded-md flex items-center gap-2 border"
      style={{
        background: nps ? nps.bg : highlight ? "rgba(113,112,255,0.06)" : accent ? "rgba(113,112,255,0.04)" : "rgba(255,255,255,0.02)",
        borderColor: nps ? nps.border : highlight ? "rgba(113,112,255,0.2)" : accent ? "rgba(113,112,255,0.12)" : "rgba(255,255,255,0.08)",
      }}
    >
      <span
        className="text-[10px] uppercase tracking-widest"
        style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: '"cv01", "ss03"' }}
      >
        {label}
      </span>
      <span
        className="text-xs flex items-center gap-1"
        style={{
          color: nps ? nps.text : accent || highlight ? "#7170ff" : "#f7f8f8",
          fontWeight: 510,
          fontFeatureSettings: '"cv01", "ss03"',
        }}
      >
        {icon}{value}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  EvalField                                                           */
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
      <div className="flex items-center justify-between">
        <label
          className="text-[9px] uppercase tracking-widest"
          style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: '"cv01", "ss03"' }}
        >
          {label}
        </label>
        {!readOnly && (
          <div className="flex gap-1">
            <button
              onClick={() => onToggle(true)}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
              style={
                correct
                  ? { background: "#10b981", color: "#f7f8f8" }
                  : { background: "rgba(255,255,255,0.05)", color: "#62666d" }
              }
              onMouseEnter={(e) => {
                if (!correct) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,185,129,0.15)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#10b981";
                }
              }}
              onMouseLeave={(e) => {
                if (!correct) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#62666d";
                }
              }}
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={() => onToggle(false)}
              className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
              style={
                !correct
                  ? { background: "rgba(255,113,108,0.7)", color: "#f7f8f8" }
                  : { background: "rgba(255,255,255,0.05)", color: "#62666d" }
              }
              onMouseEnter={(e) => {
                if (correct) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,113,108,0.15)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#ff716c";
                }
              }}
              onMouseLeave={(e) => {
                if (correct) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#62666d";
                }
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* AI value */}
      <div
        className="px-3 py-2 rounded-md border transition-all"
        style={{
          background: "rgba(255,255,255,0.02)",
          borderColor: !correct
            ? "rgba(255,113,108,0.2)"
            : highlight
              ? "rgba(113,112,255,0.15)"
              : "rgba(255,255,255,0.08)",
        }}
      >
        <p
          className="text-xs leading-snug line-clamp-2"
          style={{
            color: highlight ? "#7170ff" : "#8a8f98",
            fontFeatureSettings: '"cv01", "ss03"',
          }}
        >
          {aiValue}
        </p>
      </div>

      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  SimpleBoolRow                                                       */
/* ──────────────────────────────────────────────────────────────────── */
function SimpleBoolRow({
  label, value, onChange, readOnly,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void; readOnly?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-md border"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderColor: value ? "rgba(255,113,108,0.2)" : "rgba(255,255,255,0.08)",
      }}
    >
      <span
        className="text-[9px] uppercase tracking-widest"
        style={{ color: "#8a8f98", fontWeight: 510, fontFeatureSettings: '"cv01", "ss03"' }}
      >
        {label}
      </span>
      {!readOnly ? (
        <button
          onClick={() => onChange(!value)}
          className="relative inline-flex h-5 w-9 items-center rounded-full transition-all shrink-0"
          style={{ background: value ? "rgba(255,113,108,0.5)" : "rgba(255,255,255,0.08)" }}
        >
          <span
            className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
            style={{
              transform: value ? "translateX(20px)" : "translateX(2px)",
              background: value ? "#f7f8f8" : "rgba(255,255,255,0.3)",
            }}
          />
        </button>
      ) : (
        <span
          className="text-[10px] uppercase tracking-widest"
          style={{
            color: value ? "#ff716c" : "#62666d",
            fontWeight: 510,
            fontFeatureSettings: '"cv01", "ss03"',
          }}
        >
          {value ? "Yes" : "No"}
        </span>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  TagSelector                                                         */
/* ──────────────────────────────────────────────────────────────────── */
function TagSelector({
  selected, onChange, variant,
}: {
  selected: string[]; onChange: (tags: string[]) => void; variant: "positive" | "detractor";
}) {
  const toggle = (tag: string) => {
    if (selected.includes(tag)) onChange(selected.filter((t) => t !== tag));
    else onChange([...selected, tag]);
  };

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {EVAL_TAGS.map((tag) => {
        const isActive = selected.includes(tag);
        const activeStyle = variant === "positive"
          ? {
              background: "rgba(16,185,129,0.12)",
              color: "#10b981",
              borderColor: "rgba(16,185,129,0.2)",
              fontWeight: 510,
              fontFeatureSettings: '"cv01", "ss03"',
            }
          : {
              background: "rgba(255,113,108,0.12)",
              color: "#ff716c",
              borderColor: "rgba(255,113,108,0.2)",
              fontWeight: 510,
              fontFeatureSettings: '"cv01", "ss03"',
            };
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className="px-2.5 py-1 rounded-full text-[9px] uppercase tracking-wider transition-all active:scale-95 border"
            style={
              isActive
                ? activeStyle
                : {
                    background: "rgba(255,255,255,0.02)",
                    color: "#62666d",
                    borderColor: "rgba(255,255,255,0.08)",
                    fontWeight: 510,
                    fontFeatureSettings: '"cv01", "ss03"',
                  }
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
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px]"
            style={{ background: "#5e6ad2", color: "#f7f8f8", fontWeight: 590 }}
          >
            C
          </div>
          <div className="space-y-1 text-right">
            <div className="flex items-center gap-2 justify-end">
              <span
                className="text-[10px]"
                style={{
                  color: "#62666d",
                  fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace",
                }}
              >
                {timestamp}
              </span>
              <span
                className="text-[10px] uppercase tracking-widest"
                style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: '"cv01", "ss03"' }}
              >
                Customer
              </span>
            </div>
            <div
              className="px-4 py-3 rounded-2xl rounded-tr-sm"
              style={{
                background: "rgba(94,106,210,0.1)",
                border: "1px solid rgba(113,112,255,0.2)",
              }}
            >
              <p
                className="text-sm leading-relaxed text-left"
                style={{ color: "#d0d6e0", fontFeatureSettings: '"cv01", "ss03"' }}
              >
                {text}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (isAgent) {
      return (
        <div key={i} className="flex gap-3 max-w-[85%]">
          <div
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center border"
            style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" }}
          >
            <Bot className="h-3.5 w-3.5" style={{ color: "#62666d" }} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] uppercase tracking-widest"
                style={{ color: "#62666d", fontWeight: 510, fontFeatureSettings: '"cv01", "ss03"' }}
              >
                System Agent
              </span>
              <span
                className="text-[10px]"
                style={{
                  color: "#62666d",
                  fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace",
                }}
              >
                {timestamp}
              </span>
            </div>
            <div
              className="px-4 py-3 rounded-2xl rounded-tl-sm"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p
                className="text-sm leading-relaxed"
                style={{ color: "#8a8f98", fontFeatureSettings: '"cv01", "ss03"' }}
              >
                {text}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={i}
        className="px-4 py-2 text-xs italic"
        style={{ color: "#62666d", fontFeatureSettings: '"cv01", "ss03"' }}
      >
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
/*  EvalSkeleton                                                        */
/* ──────────────────────────────────────────────────────────────────── */
function EvalSkeleton() {
  return (
    <div className="flex overflow-hidden" style={{ height: "calc(100vh - 4rem)" }}>
      <div className="flex flex-col gap-6 px-8 py-6" style={{ width: "60%", background: "#0f1011" }}>
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" style={{ background: "rgba(255,255,255,0.05)" }} />
          <Skeleton className="h-8 w-80" style={{ background: "rgba(255,255,255,0.05)" }} />
          <div className="flex gap-3">
            {[1,2,3].map((i) => (
              <Skeleton key={i} className="h-9 w-28 rounded-md" style={{ background: "rgba(255,255,255,0.05)" }} />
            ))}
          </div>
        </div>
        <Skeleton className="h-16 w-full rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }} />
        <Skeleton className="h-8 w-full rounded-md" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="space-y-3">
          {[1,2,3,4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }} />
          ))}
        </div>
      </div>
      <div
        className="flex flex-col gap-4 px-5 py-4 border-l"
        style={{ width: "40%", background: "#0f1011", borderColor: "rgba(255,255,255,0.05)" }}
      >
        <Skeleton className="h-4 w-24" style={{ background: "rgba(255,255,255,0.05)" }} />
        <Skeleton className="h-5 w-40" style={{ background: "rgba(255,255,255,0.05)" }} />
        {[1,2,3,4,5].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" style={{ background: "rgba(255,255,255,0.05)" }} />
        ))}
      </div>
    </div>
  );
}
