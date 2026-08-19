import './_group.css';
import { ArrowRight, Play, Users, Briefcase, Film, Eye, Heart, Search, Filter, ChevronRight } from 'lucide-react';

const videos = [
  { id: 1, title: 'Quiet Hours', user: 'Elena Vasquez', views: 4821, likes: 312, thumb: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=400' },
  { id: 2, title: 'Nocturne — Original Score', user: 'James Thornton', views: 2890, likes: 178, thumb: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400' },
  { id: 3, title: 'Borderline — Teaser', user: 'Elena Vasquez', views: 1940, likes: 144, thumb: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400' },
  { id: 4, title: 'Anamorphic Tests — Morocco', user: 'Marcus Chen', views: 7203, likes: 489, thumb: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400' },
];

export function Current() {
  return (
    <div className="min-h-screen bg-[#0B0B0B] text-white" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0B0B0B]/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-red-500 flex items-center justify-center font-black text-white text-lg">C</div>
              <span className="font-bold tracking-tight text-lg">Chroma</span>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              {['Explore', 'Talent', 'Reels', 'Jobs'].map(l => (
                <a key={l} className="text-white/60 hover:text-white transition-colors">{l}</a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-sm font-medium text-white/60 hover:text-white">Sign In</button>
            <button className="bg-red-500 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">Join Chroma</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-32">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-red-500/20 rounded-full blur-[128px] opacity-50" />
        <div className="absolute top-40 -left-40 w-96 h-96 bg-red-500/10 rounded-full blur-[128px] opacity-50" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-7xl font-black tracking-tight mb-8">
            Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-blue-400">Community</span>
            <br /> in Motion
          </h1>
          <p className="text-2xl text-white/60 max-w-3xl mx-auto mb-12 font-medium leading-relaxed">
            Chroma is not a social network. It's a professional ecosystem where directors, cinematographers, and craftspeople showcase work, find crew, and build their careers.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button className="bg-red-500 text-white h-14 px-8 text-lg font-bold rounded-xl flex items-center gap-2 hover:bg-red-600 transition-colors">
              Join Chroma <ArrowRight className="w-5 h-5" />
            </button>
            <button className="bg-white/10 text-white h-14 px-8 text-lg font-bold rounded-xl hover:bg-white/15 transition-colors">
              Explore Filmmakers
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 border-y border-white/10 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-6">
          {[
            { icon: <Play className="w-6 h-6" />, title: 'Premium Hosting', desc: 'Showcase your films in the highest quality without ads, algorithms, or distractions.' },
            { icon: <Users className="w-6 h-6" />, title: 'Elite Network', desc: 'Connect with verified industry professionals. From DPs to colorists.' },
            { icon: <Briefcase className="w-6 h-6" />, title: 'Project Board', desc: 'Discover unlisted opportunities or crew up your next production efficiently.' },
          ].map(f => (
            <div key={f.title} className="p-8 rounded-2xl bg-[#181818] border border-white/10 hover:border-red-500/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 mb-6">{f.icon}</div>
              <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
              <p className="text-white/60 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Explore grid */}
      <section className="py-12 max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black text-white">Explore</h2>
            <p className="text-white/60 mt-1 font-medium">Discover exceptional work.</p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input placeholder="Search videos..." className="pl-9 bg-[#181818] border border-white/10 rounded-lg h-10 text-sm text-white placeholder:text-white/40 w-64 px-3 outline-none focus:border-red-500/50" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-5">
          {videos.map(v => (
            <div key={v.id} className="group flex flex-col gap-3">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-[#181818] border border-white/10">
                <img src={v.thumb} alt={v.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm truncate">{v.title}</p>
                <p className="text-white/50 text-xs mt-0.5">{v.user}</p>
                <div className="flex items-center gap-3 text-xs text-white/40 mt-1.5">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{v.views}</span>
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{v.likes}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
