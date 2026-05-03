import { useState, useRef, useEffect, useCallback } from "react";
import { Pencil, Trash2, Send, Paperclip, X, ImageIcon } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useThread, usePostMessage, useEditMessage, useDeleteMessage, useMentionableUsers } from "@/hooks/use-threads";
import { apiPresignUpload } from "@/lib/api";
import type { Message, Attachment } from "@/types";

const FF = '"cv01", "ss03"' as const;
const MONO = "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace";
const AVATAR_SIZE = 20;
const LEFT_COL = AVATAR_SIZE + 8; // avatar + gap

interface Props {
  entityType: "bug_report" | "raw_call" | "eval";
  entityId: number;
}

/* ── Message grouping ─────────────────────────────────────────── */
interface MessageGroup {
  senderId: number;
  senderName: string;
  isOwn: boolean;
  messages: Message[];
}

const GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function groupMessages(messages: Message[], currentUserId: number | null): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    const lastMsg = last?.messages[last.messages.length - 1];
    const withinWindow =
      lastMsg != null &&
      new Date(msg.created_at).getTime() - new Date(lastMsg.created_at).getTime() < GROUP_WINDOW_MS;
    if (last && last.senderId === msg.user_id && withinWindow) {
      last.messages.push(msg);
    } else {
      groups.push({
        senderId: msg.user_id,
        senderName: msg.user_name,
        isOwn: currentUserId != null && msg.user_id === currentUserId,
        messages: [msg],
      });
    }
  }
  return groups;
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
    (_e: React.KeyboardEvent<HTMLTextAreaElement>, value: string, cursor: number) => {
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

/* ── Highlight @mentions ──────────────────────────────────────── */
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
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  let label: string;
  if (diff < 60) label = "just now";
  else if (diff < 3600) label = `${Math.floor(diff / 60)}m`;
  else if (diff < 86400) label = `${Math.floor(diff / 3600)}h`;
  else label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <span title={d.toLocaleString()} style={{ fontFamily: MONO, fontSize: "10px", color: "#42464d" }}>
      {label}
    </span>
  );
}

/* ── Single message line (inside a group) ─────────────────────── */
interface MessageLineProps {
  msg: Message;
  isFirst: boolean;
  isOwn: boolean;
  senderName: string;
  onEdit: (msg: Message) => void;
  onDelete: (id: number) => void;
  editingId: number | null;
  entityType: string;
  entityId: number;
  onCancelEdit: () => void;
}

