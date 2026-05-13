import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, CalendarCheck, Phone, ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { trackEvent } from "@/lib/tracking";

const StrategyCallPage = () => {
  useEffect(() => {
    trackEvent("strategy_booking_viewed");
  }, []);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-secondary">
      {/* Header */}
      <div className="bg-ihd-nav text-primary-foreground">
        <div className="container max-w-3xl py-6 sm:py-8 px-4">
          <Link to="/" className="inline-flex items-center gap-1.5 text-[11px] text-primary-foreground/50 hover:text-primary-foreground/80 font-medium mb-4 transition-colors">
            <ArrowLeft className="h-3 w-3" /> Back
          </Link>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-semibold mb-2">Authority Gap Engine™</p>
            <h1 className="text-[22px] sm:text-[28px] font-extrabold leading-tight">
              Review Your Authority Gap Strategy
            </h1>
            <p className="text-[13px] opacity-60 mt-2 max-w-lg leading-relaxed">
              Based on your results, we'll walk through exactly how to improve patient acquisition.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container max-w-3xl px-4 py-8 sm:py-10 space-y-8">
        {/* What's included */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-elevated border-0 rounded-xl">
            <CardContent className="p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-[16px] font-extrabold text-foreground">What's Included</h2>
                  <p className="text-[11px] text-muted-foreground/60 font-medium">30-minute strategic review session</p>
                </div>
              </div>
              <ul className="space-y-3">
                {[
                  "Walkthrough of your Authority Gap diagnostic results",
                  "Prioritized action plan for visibility and conversion gaps",
                  "Revenue opportunity modeling specific to your market",
                  "Implementation timeline and resource requirements",
                  "Q&A on strategy, competitive positioning, and next steps",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[13px] text-foreground/80 leading-relaxed">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* Calendar embed placeholder */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="shadow-elevated border-0 rounded-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-center gap-2.5">
                  <CalendarCheck className="h-4.5 w-4.5 text-primary" />
                  <h2 className="text-[15px] font-extrabold text-foreground">Select a Time</h2>
                </div>
              </div>

              {/* Calendar iframe container — replace src with your scheduling tool URL */}
              <div className="w-full bg-muted/30 border-t border-b border-border/30">
                {/* 
                  To connect a real calendar, replace the placeholder below with:
                  <iframe 
                    src="https://calendly.com/your-link" 
                    className="w-full border-0" 
                    style={{ minHeight: "660px" }}
                    title="Schedule Strategy Review"
                  />
                */}
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <CalendarCheck className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-[14px] font-bold text-foreground">Calendar Integration</p>
                  <p className="text-[12px] text-muted-foreground/60 max-w-xs leading-relaxed">
                    Scheduling will be available here once your calendar tool is connected.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Fallback CTA */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="shadow-elevated border-0 rounded-xl border-t-4 border-t-primary">
            <CardContent className="py-10 sm:py-12 text-center space-y-5 px-6">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-[17px] font-extrabold text-foreground">Prefer a Direct Conversation?</h3>
              <p className="text-[13px] text-muted-foreground/70 max-w-md mx-auto leading-relaxed">
                If the calendar doesn't work for your schedule, request a call and we'll reach out within one business day.
              </p>
              <Button
                size="lg"
                variant="outline"
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-2 text-[13px] rounded-lg px-6 h-12 font-bold"
                onClick={() => {
                  trackEvent("strategy_call_requested");
                  window.location.href = "mailto:hello@ihavedesign.com?subject=Strategy%20Review%20Request";
                }}
              >
                <Phone className="h-4 w-4" />
                Request a Call
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default StrategyCallPage;
