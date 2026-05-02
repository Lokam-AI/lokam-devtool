import { MessageSquare } from "lucide-react";
import { parseUtc } from "@/lib/utils";
import type { RawCall } from "@/types";

const FF = '"cv01", "ss03"' as const;
const MONO = "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace" as const;

function fmtDatetime(iso: string): string {
  return parseUtc(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildOutboundBody(rooftopName: string | null | undefined): string {
  const company = rooftopName || "your service provider";
  return [
    `Hi [Customer], this is ${company}.`,
    `We noticed we haven't heard back about your recent service visit.`,
    `Was it Very Good, Good, Okay, Bad, or Very Bad?`,
    `Just one word helps us improve.`,
    `Reply STOP to opt out.`,
  ].join("\n");
}

// Strip leading [ISO_TIMESTAMP] prefix that lokamspace embeds in comments
function stripTimestampPrefix(s: string): string {
  return s.replace(/^\[\d{4}-\d{2}-\d{2}T[\d:.Z]+\]\s*/, "");
}

interface Props {
  callData: RawCall;
}

export function PostCallSmsPanel({ callData }: Props) {
  if (!callData.is_post_call_sms_survey) return null;

  const outboundBody = buildOutboundBody(callData.rooftop_name);

  const strippedComments = callData.post_call_sms_comments
    ? stripTimestampPrefix(callData.post_call_sms_comments)
    : null;
  const replyText = callData.post_call_sms_body || strippedComments;
  const followUpText =
    callData.post_call_sms_body && strippedComments && strippedComments !== callData.post_call_sms_body
      ? strippedComments
      : null;

  return (
    <div
      className="relative rounded-lg overflow-hidden border"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderColor: "rgba(255,255,255,0.08)",
        borderLeft: "2px solid #f59e0b",
      }}
    >
      <div
        className="absolute pointer-events-none inset-0"
        style={{
          background:
            "radial-gradient(circle at 0% 50%, rgba(245,158,11,0.04) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10">
        {/* Panel header */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 border-b"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          <MessageSquare className="h-3 w-3" style={{ color: "#f59e0b" }} />
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "#f59e0b", fontWeight: 510, fontFeatureSettings: FF }}
          >
            Post-call SMS Survey
          </span>
          {callData.post_call_sms_nps != null && (
            <span
              className="ml-auto text-[10px] uppercase tracking-widest"
              style={{ color: "#62666d", fontFeatureSettings: FF }}
            >
              NPS{" "}
              <span style={{ color: "#f7f8f8", fontWeight: 600 }}>
                {callData.post_call_sms_nps}
              </span>
            </span>
          )}
        </div>

        {/* Chat bubbles */}
        <div className="px-4 py-4 space-y-4">
          {/* Outbound — LEFT (like System Agent in transcript) */}
          <div className="flex gap-3 max-w-[85%]">
            <div
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center border"
              style={{
                background: "rgba(245,158,11,0.08)",
                borderColor: "rgba(245,158,11,0.25)",
              }}
            >
              <MessageSquare className="h-3.5 w-3.5" style={{ color: "#f59e0b" }} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: "#f59e0b", fontWeight: 510, fontFeatureSettings: FF }}
                >
                  Lokam
                </span>
                {callData.post_call_sms_sent_at && (
                  <span
                    className="text-[10px]"
                    style={{ color: "#62666d", fontFamily: MONO }}
                  >
                    {fmtDatetime(callData.post_call_sms_sent_at)}
                  </span>
                )}
              </div>
              <div
                className="px-4 py-3 rounded-2xl rounded-tl-sm"
                style={{
                  background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.15)",
                }}
              >
                <p
                  className="text-sm leading-relaxed whitespace-pre-line"
                  style={{ color: "#8a8f98", fontFeatureSettings: FF }}
                >
                  {outboundBody}
                </p>
              </div>
            </div>
          </div>

          {/* Customer reply — RIGHT (like Customer in transcript) */}
          {replyText && (
            <div className="flex gap-3 max-w-[85%] ml-auto flex-row-reverse">
              <div
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px]"
                style={{ background: "#5e6ad2", color: "#f7f8f8", fontWeight: 590 }}
              >
                C
              </div>
              <div className="space-y-1 text-right">
                <div className="flex items-center gap-2 justify-end">
                  {callData.post_call_sms_received_at && (
                    <span
                      className="text-[10px]"
                      style={{ color: "#62666d", fontFamily: MONO }}
                    >
                      {fmtDatetime(callData.post_call_sms_received_at)}
                    </span>
                  )}
                  <span
                    className="text-[10px] uppercase tracking-widest"
                    style={{ color: "#7170ff", fontWeight: 510, fontFeatureSettings: FF }}
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
                    style={{ color: "#d0d6e0", fontFeatureSettings: FF }}
                  >
                    {replyText}
                  </p>
                </div>
                {/* Follow-up messages (comments thread) */}
                {followUpText && (
                  <div
                    className="px-4 py-2 rounded-xl mt-1 text-left"
                    style={{
                      background: "rgba(94,106,210,0.06)",
                      border: "1px solid rgba(113,112,255,0.12)",
                    }}
                  >
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "#8a8f98", fontFeatureSettings: FF }}
                    >
                      {followUpText}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
