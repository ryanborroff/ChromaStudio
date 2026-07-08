import './_group.css';
import { ArrowRight, Play, Users, Briefcase, Film, Eye, Heart, Search, ChevronRight, Grid3X3, List, SlidersHorizontal, Sparkles, Clapperboard } from 'lucide-react';

const videos = [
  { id: 1, title: 'Quiet Hours', user: 'Elena Vasquez', role: 'Director', views: 4821, likes: 312, thumb: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400' },
  { id: 2, title: 'Nocturne — Original Score', user: 'James Thornton', role: 'Composer', views: 2890, likes: 178, thumb: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400' },
  { id: 3, title: 'Borderline — Teaser', user: 'Elena Vasquez', role: 'Director', views: 1940, likes: 144, thumb: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400' },
  { id: 4, title: 'Anamorphic Tests', user: 'Marcus Chen', role: 'Cinematographer', views: 7203, likes: 489, thumb: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400' },
];

const navItems = ['Explore', 'Talent', 'Reels', 'Jobs'];

export function MacOS() {
  return (
    <div className="min-h-screen text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, sans-serif', background: '#111' }}>

      {/* macOS-style menu bar */}
      <header className="sticky top-0 z-50 h-12 flex items-center px-5 justify-between"
        style={{ background: 'rgba(20,20,20,0.85)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-5">
          {/* macOS traffic lights */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex items-center gap-1.5">
            <Clapperboard className="w-4 h-4 text-red-400" strokeWidth={2.5} />
            <span className="font-semibold text-sm tracking-tight text-white/90">ChromaStudio</span>
          </div>
          <nav className="flex items-center gap-0.5">
            {navItems.map((item, i) => (
              <button key={item} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${i === 0 ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                {item}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-sm text-white/50 hover:text-white px-3 py-1 rounded-md hover:bg-white/5 transition-all">Sign In</button>
          <button className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)', boxShadow: '0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
            Join ChromaStudio
          </button>
        </div>
      </header>

      <div className="flex">
        {/* macOS-style sidebar */}
        <aside className="w-52 flex-shrink-0 h-[calc(100vh-48px)] sticky top-12 flex flex-col py-4 px-2"
          style={{ background: 'rgba(16,16,16,0.8)', backdropFilter: 'blur(20px)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="px-3 mb-1">
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1">Library</p>
          </div>
          {[
            { label: 'Explore', icon: <Grid3X3 className="w-4 h-4" />, active: true },
            { label: 'Talent', icon: <Users className="w-4 h-4" />, active: false },
            { label: 'Reels', icon: <Play className="w-4 h-4" />, active: false },
            { label: 'Jobs', icon: <Briefcase className="w-4 h-4" />, active: false },
          ].map(item => (
            <button key={item.label} className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all mb-0.5 ${item.active ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white/80 hover:bg-white/5'}`}>
              <span className={item.active ? 'text-red-400' : ''}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div className="px-3 mt-5 mb-1">
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1">Discover</p>
          </div>
          {['Documentary', 'Narrative', 'Experimental', 'Commercial'].map(tag => (
            <button key={tag} className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all mb-0.5">
              <span className="w-2 h-2 rounded-full bg-white/20 ml-1" />
              {tag}
            </button>
          ))}

          <div className="mt-auto px-3">
            <div className="rounded-xl p-3" style={{ background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.2)' }}>
              <Sparkles className="w-4 h-4 text-red-400 mb-1.5" />
              <p className="text-xs font-semibold text-white mb-0.5">Pro Membership</p>
              <p className="text-[11px] text-white/45 leading-relaxed">Unlock unlimited uploads and analytics.</p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-h-[calc(100vh-48px)] overflow-auto">
          {/* Toolbar */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3"
            style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">Explore</h1>
              <p className="text-xs text-white/40 font-medium">Discover exceptional work.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
                <input placeholder="Search…" className="pl-8 h-8 w-52 text-sm rounded-lg outline-none text-white/80 placeholder:text-white/30 focus:ring-1 focus:ring-red-500/40"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <button className="h-8 w-8 flex items-center justify-center rounded-lg transition-all text-white/50 hover:text-white"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
              <button className="h-8 w-8 flex items-center justify-center rounded-lg transition-all text-white"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Video grid */}
          <div className="p-6 grid grid-cols-2 gap-4">
            {videos.map(v => (
              <div key={v.id} className="group rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.13)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 40px rgba(0,0,0,0.5)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.3)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}>
                <div className="relative aspect-video overflow-hidden">
                  <img src={v.thumb} alt={v.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white/70 flex items-center gap-1">
                        <Eye className="w-3 h-3" />{(v.views / 1000).toFixed(1)}k
                      </span>
                      <span className="text-xs font-medium text-white/70 flex items-center gap-1">
                        <Heart className="w-3 h-3" />{v.likes}
                      </span>
                    </div>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                      <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="font-semibold text-sm text-white/90 truncate tracking-tight">{v.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-red-400">{v.user.charAt(0)}</span>
                    </div>
                    <span className="text-xs text-white/40">{v.user}</span>
                    <span className="text-white/20">·</span>
                    <span className="text-xs text-white/30">{v.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA strip */}
          <div className="mx-6 mb-6 rounded-2xl p-6 flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg, rgba(229,62,62,0.12) 0%, rgba(16,16,16,0) 100%)', border: '1px solid rgba(229,62,62,0.2)' }}>
            <div>
              <p className="font-semibold text-white tracking-tight">Every Pixel Earned.</p>
              <p className="text-sm text-white/45 mt-0.5">Put your portfolio where the industry looks.</p>
            </div>
            <button className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #e53e3e 0%, #c53030 100%)', boxShadow: '0 2px 12px rgba(229,62,62,0.4), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
              Start Your Profile <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
