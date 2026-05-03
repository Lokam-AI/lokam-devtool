import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil, Trash2, Send, Paperclip, X, ImageIcon } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useThread, usePostMessage, useEditMessage, useDeleteMessage, useMentionableUsers } from "@/hooks/use-threads";
import { apiPresignUpload } from "@/lib/api";
import type { Message, Attachment } from "@/types";

const FF = '"cv01", "ss03"' as const;
const MONO = "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace";

interface Props {
  entityType: "bug_report" | "raw_call" | "eval";
  entityId: number;
}

/* ── Mention autocomplete ─────────────────────────────────────── */
interface MentionState {
  active: boolean;
  query: string;
  startIndex: number;
}

function useMentionAutocomplete(users: { id: number | string; name: string }[]) {
  const [mention, setMention] = useState<MentionState>({ active: false, query: "", startIndex: -1 });

  const onKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, value: string, cursor: number) => {
      const slice = value.slice(0, cursor);
      const match = slice.match(/@(\S*)$/);
      if (match) {
        setMention({ active: true, query: match[1].toLowerCase(), startIndex: slice.lastIndexOf("@") });
      } else {
        setMention({ active: false, query: "", startIndex: -1 });
      }
    },
    [],
  );

  const suggestions = mention.active
    ? users.filter((u) => u.name.toLowerCase().startsWith(mention.query)).slice(0, 5)
    : [];

  const insertMention = useCallback(
    (
      name: string,
      value: string,
      cursor: number,
      setValue: (v: string) => void,
      ref: React.RefObject<HTMLTextAreaElement>,
    ) => {
      // Insert the first word of the name so the @(\S+) regex on the backend matches it
      const token = name.split(" ")[0];
      const before = value.slice(0, mention.startIndex);
      const after = value.slice(cursor);
      const newVal = `${before}@${token} ${after}`;
      setValue(newVal);
      setMention({ active: false, query: "", startIndex: -1 });
      setTimeout(() => {
        if (ref.current) {
          const pos = before.length + token.length + 2;
          ref.current.setSelectionRange(pos, pos);
          ref.current.focus();
        }
      }, 0);
    },
    [mention.startIndex],
  );

  const dismiss = () => setMention({ active: false, query: "", startIndex: -1 });

  return { mention, suggestions, onKeyUp, insertMention, dismiss };
}