function MessageLine({
  msg,
  isFirst,
  isOwn,
  senderName,
  onEdit,
  onDelete,
  editingId,
  entityType,
  entityId,
  onCancelEdit,
}: MessageLineProps) {
  const [hovered, setHovered] = useState(false);
  const isDeleted = msg.deleted_at != null;
  const isEditing = editingId === msg.id;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ paddingTop: isFirst ? 0 : 1 }}
    >
      {isFirst && (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 5,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: isOwn ? "#a8a4ff" : "#8a8f98",
              fontFeatureSettings: FF,
              lineHeight: 1,
            }}
          >
            {senderName}
          </span>
          <RelativeTime iso={msg.created_at} />
          {msg.edited_at && !isDeleted && (
            <span style={{ fontFamily: MONO, fontSize: "9px", color: "#42464d" }}>edited</span>
          )}
        </div>
      )}

      {isEditing ? (
        <EditBox msg={msg} entityType={entityType} entityId={entityId} onCancel={onCancelEdit} />
      ) : (
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "flex-start",
            gap: 4,
          }}
        >
          {isDeleted ? (
            <p style={{ fontSize: "12px", color: "#42464d", fontStyle: "italic", flex: 1 }}>[deleted]</p>
          ) : (
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: "13px",
                  color: "#c8cdd6",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFeatureSettings: FF,
                  margin: 0,
                }}
              >
                <HighlightedBody body={msg.body ?? ""} />
              </p>
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
            </div>
          )}

          {/* Inline edit/delete — own messages on hover */}
          {isOwn && !isDeleted && (
            <div
              style={{
                display: "flex",
                gap: 1,
                opacity: hovered ? 1 : 0,
                transition: "opacity 0.1s",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => onEdit(msg)}
                title="Edit"
                style={iconBtnStyle}
                onMouseEnter={(e) => Object.assign((e.currentTarget as HTMLButtonElement).style, iconBtnHover)}
                onMouseLeave={(e) => Object.assign((e.currentTarget as HTMLButtonElement).style, iconBtnBase)}
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={() => onDelete(msg.id)}
                title="Delete"
                style={iconBtnStyle}
                onMouseEnter={(e) => Object.assign((e.currentTarget as HTMLButtonElement).style, iconBtnDeleteHover)}
                onMouseLeave={(e) => Object.assign((e.currentTarget as HTMLButtonElement).style, iconBtnBase)}
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const iconBtnBase = { color: "#42464d", background: "transparent" } as const;
const iconBtnHover = { color: "#d0d6e0", background: "rgba(255,255,255,0.06)" } as const;
const iconBtnDeleteHover = { color: "#f87171", background: "rgba(248,113,113,0.08)" } as const;
const iconBtnStyle: React.CSSProperties = {
  padding: "3px 4px",
  borderRadius: 4,
  color: "#42464d",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
};

/* ── Message group row ────────────────────────────────────────── */
interface GroupRowProps {
  group: MessageGroup;
  onEdit: (msg: Message) => void;
  onDelete: (id: number) => void;
  editingId: number | null;
  entityType: string;
  entityId: number;
  onCancelEdit: () => void;
}

function GroupRow({ group, onEdit, onDelete, editingId, entityType, entityId, onCancelEdit }: GroupRowProps) {
  return (
    <div style={{ display: "flex", gap: 8, paddingBottom: 8 }}>
      {/* Left column: avatar (only shown on first message row) */}
      <div style={{ width: AVATAR_SIZE, flexShrink: 0, paddingTop: 1 }}>
        <div
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: "50%",
            background: group.isOwn ? "rgba(113,112,255,0.12)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${group.isOwn ? "rgba(113,112,255,0.25)" : "rgba(255,255,255,0.08)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: MONO,
            fontSize: "9px",
            color: group.isOwn ? "#7170ff" : "#62666d",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {group.senderName.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Right column: messages */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {group.messages.map((msg, i) => (
          <MessageLine
            key={msg.id}
            msg={msg}
            isFirst={i === 0}
            isOwn={group.isOwn}
            senderName={group.senderName}
            onEdit={onEdit}
            onDelete={onDelete}
            editingId={editingId}
            entityType={entityType}
            entityId={entityId}
            onCancelEdit={onCancelEdit}
          />
        ))}
      </div>
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
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
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
      // silently ignore
    } finally {
      setUploadingFile(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const hasContent = value.trim().length > 0 || pendingAttachments.length > 0;

  return (
    <div style={{ position: "relative" }}>
      {/* Mention dropdown */}
      {mention.active && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: LEFT_COL,
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
                insertMention(
                  u.name,
                  value,
                  textareaRef.current?.selectionStart ?? value.length,
                  setValue,
                  textareaRef as React.RefObject<HTMLTextAreaElement>,
                )
              }
              style={{
                width: "100%",
                textAlign: "left",
                padding: "7px 12px",
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
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "rgba(113,112,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "9px",
                  color: "#7170ff",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {u.name.charAt(0).toUpperCase()}
              </span>
              <span style={{ color: "#7170ff", marginRight: 1 }}>@</span>
              {u.name}
            </button>
          ))}
        </div>
      )}

      {/* Pending image previews */}
      {pendingAttachments.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 6, paddingLeft: LEFT_COL, flexWrap: "wrap" }}>
          {pendingAttachments.map((att, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img
                src={att.url}
                alt={att.name}
                style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)" }}
              />
              <button
                onClick={() => setPendingAttachments((prev) => prev.filter((_, j) => j !== i))}
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#191a1b",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#8a8f98",
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

      {/* Input row — mimics message layout (avatar col + textarea) */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        {/* Placeholder avatar col */}
        <div style={{ width: AVATAR_SIZE, flexShrink: 0 }} />

        {/* Textarea wrapper */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: "#141516",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 8,
            padding: "7px 8px 7px 10px",
            display: "flex",
            alignItems: "flex-end",
            gap: 6,
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(113,112,255,0.3)"; }}
          onBlur={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)"; }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={(e) => onKeyUp(e, value, textareaRef.current?.selectionStart ?? value.length)}
            placeholder="Comment… (@ to mention)"
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
              lineHeight: 1.5,
              minHeight: 20,
              maxHeight: 100,
              overflowY: "auto",
            }}
            onInput={(e) => {
              const ta = e.currentTarget;
              ta.style.height = "auto";
              ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingFile}
              title="Attach image"
              style={{
                padding: "3px 5px",
                borderRadius: 5,
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
              {uploadingFile ? <ImageIcon size={13} /> : <Paperclip size={13} />}
            </button>
            <button
              onClick={handleSend}
              disabled={postMsg.isPending || !hasContent}
              style={{
                padding: "4px 7px",
                borderRadius: 5,
                background: hasContent ? "rgba(113,112,255,0.85)" : "rgba(113,112,255,0.15)",
                border: "none",
                color: hasContent ? "#f7f8f8" : "#4a4866",
                cursor: postMsg.isPending || !hasContent ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                transition: "background 0.12s, color 0.12s",
              }}
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>

      <p style={{ marginTop: 4, paddingLeft: LEFT_COL, fontSize: "10px", color: "#2e3138", fontFamily: MONO }}>
        ↵ send · ⇧↵ newline
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
    <div style={{ marginTop: 3, marginBottom: 4 }}>
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
          border: "1px solid rgba(113,112,255,0.3)",
          borderRadius: 7,
          padding: "7px 10px",
          color: "#d0d6e0",
          fontSize: "13px",
          fontFeatureSettings: FF,
          fontFamily: "Inter Variable, system-ui, sans-serif",
          lineHeight: 1.5,
          resize: "none",
          outline: "none",
          minHeight: 52,
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
        <button
          onClick={handleSave}
          disabled={editMsg.isPending || !value.trim()}
          style={{
            padding: "3px 10px",
            borderRadius: 5,
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
            padding: "3px 10px",
            borderRadius: 5,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#62666d",
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

  const currentUserId = currentUser ? Number(currentUser.id) : null;
  const groups = groupMessages(thread?.messages ?? [], currentUserId);
  const msgCount = thread?.messages.length ?? 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgCount]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#3a3f47",
            fontWeight: 600,
            fontFeatureSettings: FF,
          }}
        >
          Comments
        </span>
        {msgCount > 0 && (
          <span
            style={{
              fontFamily: MONO,
              fontSize: "10px",
              color: "#42464d",
            }}
          >
            {msgCount}
          </span>
        )}
      </div>

      {/* Message groups */}
      <div style={{ marginBottom: 4 }}>
        {isLoading && (
          <p style={{ fontSize: "12px", color: "#2e3138", fontFamily: MONO, paddingLeft: LEFT_COL }}>Loading…</p>
        )}
        {!isLoading && groups.length === 0 && (
          <p style={{ fontSize: "12px", color: "#2e3138", fontFamily: MONO, paddingLeft: LEFT_COL }}>
            No comments yet.
          </p>
        )}
        {groups.map((group, gi) => (
          <GroupRow
            key={`${group.senderId}-${gi}`}
            group={group}
            onEdit={(m) => setEditingId(m.id)}
            onDelete={(id) => deleteMsg.mutate(id)}
            editingId={editingId}
            entityType={entityType}
            entityId={entityId}
            onCancelEdit={() => setEditingId(null)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <ComposeBox entityType={entityType} entityId={entityId} users={allUsers} />
    </div>
  );
}
