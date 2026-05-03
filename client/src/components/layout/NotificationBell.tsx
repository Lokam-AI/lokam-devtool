import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/use-threads";
import type { Notification } from "@/types";

const FF = '"cv01", "ss03"' as const;
const MONO = "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace";

function entityNavPath(n: Notification): string {
  if (n.entity_type === "bug_report" && n.entity_id != null) {
    return `/bugs?open=${n.entity_id}`;
  }
  if (n.entity_type === "raw_call" && n.entity_id != null) {
    return `/call/${n.entity_id}`;
  }
  return "/";
}

function entityLabel(n: Notification): string {
  if (n.entity_type === "bug_report" && n.entity_id != null) return `Bug #${n.entity_id}`;
  if (n.entity_type === "raw_call" && n.entity_id != null) return `Call #${n.entity_id}`;
  return "a thread";
}

function RelativeTime({ iso }: { iso: string }) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
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

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) markRead.mutate(n.id);
    setOpen(false);
    navigate(entityNavPath(n));
  };

  return (
    <div ref={popoverRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative",
          padding: "6px",
          borderRadius: 8,
          background: open ? "rgba(113,112,255,0.08)" : "transparent",
          border: "none",
          color: unreadCount > 0 ? "#7170ff" : "#62666d",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          transition: "background 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
          (e.currentTarget as HTMLButtonElement).style.color = "#d0d6e0";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = open ? "rgba(113,112,255,0.08)" : "transparent";
          (e.currentTarget as HTMLButtonElement).style.color = unreadCount > 0 ? "#7170ff" : "#62666d";
        }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              minWidth: 14,
              height: 14,
              borderRadius: 7,
              background: "#7170ff",
              color: "#fff",
              fontSize: "9px",
              fontWeight: 700,
              fontFamily: MONO,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 320,
            background: "#141516",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          {/* Popover header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px 10px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
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
              Inbox
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                style={{
                  fontSize: "11px",
                  color: "#7170ff",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFeatureSettings: FF,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {notifications.length === 0 && (
              <p
                style={{
                  padding: "20px 14px",
                  fontSize: "12px",
                  color: "#42464d",
                  fontFamily: MONO,
                  textAlign: "center",
                }}
              >
                No notifications
              </p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 14px",
                  background: n.is_read ? "transparent" : "rgba(113,112,255,0.05)",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = n.is_read ? "transparent" : "rgba(113,112,255,0.05)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: "12px", color: "#8a8f98", fontFeatureSettings: FF }}>
                    Mentioned in{" "}
                    <span style={{ color: "#7170ff" }}>{entityLabel(n)}</span>
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <RelativeTime iso={n.created_at} />
                    {!n.is_read && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#7170ff",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                </div>
                {n.excerpt && (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#62666d",
                      fontFeatureSettings: FF,
                      lineHeight: 1.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {n.excerpt}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
