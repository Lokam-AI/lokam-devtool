import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import lokamLogo from "../../../assets/LOKAM_PRIMARY_WHITE_FULL_LOGO.svg";
import lokamIcon from "../../../assets/LOKAM_SECONDARY_LOGO_WHITE.svg";
import {
  LayoutDashboard,
  PhoneCall,
  Settings,
  Users,
  LogOut,
  ChevronsUpDown,
  Shield,
  ShieldCheck,
  Sparkles,
  Database,
  ChevronDown,
  Bug,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuthStore } from "@/store/auth-store";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/use-threads";
import type { Notification } from "@/types";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FF = '"cv01", "ss03"' as const;

const MAIN_NAV = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "My Calls",  url: "/calls",     icon: PhoneCall       },
  { title: "My Bugs",   url: "/my-bugs",   icon: Bug             },
];

const REVIEWER_NAV = [
  { title: "All Calls",   url: "/all-calls", icon: Database },
  { title: "Bug Reports", url: "/bugs",      icon: Bug      },
];

const ADMIN_NAV = [
  { title: "Admin Controls", url: "/admin", icon: Settings },
  { title: "Team Overview",  url: "/team",  icon: Users    },
];


const ROLE_CONFIG: Record<string, {
  label: string; icon: typeof Shield;
  color: string; bg: string; border: string;
}> = {
  superadmin: { label: "Super Admin", icon: ShieldCheck, color: "#f7f8f8",  bg: "rgba(255,255,255,0.07)",    border: "rgba(255,255,255,0.12)"   },
  admin:      { label: "Admin",       icon: Shield,      color: "#7170ff",  bg: "rgba(113,112,255,0.1)",    border: "rgba(113,112,255,0.2)"    },
  reviewer:   { label: "Reviewer",    icon: Sparkles,    color: "#10b981",  bg: "rgba(16,185,129,0.1)",     border: "rgba(16,185,129,0.2)"     },
};

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout, isAtLeast } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const [inboxOpen, setInboxOpen] = useState(false);
  const inboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inboxRef.current && !inboxRef.current.contains(e.target as Node)) {
        setInboxOpen(false);
      }
    };
    if (inboxOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [inboxOpen]);

  const handleNotificationClick = (n: Notification) => {
    if (!n.is_read) markRead.mutate(n.id);
    setInboxOpen(false);
    if (n.entity_type === "bug_report" && n.entity_id != null) navigate(`/bugs?open=${n.entity_id}`);
    else if (n.entity_type === "raw_call" && n.entity_id != null) navigate(`/call/${n.entity_id}`);
  };

  const roleInfo = ROLE_CONFIG[user?.role ?? "reviewer"] ?? ROLE_CONFIG.reviewer;
  const RoleIcon = roleInfo.icon;
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <TooltipProvider delayDuration={200}>
      <Sidebar
        collapsible="icon"
        className="border-r"
        style={{
          background: "#0f1011",
          borderColor: "rgba(255,255,255,0.05)",
        }}
      >
        {/* ── Brand header ─────────────────────────────────────────── */}
        <SidebarHeader className={`py-5 pb-3 !items-start ${collapsed ? "px-2" : "px-4"}`}>
          {collapsed ? (
            <button
              onClick={toggleSidebar}
              className="flex items-center justify-center w-full rounded-md py-1.5 transition-colors"
              style={{ color: "#62666d" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#d0d6e0";
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#62666d";
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <PanelLeftOpen className="h-[15px] w-[15px]" />
            </button>
          ) : (
            <div className="flex items-center justify-between w-full">
              <img
                src={lokamLogo}
                alt="Lokam"
                className="h-6 w-auto"
                style={{ maxWidth: "calc(100% - 28px)" }}
              />
              <button
                onClick={toggleSidebar}
                className="rounded-md p-1 shrink-0 transition-colors"
                style={{ color: "#3e3e44" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98";
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#3e3e44";
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <PanelLeftClose className="h-[15px] w-[15px]" />
              </button>
            </div>
          )}
        </SidebarHeader>

        {/* ── Navigation ───────────────────────────────────────────── */}
        <SidebarContent className="px-2 pt-1 flex-1">

          {/* Main nav — no section label */}
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu className="space-y-px">
                {MAIN_NAV.map((item) => (
                  <NavItem key={item.url} item={item} collapsed={collapsed} pathname={location.pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Reviewer + admin nav */}
          {isAtLeast("reviewer") && (
            <SidebarGroup className="p-0 mt-4">
              {!collapsed && (
                <SectionHeader label="Workspace" />
              )}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-px">
                  {REVIEWER_NAV.map((item) => (
                    <NavItem key={item.url} item={item} collapsed={collapsed} pathname={location.pathname} />
                  ))}
                  {isAtLeast("admin") && ADMIN_NAV.map((item) => (
                    <NavItem key={item.url} item={item} collapsed={collapsed} pathname={location.pathname} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

        </SidebarContent>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <SidebarFooter className="p-2 pb-3">

          {/* ── Inbox row ───────────────────────────────────────────── */}
          <div ref={inboxRef} style={{ position: "relative", marginBottom: 4 }}>
            <button
              onClick={() => setInboxOpen((v) => !v)}
              className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-1.5 transition-colors"
              style={{
                background: inboxOpen ? "rgba(113,112,255,0.08)" : "transparent",
                color: inboxOpen ? "#a8a4ff" : "#8a8f98",
              }}
              onMouseEnter={(e) => {
                if (!inboxOpen) {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#d0d6e0";
                }
              }}
              onMouseLeave={(e) => {
                if (!inboxOpen) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "#8a8f98";
                }
              }}
            >
              <div style={{ position: "relative", flexShrink: 0, display: "flex" }}>
                <Bell
                  className="h-[15px] w-[15px]"
                  style={{ color: inboxOpen ? "#a8a4ff" : unreadCount > 0 ? "#7170ff" : "#62666d" }}
                />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      minWidth: 13,
                      height: 13,
                      borderRadius: 7,
                      background: "#7170ff",
                      color: "#fff",
                      fontSize: "8px",
                      fontWeight: 700,
                      fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 2px",
                      lineHeight: 1,
                    }}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              {!collapsed && (
                <>
                  <span
                    className="flex-1 text-[13px] leading-[1.3] text-left"
                    style={{ fontFeatureSettings: FF, fontWeight: 400 }}
                  >
                    Inbox
                  </span>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace",
                        color: "#7170ff",
                        background: "rgba(113,112,255,0.12)",
                        border: "1px solid rgba(113,112,255,0.2)",
                        borderRadius: 5,
                        padding: "1px 5px",
                        lineHeight: 1.4,
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Inbox popover */}
            {inboxOpen && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 6px)",
                  left: collapsed ? "calc(100% + 8px)" : 0,
                  right: collapsed ? "auto" : 0,
                  width: collapsed ? 300 : "auto",
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
                    padding: "10px 12px 8px",
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
                <div style={{ maxHeight: 340, overflowY: "auto" }}>
                  {notifications.length === 0 && (
                    <p
                      style={{
                        padding: "18px 12px",
                        fontSize: "12px",
                        color: "#42464d",
                        fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace",
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
                        padding: "9px 12px",
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
                          <span style={{ color: "#7170ff" }}>
                            {n.entity_type === "bug_report" && n.entity_id != null
                              ? `Bug #${n.entity_id}`
                              : n.entity_type === "raw_call" && n.entity_id != null
                              ? `Call #${n.entity_id}`
                              : "a thread"}
                          </span>
                        </span>
                        {!n.is_read && (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#7170ff", flexShrink: 0 }} />
                        )}
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 transition-colors cursor-pointer text-left"
                style={{ background: "transparent" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <Avatar
                  className="h-6 w-6 shrink-0"
                  style={{ border: "1px solid rgba(113,112,255,0.25)" }}
                >
                  <AvatarFallback
                    className="text-[9px]"
                    style={{
                      fontWeight: 590,
                      background: "rgba(94,106,210,0.15)",
                      color: "#7170ff",
                      fontFeatureSettings: FF,
                    }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[13px] truncate leading-[1.3]"
                        style={{
                          color: "#d0d6e0",
                          fontWeight: 400,
                          fontFeatureSettings: FF,
                        }}
                      >
                        {user?.name}
                      </p>
                    </div>
                    <ChevronsUpDown
                      className="h-3 w-3 shrink-0"
                      style={{ color: "rgba(255,255,255,0.2)" }}
                    />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="w-60 p-1.5"
              style={{
                background: "#191a1b",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.2), 0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              {/* User identity */}
              <div className="flex items-center gap-2.5 px-2 py-2.5 mb-1">
                <Avatar
                  className="h-8 w-8 shrink-0"
                  style={{ border: "1px solid rgba(113,112,255,0.25)" }}
                >
                  <AvatarFallback
                    className="text-[11px]"
                    style={{
                      fontWeight: 590,
                      background: "rgba(94,106,210,0.15)",
                      color: "#7170ff",
                      fontFeatureSettings: FF,
                    }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] truncate leading-snug"
                    style={{ color: "#f7f8f8", fontWeight: 510, fontFeatureSettings: FF }}
                  >
                    {user?.name}
                  </p>
                  <p
                    className="text-[11px] truncate leading-snug mt-0.5"
                    style={{
                      color: "#62666d",
                      fontFeatureSettings: FF,
                      fontFamily: "Berkeley Mono, ui-monospace, SF Mono, Menlo, monospace",
                    }}
                  >
                    {user?.email}
                  </p>
                </div>
              </div>

              {/* Separator */}
              <div className="mx-2 mb-1.5 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

              {/* Role row */}
              <div
                className="flex items-center gap-2 px-2 py-1.5 rounded-md mb-0.5"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <RoleIcon
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: roleInfo.color }}
                />
                <span
                  className="flex-1 text-[13px]"
                  style={{ color: "#8a8f98", fontWeight: 400, fontFeatureSettings: FF }}
                >
                  {roleInfo.label}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    color: roleInfo.color,
                    background: roleInfo.bg,
                    border: `1px solid ${roleInfo.border}`,
                    fontWeight: 510,
                    fontFeatureSettings: FF,
                    letterSpacing: "0.02em",
                  }}
                >
                  {user?.role}
                </span>
              </div>

              {/* Separator */}
              <div className="mx-2 my-1.5 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />

              {/* Sign out */}
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors"
                style={{ color: "#62666d", fontWeight: 400, fontFeatureSettings: FF }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#ff716c";
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,113,108,0.06)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#62666d";
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
                onClick={() => { qc.clear(); logout(); }}
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span>Sign out</span>
              </button>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  SectionHeader — Linear-style collapsible section label             */
/* ──────────────────────────────────────────────────────────────────── */

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-1 px-2.5 pb-1 pt-0.5 cursor-default select-none"
    >
      <span
        className="text-[13px] leading-[1.3]"
        style={{ color: "#62666d", fontWeight: 400, fontFeatureSettings: FF }}
      >
        {label}
      </span>
      <ChevronDown
        className="h-3 w-3"
        style={{ color: "#62666d" }}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  NavItem                                                             */
/* ──────────────────────────────────────────────────────────────────── */

function NavItem({
  item,
  collapsed,
  pathname,
}: {
  item: { title: string; url: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> };
  collapsed: boolean;
  pathname: string;
}) {
  const isActive = pathname === item.url || pathname.startsWith(item.url + "/");
  const Icon = item.icon;

  const link = (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          end
          activeClassName=""
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-all duration-100"
          style={{
            color: isActive ? "#f7f8f8" : "#8a8f98",
            background: isActive ? "rgba(255,255,255,0.07)" : "transparent",
            fontFeatureSettings: FF,
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.color = "#d0d6e0";
              el.style.background = "rgba(255,255,255,0.05)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.color = "#8a8f98";
              el.style.background = "transparent";
            }
          }}
        >
          <Icon
            className="h-[15px] w-[15px] shrink-0"
            style={{ color: isActive ? "#f7f8f8" : "#62666d" }}
          />
          {!collapsed && (
            <span
              className="text-[13px] leading-[1.3]"
              style={{ fontWeight: 400 }}
            >
              {item.title}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={12}>
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
