// =============================================================================
// NAV ITEM LOCATIONS — canonical source of truth after deduplication
//
//  Item                     Top Nav        Studio Sidebar   Mobile Sheet
//  ─────────────────────────────────────────────────────────────────────
//  Watch (/explore)         ✓ center       —                ✓
//  Feed (/feed)             ✓ center*      —                ✓*
//  Live group               ✓ dropdown     —                ✓
//  Studio group             ✓ dropdown*    ✓ (sole loc)     ✓*
//  Shop group               ✓ dropdown     —                ✓
//  Pricing (/pricing)       ✓ tail         —                ✓
//  Media Library            Studio drop    ✓ Studio sidebar —
//  Analytics                Studio drop    ✓ Studio sidebar —
//  Upload (/videos/upload)  ✓ right*       —                ✓*
//
//  * = signed-in only
//  Studio Sidebar is shown only on /studio/* routes.
// =============================================================================

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, logout } from "@/lib/useAuth";
import {
  Film, LogOut, Settings, User as UserIcon,
  Grid3X3, Users, Clapperboard, Sparkles, Rss,
  Tag, Menu, ChevronDown,
  Radio, History, FolderOpen, Cloud, Send, Code2, BarChart3,
  ShoppingBag, ShieldCheck, KeyRound, type LucideIcon,
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

type NavItem = { href: string; label: string; icon: LucideIcon; desc?: string };
type NavGroup = { label: string; signedInOnly?: boolean; items: NavItem[] };

const NAV_VIEW: NavItem = { href: "/explore", label: "Watch", icon: Grid3X3 };
const NAV_LIBRARY: NavItem = { href: "/studio/storage", label: "Library", icon: Clapperboard };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Live",
    items: [
      { href: "/live", label: "Streaming", icon: Radio, desc: "Broadcast ticketed events" },
      { href: "/cinema", label: "Cinema Events", icon: Clapperboard, desc: "Scheduled screenings & premieres" },
      { href: "/live/replays", label: "Replays", icon: History, desc: "Watch past streams on demand" },
    ],
  },
  {
    label: "Studio",
    signedInOnly: true,
    items: [
      { href: "/studio/portfolio", label: "Portfolio Collections", icon: FolderOpen, desc: "Reels & themed collections" },
      { href: "/studio/storage", label: "Media Library", icon: Cloud, desc: "Collections, categories & sharing" },
      { href: "/studio/delivery", label: "Client Delivery", icon: Send, desc: "Branded delivery & approvals" },
      { href: "/studio/embeds", label: "Website Embedding", icon: Code2, desc: "Embeddable players & galleries" },
      { href: "/studio/analytics", label: "Analytics", icon: BarChart3, desc: "Views, audience & revenue" },
    ],
  },
  {
    label: "Shop",
    items: [
      { href: "/store", label: "Download Shop", icon: ShoppingBag, desc: "LUTs, presets & project files" },
    ],
  },
];

const NAV_TAIL: NavItem[] = [
  { href: "/pricing", label: "Pricing", icon: Tag },
];

