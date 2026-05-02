import { MessageSquare } from "lucide-react";
import { parseUtc } from "@/lib/utils";
import type { RawCall } from "@/types";

const FF = '"cv01", "ss03"' as const;


function fmtDatetime(iso: string): string {
  return parseUtc(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  return (
    <div
      className="relative rounded-lg p-4 overflow-hidden border"
      style={{
        background: "rgba(255,255,255,0.02)",
        borderColor: "rgba(255,255,255,0.08)",
        borderLeft: "2px solid #f59e0b",
      }}
    >
      <div
        className="absolute pointer-events-none inset-0"
        style={{
          background: "radial-gradient(circle at 0% 50%, rgba(245,158,11,0.04) 0%, transparent 60%)",
        }}
      />
      <div className="relative z-10">

        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-3 w-3" style={{ color: "#f59e0b" }} />
          <span
            className="text-[10px] uppercase tracking-widest"
            style={{ color: "#f59e0b", fontWeight: 510, fontFeatureSettings: FF }}
          >
            Post-call SMS Survey
          </span>
        </div>

        {/* NPS */}
        {callData.post_call_sms_nps != null && (
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{ color: "#62666d", fontFeatureSettings: FF }}
            >
              NPS
            </span>
            <span
              className="text-xs font-semibold"
              style={{ color: "#f7f8f8", fontFeatureSettings: FF }}
            >
              {callData.post_call_sms_nps}
            </span>
          </div>
        )}

        {/* SMS body */}
        {callData.post_call_sms_body && (
          <p
            className="text-xs leading-relaxed mb-2"
            style={{ color: "#8a8f98", fontFeatureSettings: FF }}
          >
            {callData.post_call_sms_body}
          </p>
        )}

        {/* Comments — only if different from body after stripping timestamp prefix */}
        {callData.post_call_sms_comments && (() => {
          const cleaned = stripTimestampPrefix(callData.post_call_sms_comments!);
          return cleaned !== callData.post_call_sms_body ? (
            <p
              className="text-xs leading-relaxed mb-2 pl-3 border-l"
              style={{ color: "#62666d", borderColor: "rgba(255,255,255,0.06)", fontFeatureSettings: FF }}
            >
              {cleaned}
            </p>
          ) : null;
        })()}

        {/* Timestamps */}
        {(callData.post_call_sms_sent_at || callData.post_call_sms_received_at) && (
          <div className="flex gap-4 mt-2">
            {callData.post_call_sms_sent_at && (
              <span className="text-[10px]" style={{ color: "#4a4f58", fontFeatureSettings: FF }}>
                Sent {fmtDatetime(callData.post_call_sms_sent_at)}
              </span>
            )}
            {callData.post_call_sms_received_at && (
              <span className="text-[10px]" style={{ color: "#4a4f58", fontFeatureSettings: FF }}>
                Reply {fmtDatetime(callData.post_call_sms_received_at)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
