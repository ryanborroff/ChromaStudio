import { Link, useLocation } from "wouter";
import { Show, useClerk, useUser } from "@clerk/react";
import { Film, LogOut, Settings, User as UserIcon, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const navLinks = [
    { href: "/explore", label: "Explore" },
    { href: "/crew", label: "Crew" },
    { href: "/reels", label: "Reels" },
    { href: "/projects", label: "Projects" },
  ];

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col dark">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group" data-testid="link-home">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-black text-xl leading-none group-hover:scale-105 transition-transform">
                C
              </div>
              <span className="font-bold tracking-tight text-lg hidden sm:inline-block">Chroma</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Show when="signed-in">
                <Link 
                  href="/feed" 
                  className={`transition-colors hover:text-primary ${location === '/feed' ? 'text-primary' : 'text-muted-foreground'}`}
                  data-testid="link-feed"
                >
                  Feed
                </Link>
              </Show>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors hover:text-primary ${location.startsWith(link.href) ? 'text-primary' : 'text-muted-foreground'}`}
                  data-testid={`link-${link.label.toLowerCase()}`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Show when="signed-out">
              <div className="hidden sm:flex items-center gap-4">
                <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors" data-testid="link-sign-in">
                  Sign In
                </Link>
                <Button asChild size="sm" className="font-semibold" data-testid="btn-join">
                  <Link href="/sign-up">Join Chroma</Link>
                </Button>
              </div>
            </Show>

            <Show when="signed-in">
              <Button asChild variant="secondary" size="sm" className="hidden sm:flex font-medium" data-testid="btn-upload">
                <Link href="/videos/upload">
                  <Film className="w-4 h-4 mr-2" />
                  Upload
                </Link>
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 ring-offset-background transition-opacity hover:opacity-80" data-testid="menu-user">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.imageUrl} alt={user?.fullName || ""} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
                        {user?.firstName?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none text-foreground">{user?.fullName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.primaryEmailAddress?.emailAddress}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem asChild className="cursor-pointer focus:bg-secondary focus:text-secondary-foreground">
                    <Link href={`/profile/${user?.username || user?.id}`} className="flex items-center w-full" data-testid="menu-item-profile">
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
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem 
                    className="cursor-pointer focus:bg-destructive/20 focus:text-destructive text-destructive"
                    onClick={() => signOut({ redirectUrl: basePath || "/" })}
                    data-testid="menu-item-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Show>

            {/* Mobile Menu */}
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="btn-mobile-menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-background border-l-border w-[300px] sm:w-[400px]">
                  <nav className="flex flex-col gap-4 mt-8">
                    <Show when="signed-in">
                      <Link href="/feed" className="text-lg font-medium text-foreground hover:text-primary" data-testid="mobile-link-feed">
                        Feed
                      </Link>
                    </Show>
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="text-lg font-medium text-foreground hover:text-primary"
                        data-testid={`mobile-link-${link.label.toLowerCase()}`}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <Show when="signed-out">
                      <div className="mt-8 flex flex-col gap-4">
                        <Button asChild variant="outline" className="w-full justify-center">
                          <Link href="/sign-in">Sign In</Link>
                        </Button>
                        <Button asChild className="w-full justify-center">
                          <Link href="/sign-up">Join Chroma</Link>
                        </Button>
                      </div>
                    </Show>
                    <Show when="signed-in">
                      <div className="mt-8 flex flex-col gap-4">
                        <Button asChild className="w-full justify-center">
                          <Link href="/videos/upload">
                            <Film className="w-4 h-4 mr-2" />
                            Upload Video
                          </Link>
                        </Button>
                      </div>
                    </Show>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full flex flex-col">
        {children}
      </main>
      
      <footer className="border-t border-border/40 py-8 md:py-12 bg-background mt-auto">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-muted-foreground font-black text-sm leading-none opacity-50">
              C
            </div>
            <span className="text-sm font-medium">© {new Date().getFullYear()} Chroma. For serious filmmakers.</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground font-medium">
            <Link href="/about" className="hover:text-primary transition-colors">About</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}