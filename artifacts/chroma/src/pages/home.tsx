import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Users, Briefcase, Camera } from "lucide-react";
import { motion } from "framer-motion";

export function Home() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 pb-32 md:pt-36 md:pb-48">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
        <div className="absolute inset-0 bg-background/80" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-[128px] opacity-50" />
        <div className="absolute top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-[128px] opacity-50" />
        
        <div className="container relative z-10 px-4 mx-auto text-center max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center rounded-full border border-border bg-card/50 backdrop-blur-sm px-3 py-1 text-sm font-medium text-muted-foreground mb-8">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
              The Community in Motion
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8 text-white">
              Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Cinematic</span> <br className="hidden md:block" /> Identity
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 font-medium leading-relaxed">
              Chroma is not a social network. It's a professional ecosystem where directors, cinematographers, and craftspeople showcase work, find crew, and build their careers.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="h-14 px-8 text-lg font-bold w-full sm:w-auto" asChild data-testid="hero-join-btn">
                <Link href="/sign-up">
                  Join Chroma <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" className="h-14 px-8 text-lg font-bold w-full sm:w-auto" asChild data-testid="hero-explore-btn">
                <Link href="/explore">
                  Explore Filmmakers
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-card/30 border-y border-border/40">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid md:grid-cols-3 gap-8">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                <Play className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Premium Hosting</h3>
              <p className="text-muted-foreground leading-relaxed">
                Showcase your films in the highest quality without ads, algorithms, or distractions. Your work speaks for itself.
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Elite Network</h3>
              <p className="text-muted-foreground leading-relaxed">
                Connect with verified industry professionals. From DPs to colorists, find exactly who you need for your next shoot.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="p-8 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                <Briefcase className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Project Board</h3>
              <p className="text-muted-foreground leading-relaxed">
                Discover unlisted opportunities or crew up your next production efficiently with our targeted project boards.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="container mx-auto px-4 text-center max-w-4xl relative z-10">
          <h2 className="text-4xl md:text-5xl font-black mb-6 text-white">Every Pixel Earned.</h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Stop competing with cat videos and influencers. Put your portfolio where the industry actually looks.
          </p>
          <Button size="lg" className="h-14 px-10 text-lg font-bold" asChild>
            <Link href="/sign-up">Start Building Your Profile</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}