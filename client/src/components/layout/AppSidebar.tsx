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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuthStore } from "@/store/auth-store";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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

const MAIN_NAV = [
  { title: "Dashboard",  url: "/dashboard", icon: LayoutDashboard },
  { title: "My Calls",   url: "/calls",     icon: PhoneCall       },
];

const ADMIN_NAV = [
  { title: "All Calls",       url: "/all-calls", icon: Database  },
  { title: "Admin Controls",  url: "/admin",     icon: Settings  },
  { title: "Team Overview",   url: "/team",      icon: Users     },
];

const SUPERADMIN_NAV = [
  { title: "User Management", url: "/users", icon: UserCog },
];

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  superadmin: { label: "Super Admin", icon: ShieldCheck, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  admin:      { label: "Admin",       icon: Shield,      color: "text-[#4ff5df] bg-[#4ff5df]/10 border-[#4ff5df]/20" },
  reviewer:   { label: "Reviewer",    icon: Sparkles,    color: "text-sky-400 bg-sky-500/10 border-sky-500/20"        },
};

export function AppSidebar() {
  const { state } = useSidebar();
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
          background: "#050505",
          borderColor: "rgba(255,255,255,0.05)",
        }}
      >
        {/* ── Brand header ─────────────────────────────────────────── */}
        <SidebarHeader className="p-6 pb-8 !items-start">
          {collapsed ? (
            <img src={lokamIcon} alt="Lokam" className="w-8 h-8 rounded-lg" />
          ) : (
            <img
              src={lokamLogo}
              alt="Lokam"
              className="h-7 w-auto object-left"
              style={{ maxWidth: "100%" }}
            />
          )}
        </SidebarHeader>

        {/* ── Navigation ───────────────────────────────────────────── */}
        <SidebarContent className="px-4 pt-0 flex-1">
          {/* Main nav */}
          <SidebarGroup className="p-0">
            {!collapsed && (
              <SidebarGroupLabel
                className="text-[9px] tracking-widest uppercase font-bold px-3 mb-2"
                style={{ color: "rgba(255,255,255,0.15)" }}
              >
                Navigation
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {MAIN_NAV.map((item) => (
                  <NavItem key={item.url} item={item} collapsed={collapsed} pathname={location.pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Admin nav */}
          {isAtLeast("admin") && (
            <SidebarGroup className="p-0 mt-6">
              {!collapsed && (
                <SidebarGroupLabel
                  className="text-[9px] tracking-widest uppercase font-bold px-3 mb-2"
                  style={{ color: "rgba(255,255,255,0.15)" }}
                >
                  Admin
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {ADMIN_NAV.map((item) => (
                    <NavItem key={item.url} item={item} collapsed={collapsed} pathname={location.pathname} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Superadmin nav */}
          {isAtLeast("superadmin") && (
            <SidebarGroup className="p-0 mt-6">
              {!collapsed && (
                <SidebarGroupLabel
                  className="text-[9px] tracking-widest uppercase font-bold px-3 mb-2"
                  style={{ color: "rgba(255,255,255,0.15)" }}
                >
                  System
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {SUPERADMIN_NAV.map((item) => (
                    <NavItem key={item.url} item={item} collapsed={collapsed} pathname={location.pathname} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <SidebarFooter className="p-4 pt-2">
          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-3 w-full rounded-xl p-2.5 transition-colors cursor-pointer text-left"
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <Avatar className="h-8 w-8 shrink-0" style={{ border: "1px solid rgba(79,245,223,0.3)" }}>
                  <AvatarFallback
                    className="text-xs font-black"
                    style={{ background: "rgba(79,245,223,0.1)", color: "#4ff5df" }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-semibold truncate"
                        style={{ color: "rgba(255,255,255,0.9)" }}
                      >
                        {user?.name}
                      </p>
                      <p
                        className="text-[10px] font-medium truncate"
                        style={{ color: "#4ff5df" }}
                      >
                        {user?.role === "superadmin" ? "Root Access" : user?.role === "admin" ? "Admin Access" : "Reviewer"}
                      </p>
                    </div>
                    <ChevronsUpDown className="h-4 w-4 shrink-0" style={{ color: "rgba(255,255,255,0.2)" }} />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex items-center gap-3 py-1">
                  <Avatar className="h-9 w-9" style={{ border: "1px solid rgba(79,245,223,0.3)" }}>
                    <AvatarFallback
                      className="text-xs font-black"
                      style={{ background: "rgba(79,245,223,0.1)", color: "#4ff5df" }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer" disabled>
                <RoleIcon className="h-4 w-4" />
                <span className="flex-1">{roleInfo.label}</span>
                <Badge variant="outline" className={`text-[10px] h-5 ${roleInfo.color}`}>
                  {user?.role}
                </Badge>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  NavItem — Stitch-style right-border active accent                  */
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
          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative"
          style={{
            color: isActive ? "#4ff5df" : "rgba(255,255,255,0.3)",
            background: isActive ? "#141414" : "transparent",
            borderRight: isActive ? "2px solid #4ff5df" : "2px solid transparent",
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.color = "rgba(255,255,255,0.85)";
              el.style.background = "#141414";
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.color = "rgba(255,255,255,0.3)";
              el.style.background = "transparent";
            }
          }}
        >
          <Icon
            className="h-[18px] w-[18px] shrink-0"
            style={{ color: isActive ? "#4ff5df" : "rgba(255,255,255,0.3)" }}
          />
          {!collapsed && (
            <span
              className="font-semibold tracking-wider uppercase text-[11px]"
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
