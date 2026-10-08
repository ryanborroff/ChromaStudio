// =============================================================================
// NAV STRUCTURE — flat top nav + contextual sidebar
//
//  Top Nav: Watch | Live | Studio | Community | Pricing  (flat links, no dropdowns)
//  Sidebar: Contextual per active section
//    Watch     → Feed + Discover genre links
//    Live      → Streaming, Cinema Events, Replays
//    Studio    → Portfolio Collections, Media Library, Client Delivery,
//               Website Embedding, Analytics
//    Community → (no sidebar — content full-width)
//    Pricing   → (no sidebar — content full-width)
//
//  Mobile: drawer shows all top-level links + sub-items for active section only
// =============================================================================

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, logout } from "@/lib/useAuth";
import {
  Film, LogOut, Settings, User as UserIcon,
  Clapperboard, Sparkles, Rss, Menu, Search, Bookmark,
  Radio, History, FolderOpen, Cloud, Send, Code2, BarChart3, TrendingUp,
  ShieldCheck, KeyRound, ChevronDown, Upload, type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ---------------------------------------------------------------------------
// Types & data
// ---------------------------------------------------------------------------

type NavItem = { href: string; label: string; icon: LucideIcon };
type Section = "watch" | "live" | "studio" | "community" | "pricing";

const GENRE_TAGS = ["Documentary", "Narrative", "Experimental", "Commercial", "Music Video"];

const FOLLOWING = [
  { name: "Mia Chen", username: "miachen", avatarUrl: null as string | null },
  { name: "Théo Laurent", username: "theolaurent", avatarUrl: null as string | null },
  { name: "Aisha Kone", username: "aishakone", avatarUrl: null as string | null },
  { name: "Rowan Blake", username: "rowanblake", avatarUrl: null as string | null },
];

/** Sidebar content per section. `null` = no sidebar (full-width layout). */
const SIDEBAR_CONTENT: Record<Section, { label: string; items: NavItem[]; discover?: true } | null> = {
  watch: {
    label: "Watch",
    items: [
      { href: "/feed",         label: "Feed",     icon: Rss },
      { href: "/explore",      label: "Trending", icon: TrendingUp },
      { href: "/saved",        label: "Saved",    icon: Bookmark },
      { href: "/history",      label: "History",  icon: History },
    ],
    discover: true,
  },
  live: {
    label: "Live",
    items: [
      { href: "/live",         label: "Streaming",     icon: Radio },
      { href: "/cinema",       label: "Cinema Events", icon: Clapperboard },
      { href: "/live/replays", label: "Replays",       icon: History },
    ],
  },
  studio: {
    label: "Studio",
    items: [
      { href: "/studio/portfolio", label: "Portfolio Collections", icon: FolderOpen },
      { href: "/studio/storage",   label: "Media Library",        icon: Cloud },
      { href: "/studio/delivery",  label: "Client Delivery",      icon: Send },
      { href: "/studio/embeds",    label: "Website Embedding",    icon: Code2 },
      { href: "/studio/analytics", label: "Analytics",            icon: BarChart3 },
    ],
  },
  community: null,
  pricing:   null,
};

/** Flat top-nav entries — no dropdowns. */
const TOP_NAV: { label: string; href: string; section: Section; testid: string; signedInOnly?: true }[] = [
  { label: "Watch",     href: "/feed",             section: "watch",     testid: "link-watch" },
  { label: "Live",      href: "/live",             section: "live",      testid: "link-live" },
  { label: "Studio",    href: "/studio/portfolio", section: "studio",    testid: "link-studio", signedInOnly: true },
  { label: "Community", href: "/community",        section: "community", testid: "link-community" },
  { label: "Pricing",   href: "/pricing",          section: "pricing",   testid: "link-pricing" },
];

/** Workspace actions use existing application routes only. */
const ACTION_MENUS = [
  { label: "Create", items: [
    { label: "Upload video", description: "Add a film to Chroma", href: "/videos/upload", icon: Upload },
    { label: "Portfolio", description: "Open your creator workspace", href: "/studio/portfolio", icon: FolderOpen },
  ] },
  { label: "Projects", items: [
    { label: "Portfolio collections", description: "Organise your work", href: "/studio/portfolio", icon: FolderOpen },
    { label: "Client delivery", description: "Manage shared deliveries", href: "/studio/delivery", icon: Send },
  ] },
  { label: "Media", items: [
    { label: "Media library", description: "Browse your uploaded files", href: "/studio/storage", icon: Cloud },
    { label: "Upload media", description: "Add new files", href: "/videos/upload", icon: Upload },
  ] },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSection(location: string): Section | null {
  if (location.startsWith("/feed") || location.startsWith("/explore")) return "watch";
  if (location.startsWith("/live") || location.startsWith("/cinema"))  return "live";
  if (location.startsWith("/studio"))                                   return "studio";
  if (location.startsWith("/community"))                                return "community";
  if (location.startsWith("/pricing"))                                  return "pricing";
  return null;
}

function SidebarLink({ item, location }: { item: NavItem; location: string }) {
  const Icon = item.icon;
  const active = location.startsWith(item.href);
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 px-[10px] py-2 rounded-lg text-[13px] font-medium transition-all mb-0.5 ${
        active ? "bg-[#1c1c1a] text-white" : "text-[#b5b5b0] hover:text-[#e0e0dc] hover:bg-white/5"
      }`}
      data-testid={`sidebar-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Icon className={`w-[17px] h-[17px] flex-shrink-0 ${active ? "text-primary" : "text-[#9a9a94]"}`} />
      {item.label}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isSignedIn } = useAuth();

  const isHome = location === "/";
  const section = getSection(location);
  const sidebarContent = section ? SIDEBAR_CONTENT[section] : null;
  const showSidebar = sidebarContent !== null;

  return (
    <div
      className="min-h-[100dvh] bg-background text-foreground flex flex-col dark"
      style={{ fontFamily: "var(--app-font-sans)" }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* macOS-style menu bar                                                */}
      {/* ------------------------------------------------------------------ */}
      <header
        className="sticky top-0 z-50 w-full h-12 flex items-center px-2 sm:px-4 justify-between"
        style={{
          background: "rgba(14,14,14,0.88)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Left — mobile trigger + logo + flat nav */}
        <div className="flex items-center gap-3 sm:gap-5">

          {/* ── Mobile drawer ────────────────────────────────────────────── */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="md:hidden flex items-center justify-center w-8 h-8 -ml-1 rounded-md text-white/70 hover:text-white hover:bg-white/5 transition-all"
                aria-label="Open menu"
                data-testid="btn-mobile-menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 border-r border-white/10 p-0"
              style={{ background: "rgba(13,13,13,0.97)", backdropFilter: "blur(20px)" }}
            >
              <SheetHeader className="px-4 h-12 flex flex-row items-center justify-start border-b border-white/10 space-y-0">
                <SheetTitle className="flex items-center gap-2 text-white">
                  <span className="font-black text-2xl tracking-tight">Chroma</span>
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col py-3 px-2 overflow-y-auto h-[calc(100dvh-3rem)]">

                {/* Top-level section links */}
                <p className="px-3 mb-1 text-[10px] font-semibold text-white/25 uppercase tracking-widest">Browse</p>
                {TOP_NAV.map(({ label, href, section: s, testid, signedInOnly }) => {
                  if (signedInOnly && !isSignedIn) return null;
                  const active = section === s;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                        active ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"
                      }`}
                      data-testid={`mobile-${testid}`}
                    >
                      {label}
                    </Link>
                  );
                })}

                {/* Contextual sub-items for active section */}
                {sidebarContent && (
                  <div className="mt-5">
                    <p className="px-3 mb-1 text-[10px] font-semibold text-white/25 uppercase tracking-widest">
                      {sidebarContent.label}
                    </p>
                    {sidebarContent.items.map(item => {
                      const Icon = item.icon;
                      const active = location.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                            active ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"
                          }`}
                          data-testid={`mobile-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <Icon className={`w-4 h-4 ${active ? "text-primary" : ""}`} />
                          {item.label}
                        </Link>
                      );
                    })}

                    {sidebarContent.discover && (
                      <>
                        <p className="px-3 mt-4 mb-1 text-[10px] font-semibold text-white/25 uppercase tracking-widest">
                          Discover
                        </p>
                        {GENRE_TAGS.map(tag => (
                          <Link
                            key={tag}
                            href={`/explore?genre=${encodeURIComponent(tag)}`}
                            onClick={() => setMobileOpen(false)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all mb-0.5"
                            data-testid={`mobile-link-genre-${tag.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <span className="w-2 h-2 rounded-full bg-white/15 ml-1 flex-shrink-0" />
                            {tag}
                          </Link>
                        ))}
                      </>
                    )}
                  </div>
                )}

                <div className="mt-5">
                    <p className="px-3 mb-1 text-[10px] font-semibold text-white/25 uppercase tracking-widest">Workspace</p>
                    {ACTION_MENUS.map(menu => (
                      <div key={menu.label} className="mb-3">
                        <p className="px-3 py-1 text-xs font-semibold text-white/70">{menu.label}</p>
                        {menu.items.map(item => {
                          const Icon = item.icon;
                          return (
                            <Link key={item.href + item.label} href={item.href} onClick={() => setMobileOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5">
                              <Icon className="w-4 h-4" />{item.label}
                            </Link>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                {/* Upload — signed-in */}
                {isSignedIn && (
                  <Link
                    href="/videos/upload"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all mt-4 mb-0.5"
                    data-testid="mobile-btn-upload"
                  >
                    <Film className="w-4 h-4" />
                    Upload
                  </Link>
                )}

                {/* Auth actions — signed-out */}
                {!isSignedIn && (
                  <div className="mt-auto px-1 pt-4 flex flex-col gap-2">
                    <Link
                      href="/sign-in"
                      onClick={() => setMobileOpen(false)}
                      className="w-full text-center text-sm font-medium text-white/70 hover:text-white px-4 py-2 rounded-lg bg-white/5 transition-all"
                      data-testid="mobile-link-sign-in"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/sign-up"
                      onClick={() => setMobileOpen(false)}
                      className="w-full text-center text-sm font-semibold px-4 py-2 rounded-lg text-white transition-all"
                      style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}
                      data-testid="mobile-btn-join"
                    >
                      Join Chroma
                    </Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group min-w-0" data-testid="link-home">
            <span className="font-black text-lg sm:text-2xl md:text-3xl lg:text-4xl tracking-tight text-white whitespace-nowrap">Chroma</span>
          </Link>

          {/* ── Flat top-level nav — no dropdowns ───────────────────────── */}
          <nav className="hidden md:flex items-center gap-0.5">
            {TOP_NAV.map(({ label, href, section: s, testid, signedInOnly }) => {
              if (signedInOnly && !isSignedIn) return null;
              const active = section === s;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-3 py-1 rounded-md text-sm font-medium transition-all ${
                    active ? "text-white" : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                  data-testid={testid}
                >
                  {label}
                  {active && (
                    <span
                      className="absolute left-3 right-3 -bottom-[13px] h-[2px] rounded-full"
                      style={{ background: "linear-gradient(90deg, #f59e0b, #d97706)" }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
          <nav className="hidden md:flex items-center gap-0.5" aria-label="Workspace actions">
              {ACTION_MENUS.map(menu => (
                <DropdownMenu key={menu.label} modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button type="button"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 data-[state=open]:bg-white/10 data-[state=open]:text-white outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      data-testid={`nav-popover-${menu.label.toLowerCase()}`}>
                      {menu.label}<ChevronDown className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={10}
                    className="w-72 p-1.5 border border-white/10 bg-[#181818] text-white shadow-2xl">
                    {menu.items.map(item => {
                      const Icon = item.icon;
                      return (
                        <DropdownMenuItem key={item.href + item.label} asChild
                          className="p-0 cursor-pointer focus:bg-white/10 focus:text-white rounded-md">
                          <Link href={item.href} className="flex items-start gap-3 px-3 py-3 w-full">
                            <Icon className="w-5 h-5 mt-0.5 shrink-0 text-primary" />
                            <span className="flex flex-col gap-0.5">
                              <span className="text-sm font-semibold">{item.label}</span>
                              <span className="text-xs text-white/50">{item.description}</span>
                            </span>
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ))}
            </nav>
        </div>

        {/* Center — search */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/35 transition-all hover:text-white/55"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            data-testid="btn-search"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left truncate">Search films, creators...</span>
            <kbd className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/40">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right — auth */}
        <div className="flex items-center gap-2">
          {isSignedIn && (
            <>
              <Link
                href="/videos/upload"
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 2px 12px rgba(245,158,11,0.35)" }}
                data-testid="btn-upload"
              >
                <Film className="w-3.5 h-3.5" />
                Upload
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="rounded-full ring-offset-background transition-opacity hover:opacity-80 outline-none"
                    data-testid="menu-user"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.name || ""} />
                      <AvatarFallback className="bg-white/10 text-white/80 text-xs font-semibold">
                        {user?.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1.5">
                      <p className="text-sm font-medium leading-none text-foreground">{user?.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">@{user?.username}</p>
                      {(user?.plan ?? "free") !== "free" ? (
                        <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          {user?.plan}
                        </span>
                      ) : (
                        <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Free
                        </span>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem asChild className="cursor-pointer focus:bg-secondary focus:text-secondary-foreground">
                    <Link
                      href={`/profile/${user?.username}`}
                      className="flex items-center w-full"
                      data-testid="menu-item-profile"
                    >
                      <UserIcon className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer focus:bg-secondary focus:text-secondary-foreground">
                    <Link href="/profile/me" className="flex items-center w-full" data-testid="menu-item-settings">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer focus:bg-secondary focus:text-secondary-foreground">
                    <Link
                      href="/account/security"
                      className="flex items-center w-full"
                      data-testid="menu-item-security"
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      <span>Account &amp; Security</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Management
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild className="cursor-pointer focus:bg-secondary focus:text-secondary-foreground">
                    <Link href="/admin" className="flex items-center w-full" data-testid="menu-item-admin">
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      <span>Admin Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem
                    className="cursor-pointer focus:bg-destructive/20 focus:text-destructive text-destructive"
                    onClick={() => void logout()}
                    data-testid="menu-item-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {!isSignedIn && (
            <>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-white/50 hover:text-white px-2 sm:px-3 py-1 rounded-md hover:bg-white/5 transition-all whitespace-nowrap"
                data-testid="link-sign-in"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="text-sm font-semibold px-3 sm:px-4 py-1.5 rounded-lg text-white transition-all whitespace-nowrap"
                style={{
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)",
                }}
                data-testid="btn-join"
              >
                <span className="sm:hidden">Join</span>
                <span className="hidden sm:inline">Join Chroma</span>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Body — contextual sidebar + content                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className={`flex flex-1 ${showSidebar ? "" : "flex-col"}`}>

        {showSidebar && sidebarContent && (
          <aside
            className="hidden lg:flex w-52 flex-shrink-0 flex-col py-4 px-2 sticky top-12 h-[calc(100vh-48px)] overflow-y-auto"
            style={{
              background: "rgba(13,13,13,0.8)",
              backdropFilter: "blur(20px)",
              borderRight: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="px-3 mb-[10px] text-[11px] font-medium text-[#6b6b66] uppercase tracking-[0.04em]">
              {sidebarContent.label}
            </p>

            {sidebarContent.items.map(item => (
              <SidebarLink key={item.href} item={item} location={location} />
            ))}

            {sidebarContent.discover && (
              <>
                <p className="px-3 mt-6 mb-[10px] text-[11px] font-medium text-[#6b6b66] uppercase tracking-[0.04em]">
                  Discover
                </p>
                {GENRE_TAGS.map(tag => (
                  <Link
                    key={tag}
                    href={`/explore?genre=${encodeURIComponent(tag)}`}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-[#b5b5b0] hover:text-[#e0e0dc] hover:bg-white/5 transition-all mb-0.5"
                    data-testid={`sidebar-link-genre-${tag.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-white/15 ml-1 flex-shrink-0" />
                    {tag}
                  </Link>
                ))}
              </>
            )}

            {/* Following — shown on Watch section */}
            {section === "watch" && isSignedIn && (
              <>
                <p className="px-3 mt-6 mb-[10px] text-[11px] font-medium text-[#6b6b66] uppercase tracking-[0.04em]">
                  Following
                </p>
                {FOLLOWING.map((creator) => (
                  <Link
                    key={creator.username}
                    href={`/profile/${creator.username}`}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-[#b5b5b0] hover:text-[#e0e0dc] hover:bg-white/5 transition-all mb-0.5"
                    data-testid={`sidebar-link-following-${creator.username}`}
                  >
                    <Avatar className="h-5 w-5 flex-shrink-0">
                      <AvatarImage src={creator.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[9px] font-semibold" style={{ background: "rgba(245,158,11,0.15)", color: "#f5c667" }}>
                        {creator.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{creator.name}</span>
                  </Link>
                ))}
              </>
            )}

            {/* Pro CTA — shown on Watch and Live sections */}
            {(section === "watch" || section === "live") && (
              <div className="mt-auto px-1 pt-6">
                <Link
                  href="/pricing"
                  className="relative block rounded-xl p-3.5 overflow-hidden transition-transform hover:scale-[1.02]"
                  style={{
                    background: "linear-gradient(155deg, rgba(245,158,11,0.16) 0%, rgba(217,119,6,0.05) 100%)",
                    border: "1px solid rgba(245,158,11,0.22)",
                  }}
                  data-testid="sidebar-link-pro"
                >
                  <div
                    className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl"
                    style={{ background: "rgba(245,158,11,0.25)" }}
                  />
                  <Sparkles className="w-4 h-4 text-primary mb-1.5 relative" />
                  <p className="text-xs font-semibold text-white mb-0.5 relative">Upgrade to Pro</p>
                  <p className="text-[11px] text-white/45 leading-relaxed relative">
                    Unlimited uploads, analytics, and priority delivery.
                  </p>
                </Link>
              </div>
            )}
          </aside>
        )}

        <main className="flex-1 w-full flex flex-col min-w-0">
          {children}
        </main>
      </div>

      {/* Footer — only on home/marketing pages */}
      {isHome && (
        <footer className="border-t border-border/40 py-8 md:py-12 bg-background">
          <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clapperboard className="w-4 h-4 opacity-40" />
              <span className="text-sm font-medium">
                © {new Date().getFullYear()} Chroma. For serious filmmakers.
              </span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground font-medium">
              <Link href="/about" className="hover:text-primary transition-colors">About</Link>
              <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
