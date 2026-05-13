import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, ArrowRight, Globe, FileText, Activity } from "lucide-react";
import iconInvisibleSearch from "@/assets/icon-invisible-search.png";
import iconWeakAuthority from "@/assets/icon-weak-authority.png";
import iconConversionFriction from "@/assets/icon-conversion-friction.png";
import { motion } from "framer-motion";
import { AnimatedScoreRing } from "@/components/landing/AnimatedScoreRing";
import { AnimatedKpi } from "@/components/landing/AnimatedKpi";

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.45, delay },
});

const Index = () => {
  const navigate = useNavigate();
  const [heroUrl, setHeroUrl] = useState("");
  const [bottomUrl, setBottomUrl] = useState("");

  const handleScan = (url: string) => {
    if (!url.trim()) return;
    navigate(`/scan?url=${encodeURIComponent(url.trim())}`);
  };

  return (
    <div className="flex flex-col">
      {/* ── SECTION 1: HERO ── */}
      <section className="relative bg-background overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />

        <div className="container relative py-16 md:py-24 lg:py-32">
          <motion.div className="mx-auto max-w-3xl text-center space-y-6" {...fade()}>
            <h1 className="text-[28px] sm:text-[36px] lg:text-[44px] font-extrabold text-foreground leading-[1.15] tracking-tight">
              See Exactly Where Your Business Is Losing{" "}
              <span className="text-primary">Visibility, Customers, and Revenue</span>
            </h1>
            <p className="text-[14px] sm:text-[16px] text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed">
              Authority Gap Engine™ analyzes your search visibility, authority signals, and conversion structure to identify where growth is being lost — and how to recover it.
            </p>
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground/50 font-semibold">
              AI-driven diagnostic · Based on real search and conversion signals
            </p>
            <p className="text-[11px] text-muted-foreground/40 font-medium">
              Evaluates ranking potential, authority signals, and conversion performance across your site.
            </p>

            {/* Inline URL input */}
            <div className="max-w-lg mx-auto pt-2">
              <form onSubmit={(e) => { e.preventDefault(); handleScan(heroUrl); }} className="flex gap-2">
                <Input
                  placeholder="Enter your website URL"
                  value={heroUrl}
                  onChange={(e) => setHeroUrl(e.target.value)}
                  className="h-12 text-[13px] flex-1 rounded-lg"
                  aria-label="Website URL"
                />
                <Button type="submit" size="lg" className="h-12 px-6 text-[13px] font-bold rounded-lg gap-2 whitespace-nowrap transition-all duration-200 hover:shadow-md hover:brightness-110 active:scale-[0.97]" disabled={!heroUrl.trim()}>
                  Run Free Diagnostic <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
              <p className="text-[11px] text-muted-foreground/50 mt-3 font-medium">
                No login required. Results in under 60 seconds.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SECTION 2: CREDIBILITY STRIP ── */}
      <section className="border-y bg-secondary/50">
        <div className="container py-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-0 sm:divide-x divide-border">
            {[
              "Built on real search visibility data",
              "Modeled against competitive benchmarks",
              "Designed for decision-level insight",
            ].map((text) => (
              <div key={text} className="flex items-center gap-2 px-5 sm:px-6">
                <div className="h-1 w-1 rounded-full bg-primary flex-shrink-0 hidden sm:block" />
                <span className="text-[11px] sm:text-[12px] text-muted-foreground/70 font-semibold tracking-wide text-center">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: PROBLEM FRAMING ── */}
      <section className="py-16 md:py-20 bg-background">
        <div className="container">
          <motion.div className="text-center mb-10 sm:mb-12" {...fade()}>
            <h2 className="text-[22px] sm:text-[28px] font-extrabold text-foreground leading-tight">
              Most Businesses Are Losing Growth Without Realizing It
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: iconInvisibleSearch,
                title: "Invisible in Search",
                desc: "Failing to appear for high-intent queries where customers are actively choosing providers.",
              },
              {
                icon: iconWeakAuthority,
                title: "Weak Authority Signals",
                desc: "Insufficient trust signals reduce your ability to compete in search rankings.",
              },
              {
                icon: iconConversionFriction,
                title: "Conversion Friction",
                desc: "Visitors arrive but do not convert due to structural and messaging breakdowns.",
              },
            ].map((item, i) => (
              <motion.div key={item.title} {...fade(i * 0.08)}>
                <Card className="shadow-card border-0 rounded-xl h-full transition-all duration-250 hover:shadow-elevated hover:-translate-y-0.5">
                  <CardContent className="p-6 sm:p-7 space-y-4 flex flex-col items-center text-center">
                    <img src={item.icon} alt={item.title} className="h-20 w-20 object-contain" />
                    <h3 className="text-[15px] font-extrabold text-foreground">{item.title}</h3>
                    <p className="text-[13px] text-muted-foreground/70 leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: HOW IT WORKS ── */}
      <section className="py-16 md:py-20 bg-secondary">
        <div className="container">
          <motion.div className="text-center mb-10 sm:mb-12" {...fade()}>
            <h2 className="text-[22px] sm:text-[28px] font-extrabold text-foreground leading-tight">
              How the Diagnostic Works
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              {
                step: "1",
                icon: <Globe className="h-4.5 w-4.5" />,
                title: "Enter your website",
                desc: "We map your site structure and search footprint.",
              },
              {
                step: "2",
                icon: <Activity className="h-4.5 w-4.5" />,
                title: "System analysis",
                desc: "We evaluate authority signals, rankings, and conversion pathways.",
              },
              {
                step: "3",
                icon: <FileText className="h-4.5 w-4.5" />,
                title: "Get your report",
                desc: "You receive a structured breakdown of visibility gaps, risks, and opportunities.",
              },
            ].map((item, i) => (
              <motion.div key={item.step} className="text-center space-y-3" {...fade(i * 0.08)}>
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground font-extrabold text-[14px]">
                  {item.step}
                </div>
                <h3 className="text-[14px] font-extrabold text-foreground">{item.title}</h3>
                <p className="text-[12px] text-muted-foreground/70 leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: OUTPUT PREVIEW ── */}
      <section className="py-16 md:py-20 bg-background">
        <div className="container">
          <motion.div className="text-center mb-10 sm:mb-12" {...fade()}>
            <h2 className="text-[22px] sm:text-[28px] font-extrabold text-foreground leading-tight">
              What You'll See
            </h2>
            <p className="text-[12px] text-muted-foreground/50 font-medium mt-2">
              This is a sample of the diagnostic output generated from your scan.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            {/* Report preview card */}
            <motion.div {...fade(0.1)}>
              <Card className="shadow-elevated border-0 rounded-xl overflow-hidden">
                <div className="bg-ihd-dark-green px-6 py-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/50 font-semibold">Authority Gap Report</p>
                      <p className="text-[13px] font-bold text-primary-foreground mt-0.5">example-business.com</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-primary-foreground/40 font-semibold">SAMPLE</span>
                    </div>
                  </div>
                </div>

                <CardContent className="p-6 sm:p-8">
                  {/* Score + KPIs */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <AnimatedScoreRing score={47} label="Weak Authority" colorClass="text-warning" />
                    <AnimatedKpi label="Visibility" numerator={18} denominator={40} status="Critical" colorClass="text-destructive" />
                    <AnimatedKpi label="Conversion" numerator={16} denominator={40} status="Weak" colorClass="text-warning" />
                    <AnimatedKpi label="Opportunity" displayValue="$12K–$38K" status="Monthly" colorClass="text-primary" />
                  </div>

                  {/* Signals analyzed */}
                  <div className="border-t pt-6 mb-5">
                    <p className="text-[11px] text-muted-foreground/50 font-medium tracking-wide">
                      Signals analyzed: <span className="text-foreground/60 font-semibold">128</span> across search visibility, authority, and conversion structure
                    </p>
                  </div>

                  {/* Findings preview */}
                  <div className="space-y-3">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-bold mb-4">Key Findings</p>
                    {[
                      { label: "Missing local keyword targeting", severity: "High", tag: "Signals analyzed" },
                      { label: "No clear call-to-action hierarchy", severity: "High", tag: "Impact identified" },
                      { label: "No structured data markup", severity: "Medium", tag: "Priority actions" },
                    ].map((finding, i) => (
                      <motion.div
                        key={finding.label}
                        initial={{ opacity: 0, x: -8 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.35, delay: 0.3 + i * 0.1 }}
                        className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${finding.severity === "High" ? "bg-destructive" : "bg-warning"}`} />
                          <span className="text-[13px] text-foreground/80 font-medium">{finding.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground/40 font-semibold hidden sm:inline">{finding.tag}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            finding.severity === "High" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                          }`}>
                            {finding.severity}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* System Insight + Business Impact */}
                  <div className="border-t pt-5 mt-5 space-y-3">
                    <div className="bg-muted/40 rounded-lg px-4 py-3 border-l-2 border-primary/40">
                      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-bold mb-1">System Insight</p>
                      <p className="text-[12px] text-foreground/60 leading-relaxed">
                        Low authority signals combined with weak local keyword coverage are limiting your visibility for high-intent searches.
                      </p>
                    </div>
                    <div className="px-4">
                      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-bold mb-1">Business Impact</p>
                      <p className="text-[12px] text-foreground/50 leading-relaxed">
                        This reduces your ability to consistently acquire new patients from organic search.
                      </p>
                    </div>
                  </div>

                  {/* Confidence Level */}
                  <div className="border-t pt-4 mt-4 flex items-center justify-end gap-2">
                    <span className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-[0.1em]">Confidence:</span>
                    <span className="text-[10px] font-bold text-primary/80 bg-primary/8 px-2 py-0.5 rounded">High</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: REINFORCED CTA ── */}
      <section className="py-16 md:py-20 bg-secondary border-t">
        <div className="container">
          <motion.div className="mx-auto max-w-2xl text-center space-y-5" {...fade()}>
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-[22px] sm:text-[28px] font-extrabold text-foreground leading-tight">
              Run Your Authority Diagnostic
            </h2>
            <p className="text-[14px] text-muted-foreground/70 max-w-md mx-auto leading-relaxed">
              Identify where your business is losing visibility, customers, and revenue.
            </p>

            <div className="max-w-lg mx-auto pt-2">
              <form onSubmit={(e) => { e.preventDefault(); handleScan(bottomUrl); }} className="flex gap-2">
                <Input
                  placeholder="Enter your website URL"
                  value={bottomUrl}
                  onChange={(e) => setBottomUrl(e.target.value)}
                  className="h-12 text-[13px] flex-1 rounded-lg"
                  aria-label="Website URL"
                />
                <Button type="submit" size="lg" className="h-12 px-6 text-[13px] font-bold rounded-lg gap-2 whitespace-nowrap transition-all duration-200 hover:shadow-md hover:brightness-110 active:scale-[0.97]" disabled={!bottomUrl.trim()}>
                  Run Free Diagnostic <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
              <p className="text-[11px] text-muted-foreground/50 mt-3 font-medium">
                No login required. Results in under 60 seconds.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-5 bg-background">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-[12px] text-muted-foreground/60">
          <div className="flex items-center gap-3">
            <img src="/ihd-logo.png" alt="I Have Design" className="h-6 w-auto" />
            <span className="font-medium">· Authority Gap Engine™</span>
          </div>
          <p>© {new Date().getFullYear()} I Have Design. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
