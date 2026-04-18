import { useLocation } from "react-router-dom";
import lokamLogo from "../../../assets/LOKAM_PRIMARY_WHITE_FULL_LOGO.svg";
import lokamIcon from "../../../assets/LOKAM_SECONDARY_LOGO_WHITE.svg";
import {
  LayoutDashboard,
  PhoneCall,
  Settings,
  Users,
  UserCog,
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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuthStore } from "@/store/auth-store";
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

const ADMIN_NAV = [
  { title: "All Calls",      url: "/all-calls", icon: Database },
  { title: "Bug Reports",    url: "/bugs",      icon: Bug      },
  { title: "Admin Controls", url: "/admin",     icon: Settings },
  { title: "Team Overview",  url: "/team",      icon: Users    },
];

const SUPERADMIN_NAV = [
  { title: "User Management", url: "/users", icon: UserCog },
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

          {/* Admin nav */}
          {isAtLeast("admin") && (
            <SidebarGroup className="p-0 mt-4">
              {!collapsed && (
                <SectionHeader label="Workspace" />
              )}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-px">
                  {ADMIN_NAV.map((item) => (
                    <NavItem key={item.url} item={item} collapsed={collapsed} pathname={location.pathname} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Superadmin nav */}
          {isAtLeast("superadmin") && (
            <SidebarGroup className="p-0 mt-4">
              {!collapsed && (
                <SectionHeader label="System" />
              )}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-px">
                  {SUPERADMIN_NAV.map((item) => (
                    <NavItem key={item.url} item={item} collapsed={collapsed} pathname={location.pathname} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <SidebarFooter className="p-2 pb-3">
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
                onClick={logout}
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
