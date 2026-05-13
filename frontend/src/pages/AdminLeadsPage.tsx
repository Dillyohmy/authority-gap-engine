import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Activity, Users, Star, TrendingUp, MapPin, Globe, Calendar, Mail } from "lucide-react";

interface LeadRow {
  email: string;
  name: string | null;
  website_url: string;
  clinic_type: string;
  location: string;
  wants_strategy_review: boolean;
  created_at: string;
  authority_gap_score: number | null;
  estimated_revenue_low: number | null;
  estimated_revenue_high: number | null;
}

const AdminLeadsPage = () => {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [highIntentOnly, setHighIntentOnly] = useState(false);

  useEffect(() => {
    const fetchLeads = async () => {
      // Fetch leads with optional scan data via separate queries (no foreign key relationship)
      const { data: leadsData } = await supabase
        .from("leads")
        .select("email, name, website_url, clinic_type, location, wants_strategy_review, created_at")
        .order("created_at", { ascending: false });

      if (!leadsData) {
        setLoading(false);
        return;
      }

      // Fetch latest scan per website_url for score enrichment
      const { data: scansData } = await supabase
        .from("scans")
        .select("website_url, authority_gap_score, estimated_revenue_low, estimated_revenue_high");

      const scanMap = new Map<string, { authority_gap_score: number; estimated_revenue_low: number; estimated_revenue_high: number }>();
      if (scansData) {
        for (const s of scansData) {
          scanMap.set(s.website_url, s);
        }
      }

      const enriched: LeadRow[] = leadsData.map((l) => {
        const scan = scanMap.get(l.website_url);
        return {
          ...l,
          authority_gap_score: scan?.authority_gap_score ?? null,
          estimated_revenue_low: scan?.estimated_revenue_low ?? null,
          estimated_revenue_high: scan?.estimated_revenue_high ?? null,
        };
      });

      setLeads(enriched);
      setLoading(false);
    };
    fetchLeads();
  }, []);

  const filtered = highIntentOnly
    ? leads.filter((l) => l.wants_strategy_review)
    : leads;

  const highIntentCount = leads.filter((l) => l.wants_strategy_review).length;

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-secondary">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary animate-pulse" />
          <p className="text-[13px] text-muted-foreground font-medium">Loading lead intelligence…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-secondary">
      {/* Header */}
      <div className="bg-ihd-nav text-primary-foreground">
        <div className="container max-w-6xl py-5 sm:py-6 px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-semibold mb-1.5">Internal</p>
              <h1 className="text-[20px] sm:text-[24px] font-extrabold leading-tight">Lead Intelligence</h1>
              <p className="text-[12px] opacity-40 mt-1 font-medium">
                {leads.length} {leads.length === 1 ? "lead" : "leads"} captured · {highIntentCount} high intent
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl px-4 py-6 sm:py-8 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="shadow-elevated border-0 rounded-xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.15em]">Total Leads</p>
              <p className="text-[24px] font-extrabold text-foreground mt-1">{leads.length}</p>
            </CardContent>
          </Card>
          <Card className="shadow-elevated border-0 rounded-xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.15em]">High Intent</p>
              <p className="text-[24px] font-extrabold text-primary mt-1">{highIntentCount}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">Strategy review requested</p>
            </CardContent>
          </Card>
          <Card className="shadow-elevated border-0 rounded-xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.15em]">Conversion Rate</p>
              <p className="text-[24px] font-extrabold text-foreground mt-1">
                {leads.length > 0 ? Math.round((highIntentCount / leads.length) * 100) : 0}%
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">High intent ratio</p>
            </CardContent>
          </Card>
          <Card className="shadow-elevated border-0 rounded-xl">
            <CardContent className="p-4 sm:p-5">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.15em]">Latest Lead</p>
              <p className="text-[14px] font-bold text-foreground mt-1 truncate">
                {leads.length > 0 ? leads[0].email : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                {leads.length > 0 ? new Date(leads[0].created_at).toLocaleDateString() : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <Switch id="high-intent" checked={highIntentOnly} onCheckedChange={setHighIntentOnly} />
          <Label htmlFor="high-intent" className="text-[12px] font-semibold text-muted-foreground cursor-pointer">
            Show high intent only ({highIntentCount})
          </Label>
        </div>

        {/* Lead list */}
        {filtered.length === 0 ? (
          <Card className="shadow-elevated border-0 rounded-xl">
            <CardContent className="py-16 text-center">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-[16px] font-extrabold text-foreground mt-4">No leads yet</h3>
              <p className="text-[13px] text-muted-foreground/70 mt-2">Leads will appear here when visitors unlock their reports.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((lead, i) => (
              <Card key={`${lead.email}-${i}`} className="shadow-elevated border-0 rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                <div className="flex items-stretch">
                  {/* Intent indicator */}
                  <div className={`flex flex-col items-center justify-center px-4 sm:px-5 py-4 border-r min-w-[64px] ${
                    lead.wants_strategy_review ? "bg-primary/10" : "bg-muted/30"
                  }`}>
                    <Star className={`h-5 w-5 ${lead.wants_strategy_review ? "text-primary fill-primary" : "text-muted-foreground/30"}`} />
                    <span className={`text-[8px] font-extrabold uppercase tracking-[0.1em] mt-1 ${
                      lead.wants_strategy_review ? "text-primary" : "text-muted-foreground/40"
                    }`}>
                      {lead.wants_strategy_review ? "High" : "Low"}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14px] font-bold text-foreground">{lead.name || lead.email}</span>
                          {lead.wants_strategy_review && (
                            <Badge variant="default" className="text-[9px] px-2 py-0.5 font-bold rounded-md">
                              Strategy Review
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Mail className="h-3 w-3 text-muted-foreground/40" />
                          <span className="text-[12px] text-muted-foreground/70">{lead.email}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-2.5">
                          <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                            <Globe className="h-3 w-3" />{lead.website_url}
                          </span>
                          <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />{lead.location}
                          </span>
                          <span className="text-[11px] text-muted-foreground/60">{lead.clinic_type}</span>
                          <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />{new Date(lead.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Score + Revenue */}
                      <div className="flex items-center gap-3 sm:gap-4 mt-2 sm:mt-0">
                        {lead.authority_gap_score !== null && (
                          <div className="text-center">
                            <p className={`text-[20px] font-extrabold leading-none ${
                              lead.authority_gap_score >= 70 ? "text-success" : lead.authority_gap_score >= 40 ? "text-warning" : "text-destructive"
                            }`}>
                              {lead.authority_gap_score}
                            </p>
                            <p className="text-[9px] text-muted-foreground/50 font-semibold mt-0.5">Score</p>
                          </div>
                        )}
                        {lead.estimated_revenue_low !== null && lead.estimated_revenue_high !== null && (
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-primary" />
                              <span className="text-[12px] font-bold text-foreground">
                                ${lead.estimated_revenue_low.toLocaleString()}–${lead.estimated_revenue_high.toLocaleString()}
                              </span>
                            </div>
                            <p className="text-[9px] text-muted-foreground/50 font-semibold mt-0.5">Est. monthly</p>
                          </div>
                        )}
                        {lead.authority_gap_score === null && (
                          <span className="text-[10px] text-muted-foreground/40 font-medium">No scan data</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLeadsPage;