const GENRE_TAGS = ["Documentary", "Narrative", "Experimental", "Commercial", "Music Video"];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isSignedIn } = useAuth();

  const isHome = location === "/";
  const showSidebar = !isHome && !location.startsWith("/sign");

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col dark" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, sans-serif' }}>

      {/* macOS-style menu bar */}
      <header
        className="sticky top-0 z-50 w-full h-12 flex items-center px-4 justify-between"
        style={{
          background: "rgba(14,14,14,0.88)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Left — mobile trigger + logo + nav */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Mobile menu trigger */}
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
                  <Clapperboard className="w-5 h-5 text-primary" strokeWidth={2.5} />
                  <span className="font-black text-base tracking-tight">ChromaStudio</span>
                </SheetTitle>
              </SheetHeader>

              {/* Mobile Sheet — mirrors top navbar global items only */}
              <div className="flex flex-col py-3 px-2 overflow-y-auto h-[calc(100dvh-3rem)]">

                {/* Watch */}
                <Link
                  href={NAV_VIEW.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${location.startsWith(NAV_VIEW.href) ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                  data-testid={`mobile-link-${NAV_VIEW.label.toLowerCase()}`}
                >
                  <NAV_VIEW.icon className={`w-4 h-4 ${location.startsWith(NAV_VIEW.href) ? "text-primary" : ""}`} />
                  {NAV_VIEW.label}
                </Link>

                {/* Feed — signed-in only */}
                {isSignedIn && (
                  <Link
                    href="/feed"
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${location === "/feed" ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                    data-testid="mobile-link-feed"
                  >
                    <Rss className={`w-4 h-4 ${location === "/feed" ? "text-primary" : ""}`} />
                    Feed
                  </Link>
                )}

                {/* Nav groups: Live, Studio (signed-in), Shop */}
                {NAV_GROUPS.map(group => {
                  if (group.signedInOnly && !isSignedIn) return null;
                  return (
                    <div key={group.label} className="mt-4">
                      <p className="px-3 mb-1 text-[10px] font-semibold text-white/25 uppercase tracking-widest">{group.label}</p>
                      {group.items.map(item => {
                        const Icon = item.icon;
                        const active = location.startsWith(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${active ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                            data-testid={`mobile-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <Icon className={`w-4 h-4 ${active ? "text-primary" : ""}`} />
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Pricing */}
                {NAV_TAIL.map(item => {
                  const Icon = item.icon;
                  const active = location.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mt-4 mb-0.5 ${active ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                      data-testid={`mobile-link-${item.label.toLowerCase()}`}
                    >
                      <Icon className={`w-4 h-4 ${active ? "text-primary" : ""}`} />
                      {item.label}
                    </Link>
                  );
                })}

                {/* Discover — genre filter links to /explore */}
                <p className="px-3 mt-5 mb-1 text-[10px] font-semibold text-white/25 uppercase tracking-widest">Discover</p>
                {GENRE_TAGS.map(tag => {
                  const href = `/explore?genre=${encodeURIComponent(tag)}`;
                  return (
                    <Link
                      key={tag}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all mb-0.5"
                      data-testid={`mobile-link-genre-${tag.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-white/15 ml-1 flex-shrink-0" />
                      {tag}
                    </Link>
                  );
                })}

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
                      style={{ background: "linear-gradient(135deg, hsl(0 80% 55%) 0%, hsl(0 80% 42%) 100%)" }}
                      data-testid="mobile-btn-join"
                    >
                      Join ChromaStudio
                    </Link>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group" data-testid="link-home">
            <Clapperboard className="w-5 h-5 text-primary" strokeWidth={2.5} />
            <span className="font-black text-base tracking-tight text-white">ChromaStudio</span>
          </Link>

          {/* Top-level nav links */}
          <nav className="hidden md:flex items-center gap-0.5">
            {/* Watch */}
            <Link
              href={NAV_VIEW.href}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${location.startsWith(NAV_VIEW.href) ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}
              data-testid="link-view"
            >
              {NAV_VIEW.label}
            </Link>

            {/* Feed — signed-in only */}
            {isSignedIn && (
              <Link
                href="/feed"
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${location === "/feed" ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                data-testid="link-feed"
              >
                Feed
              </Link>
            )}

            {/* Group dropdowns: Live, Studio (signed-in), Shop */}
            {NAV_GROUPS.map(group => {
              if (group.signedInOnly && !isSignedIn) return null;
              const active = group.items.some(i => location.startsWith(i.href));
              return (
                <DropdownMenu key={group.label}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition-all outline-none ${active ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                      data-testid={`nav-group-${group.label.toLowerCase()}`}
                    >
                      {group.label}
                      <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 bg-card border-border">
                    <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {group.label}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-border" />
                    {group.items.map(item => {
                      const Icon = item.icon;
                      return (
                        <DropdownMenuItem key={item.href} asChild className="cursor-pointer focus:bg-secondary focus:text-secondary-foreground">
                          <Link href={item.href} className="flex items-start gap-2.5 w-full" data-testid={`nav-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                            <Icon className="mt-0.5 h-4 w-4 text-primary flex-shrink-0" />
                            <span className="flex flex-col">
                              <span className="text-sm font-medium text-foreground">{item.label}</span>
                              {item.desc && <span className="text-xs text-muted-foreground">{item.desc}</span>}
                            </span>
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}

            {/* Pricing — tail link */}
            {NAV_TAIL.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${location.startsWith(item.href) ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                data-testid={`link-${item.label.toLowerCase()}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right — auth */}
        <div className="flex items-center gap-2">
          {isSignedIn && (
            <>
            <Link
              href="/videos/upload"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all"
              data-testid="btn-upload"
            >
              <Film className="w-3.5 h-3.5" />
              Upload
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full ring-offset-background transition-opacity hover:opacity-80 outline-none" data-testid="menu-user">
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
                    <p className="text-xs leading-none text-muted-foreground">
                      @{user?.username}
                    </p>
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
                  <Link href={`/profile/${user?.username}`} className="flex items-center w-full" data-testid="menu-item-profile">
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
                  <Link href="/account/security" className="flex items-center w-full" data-testid="menu-item-security">
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
              className="text-sm font-medium text-white/50 hover:text-white px-3 py-1 rounded-md hover:bg-white/5 transition-all"
              data-testid="link-sign-in"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white transition-all"
              style={{
                background: "linear-gradient(135deg, hsl(0 80% 55%) 0%, hsl(0 80% 42%) 100%)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
              data-testid="btn-join"
            >
              Join ChromaStudio
            </Link>
            </>
          )}
        </div>
      </header>

      {/* Body — sidebar + content */}
      <div className={`flex flex-1 ${showSidebar ? "" : "flex-col"}`}>

        {showSidebar && (
          <aside
            className="hidden lg:flex w-52 flex-shrink-0 flex-col py-4 px-2 sticky top-12 h-[calc(100vh-48px)] overflow-y-auto"
            style={{
              background: "rgba(13,13,13,0.8)",
              backdropFilter: "blur(20px)",
              borderRight: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="px-3 text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-1">Library</p>

            {isSignedIn && (
              <Link
                href="/feed"
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all mb-0.5 ${location === "/feed" ? "bg-[#1c1c1a] text-white" : "text-[#b5b5b0] hover:text-[#e0e0dc] hover:bg-white/5"}`}
                data-testid="sidebar-link-feed"
              >
                <Rss className={`w-4 h-4 ${location === "/feed" ? "text-primary" : ""}`} />
                Feed
              </Link>
            )}

            {[NAV_VIEW, ...NAV_TAIL].map(item => {
              const Icon = item.icon;
              const active = location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all mb-0.5 ${active ? "bg-[#1c1c1a] text-white" : "text-[#b5b5b0] hover:text-[#e0e0dc] hover:bg-white/5"}`}
                  data-testid={`sidebar-link-${item.label.toLowerCase()}`}
                >
                  <Icon className={`w-4 h-4 ${active ? "text-primary" : ""}`} />
                  {item.label}
                </Link>
              );
            })}

            {NAV_GROUPS.map(group => {
              if (group.signedInOnly && !isSignedIn) return null;
              return (
                <div key={group.label} className="mt-7">
                  <p className="px-3 mb-[10px] text-[11px] font-medium text-[#6b6b66] uppercase tracking-[0.04em]">{group.label}</p>
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const active = location.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2.5 px-[10px] py-2 rounded-lg text-[13px] font-medium transition-all mb-0.5 ${active ? "bg-[#1c1c1a] text-white" : "text-[#b5b5b0] hover:text-[#e0e0dc] hover:bg-white/5"}`}
                        data-testid={`sidebar-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <Icon className={`w-[17px] h-[17px] flex-shrink-0 ${active ? "text-primary" : "text-[#9a9a94]"}`} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}

            <div className="mt-7">
              <p className="px-3 mb-[10px] text-[11px] font-medium text-[#6b6b66] uppercase tracking-[0.04em]">Discover</p>
            </div>

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

            <div className="mt-auto px-1">
              <Link
                href="/pricing"
                className="block rounded-xl p-3 transition-all hover:opacity-90"
                style={{ background: "rgba(229,62,62,0.08)", border: "1px solid rgba(229,62,62,0.18)" }}
                data-testid="sidebar-link-pro"
              >
                <Sparkles className="w-4 h-4 text-primary mb-1.5" />
                <p className="text-xs font-semibold text-white mb-0.5">Pro Membership</p>
                <p className="text-[11px] text-white/40 leading-relaxed">Unlock unlimited uploads and analytics.</p>
              </Link>
            </div>
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
              <span className="text-sm font-medium">© {new Date().getFullYear()} ChromaStudio. For serious filmmakers.</span>
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