/* ── Highlight @mentions in message body ─────────────────────── */
function HighlightedBody({ body }: { body: string }) {
  const parts = body.split(/(@\S+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} style={{ color: "#7170ff", fontWeight: 510 }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/* ── Relative timestamp ───────────────────────────────────────── */
function RelativeTime({ iso }: { iso: string }) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  let label: string;
  if (diff < 60) label = "just now";
  else if (diff < 3600) label = `${Math.floor(diff / 60)}m ago`;
  else if (diff < 86400) label = `${Math.floor(diff / 3600)}h ago`;
  else label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <span title={d.toLocaleString()} style={{ fontFamily: MONO, fontSize: "10px", color: "#42464d" }}>
      {label}
    </span>
  );
}

/* ── Single message row ───────────────────────────────────────── */
interface MessageRowProps {
  msg: Message;
  isOwn: boolean;
  onEdit: (msg: Message) => void;
  onDelete: (id: number) => void;
}

function MessageRow({ msg, isOwn, onEdit, onDelete }: MessageRowProps) {
  const [hovered, setHovered] = useState(false);
  const isDeleted = msg.deleted_at != null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "relative", padding: "6px 0", display: "flex", gap: "10px", alignItems: "flex-start" }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: isOwn ? "rgba(113,112,255,0.15)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${isOwn ? "rgba(113,112,255,0.3)" : "rgba(255,255,255,0.08)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          shrink: 0,
          flexShrink: 0,
          fontFamily: MONO,
          fontSize: "10px",
          color: isOwn ? "#7170ff" : "#62666d",
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {msg.user_name.charAt(0).toUpperCase()}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 510,
              color: isOwn ? "#a8a4ff" : "#8a8f98",
              fontFeatureSettings: FF,
            }}
          >
            {msg.user_name}
          </span>
          <RelativeTime iso={msg.created_at} />
          {msg.edited_at && !isDeleted && (
            <span style={{ fontFamily: MONO, fontSize: "9px", color: "#42464d" }}>edited</span>
          )}
        </div>

        {isDeleted ? (
          <p style={{ fontSize: "13px", color: "#42464d", fontStyle: "italic" }}>[deleted]</p>
        ) : (
          <>
            <p
              style={{
                fontSize: "13px",
                color: "#c8cdd6",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFeatureSettings: FF,
              }}
            >
              <HighlightedBody body={msg.body ?? ""} />
            </p>
            {/* Inline image attachments */}
            {msg.attachments && msg.attachments.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                {msg.attachments.map((att: Attachment, i: number) => (
                  <a key={i} href={att.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={att.url}
                      alt={att.name}
                      style={{
                        maxWidth: "100%",
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.07)",
                        display: "block",
                      }}
                    />
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit/Delete buttons — own messages only, on hover */}
      {isOwn && !isDeleted && hovered && (
        <div
          style={{
            display: "flex",
            gap: 2,
            position: "absolute",
            top: 4,
            right: 0,
            background: "#191a1b",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 6,
            padding: "2px 4px",
          }}
        >
          <button
            onClick={() => onEdit(msg)}
            title="Edit"
            style={{
              padding: "3px 5px",
              borderRadius: 4,
              color: "#62666d",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#d0d6e0"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#62666d"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={() => onDelete(msg.id)}
            title="Delete"
            style={{
              padding: "3px 5px",
              borderRadius: 4,
              color: "#62666d",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#62666d"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Compose box ──────────────────────────────────────────────── */
interface ComposeProps {
  entityType: string;
  entityId: number;
  users: { id: number | string; name: string; is_active: boolean }[];
}

function ComposeBox({ entityType, entityId, users }: ComposeProps) {
  const [value, setValue] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const postMsg = usePostMessage(entityType, entityId);
  const activeUsers = users.filter((u) => u.is_active);
  const { mention, suggestions, onKeyUp, insertMention, dismiss } = useMentionAutocomplete(activeUsers);

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed && pendingAttachments.length === 0) return;
    await postMsg.mutateAsync({ body: trimmed, attachments: pendingAttachments });
    setValue("");
    setPendingAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") { dismiss(); return; }
    if (mention.active && suggestions.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Tab") {
        e.preventDefault();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (mention.active && suggestions.length > 0) return;
      handleSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const { upload_url, key, public_url } = await apiPresignUpload(file.name, file.type);
      await fetch(upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setPendingAttachments((prev) => [
        ...prev,
        { url: public_url, key, name: file.name, mime_type: file.type, size_bytes: file.size },
      ]);
    } catch {
      // silently ignore upload errors for now
    } finally {
      setUploadingFile(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 12, position: "relative" }}>
      {/* Mention dropdown */}
      {mention.active && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            right: 0,
            background: "#141516",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            marginBottom: 4,
            zIndex: 10,
            overflow: "hidden",
          }}
        >
          {suggestions.map((u) => (
            <button
              key={u.id}
              onClick={() =>
                insertMention(u.name, value, textareaRef.current?.selectionStart ?? value.length, setValue, textareaRef as React.RefObject<HTMLTextAreaElement>)
              }
              style={{
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#d0d6e0",
                fontSize: "13px",
                fontFeatureSettings: FF,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(113,112,255,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "rgba(113,112,255,0.15)",
                  border: "1px solid rgba(113,112,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "9px",
                  color: "#7170ff",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {u.name.charAt(0).toUpperCase()}
              </span>
              <span style={{ color: "#7170ff" }}>@</span>
              {u.name}
            </button>
          ))}
        </div>
      )}

      {/* Pending image previews */}
      {pendingAttachments.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          {pendingAttachments.map((att, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img
                src={att.url}
                alt={att.name}
                style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)" }}
              />
              <button
                onClick={() => setPendingAttachments((prev) => prev.filter((_, j) => j !== i))}
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#191a1b",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#8a8f98",
                  fontSize: 9,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={8} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textarea row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          background: "#141516",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: "8px 10px",
        }}
        onFocus={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(113,112,255,0.35)"; }}
        onBlur={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => onKeyUp(e, value, textareaRef.current?.selectionStart ?? value.length)}
          placeholder="Add a comment… (@ to mention)"
          rows={1}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            color: "#d0d6e0",
            fontSize: "13px",
            fontFeatureSettings: FF,
            fontFamily: "Inter Variable, system-ui, sans-serif",
            lineHeight: 1.55,
            minHeight: 20,
            maxHeight: 120,
            overflowY: "auto",
          }}
          onInput={(e) => {
            const ta = e.currentTarget;
            ta.style.height = "auto";
            ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingFile}
            title="Attach image"
            style={{
              padding: "4px 6px",
              borderRadius: 6,
              background: "transparent",
              border: "none",
              color: uploadingFile ? "#7170ff" : "#42464d",
              cursor: uploadingFile ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => { if (!uploadingFile) (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98"; }}
            onMouseLeave={(e) => { if (!uploadingFile) (e.currentTarget as HTMLButtonElement).style.color = "#42464d"; }}
          >
            {uploadingFile ? <ImageIcon size={14} /> : <Paperclip size={14} />}
          </button>
          <button
            onClick={handleSend}
            disabled={postMsg.isPending || (!value.trim() && pendingAttachments.length === 0)}
            style={{
              padding: "5px 8px",
              borderRadius: 6,
              background: value.trim() || pendingAttachments.length > 0 ? "rgba(113,112,255,0.85)" : "rgba(113,112,255,0.18)",
              border: "none",
              color: value.trim() || pendingAttachments.length > 0 ? "#f7f8f8" : "#4a4866",
              cursor: postMsg.isPending || (!value.trim() && pendingAttachments.length === 0) ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            <Send size={13} />
          </button>
        </div>
      </div>
      <p style={{ marginTop: 5, fontSize: "10px", color: "#42464d", fontFamily: MONO }}>
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  );
}

/* ── Inline edit ──────────────────────────────────────────────── */
interface EditBoxProps {
  msg: Message;
  entityType: string;
  entityId: number;
  onCancel: () => void;
}

function EditBox({ msg, entityType, entityId, onCancel }: EditBoxProps) {
  const [value, setValue] = useState(msg.body ?? "");
  const editMsg = useEditMessage(entityType, entityId);

  const handleSave = async () => {
    if (!value.trim()) return;
    await editMsg.mutateAsync({ messageId: msg.id, body: value.trim() });
    onCancel();
  };

  return (
    <div style={{ marginTop: 4 }}>
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
          if (e.key === "Escape") onCancel();
        }}
        style={{
          width: "100%",
          background: "#141516",
          border: "1px solid rgba(113,112,255,0.35)",
          borderRadius: 8,
          padding: "8px 10px",
          color: "#d0d6e0",
          fontSize: "13px",
          fontFeatureSettings: FF,
          fontFamily: "Inter Variable, system-ui, sans-serif",
          lineHeight: 1.55,
          resize: "none",
          outline: "none",
          minHeight: 60,
        }}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button
          onClick={handleSave}
          disabled={editMsg.isPending || !value.trim()}
          style={{
            padding: "4px 12px",
            borderRadius: 6,
            background: "rgba(113,112,255,0.85)",
            border: "none",
            color: "#f7f8f8",
            fontSize: "12px",
            fontWeight: 510,
            fontFeatureSettings: FF,
            cursor: editMsg.isPending ? "wait" : "pointer",
          }}
        >
          {editMsg.isPending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "4px 12px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#8a8f98",
            fontSize: "12px",
            fontFeatureSettings: FF,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Main export ──────────────────────────────────────────────── */
export function CommentThread({ entityType, entityId }: Props) {
  const currentUser = useAuthStore((s) => s.user);
  const { data: thread, isLoading } = useThread(entityType, entityId);
  const { data: allUsers = [] } = useMentionableUsers();
  const deleteMsg = useDeleteMessage(entityType, entityId);
  const [editingId, setEditingId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#62666d",
            fontWeight: 510,
            fontFeatureSettings: FF,
          }}
        >
          Discussion
        </span>
        {thread && thread.messages.length > 0 && (
          <span
            style={{
              fontFamily: MONO,
              fontSize: "10px",
              color: "#42464d",
              background: "rgba(255,255,255,0.04)",
              borderRadius: 4,
              padding: "1px 5px",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {thread.messages.length}
          </span>
        )}
      </div>

      {/* Message list */}
      <div style={{ marginBottom: 12 }}>
        {isLoading && (
          <p style={{ fontSize: "12px", color: "#42464d", fontFamily: MONO }}>Loading…</p>
        )}
        {!isLoading && (!thread || thread.messages.length === 0) && (
          <p style={{ fontSize: "12px", color: "#42464d", fontFamily: MONO }}>
            No comments yet. Start the discussion.
          </p>
        )}
        {thread?.messages.map((msg) => (
          <div key={msg.id}>
            {editingId === msg.id ? (
              <EditBox
                msg={msg}
                entityType={entityType}
                entityId={entityId}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <MessageRow
                msg={msg}
                isOwn={currentUser != null && msg.user_id === Number(currentUser.id)}
                onEdit={(m) => setEditingId(m.id)}
                onDelete={(id) => deleteMsg.mutate(id)}
              />
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose box */}
      <ComposeBox entityType={entityType} entityId={entityId} users={allUsers} />
    </div>
  );
}
