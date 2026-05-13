import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ExternalLink, Shield, BarChart3, Search, TrendingUp, Calendar, MapPin, Activity, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ScanRow {
  id: string;
  website_url: string;
  clinic_type: string;
  location: string;
  authority_gap_score: number;
  visibility_score: number;
  conversion_score: number;
  created_at: string;
}

const DashboardPage = () => {
  const { user } = useAuth();
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const fetchScans = async () => {
      const { data } = await supabase
        .from("scans")
        .select("id, website_url, clinic_type, location, authority_gap_score, visibility_score, conversion_score, created_at")
        .order("created_at", { ascending: false });
      setScans(data || []);
      setLoading(false);
    };
    fetchScans();
  }, [user]);

  // Build delta map: for each scan, find the previous scan of the same website
  const deltaMap = useMemo(() => {
    const map = new Map<string, number | null>();
    // Group by website_url, ordered newest first (already sorted)
    const byUrl = new Map<string, ScanRow[]>();
    for (const s of scans) {
      const arr = byUrl.get(s.website_url) || [];
      arr.push(s);
      byUrl.set(s.website_url, arr);
    }
    for (const [, arr] of byUrl) {
      for (let i = 0; i < arr.length; i++) {
        const prev = arr[i + 1]; // next in array = previous in time
        map.set(arr[i].id, prev ? arr[i].authority_gap_score - prev.authority_gap_score : null);
      }
    }
    return map;
  }, [scans]);

  // Chart data: all scans ordered by date ascending
  const chartData = useMemo(() => {
    return [...scans]
      .reverse()
      .map((s) => ({
        date: new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        score: s.authority_gap_score,
        url: s.website_url,
      }));
  }, [scans]);

  const getScoreColor = (s: number) =>
    s >= 70 ? "text-success" : s >= 40 ? "text-warning" : "text-destructive";
  const getScoreBg = (s: number) =>
    s >= 70 ? "bg-success/10" : s >= 40 ? "bg-warning/10" : "bg-destructive/10";
  const getScoreLabel = (s: number) =>
    s >= 75 ? "Strong" : s >= 55 ? "Moderate" : s >= 35 ? "Weak" : "Critical";

  const avgScore = scans.length > 0
    ? Math.round(scans.reduce((a, b) => a + b.authority_gap_score, 0) / scans.length)
    : 0;

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-secondary">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary animate-pulse" />
          <p className="text-[13px] text-muted-foreground font-medium">Loading your intelligence workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-secondary">
      {/* Dashboard header */}
      <div className="bg-ihd-nav text-primary-foreground">
        <div className="container max-w-5xl py-5 sm:py-6 px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-semibold mb-1.5">Intelligence Workspace</p>
              <h1 className="text-[20px] sm:text-[24px] font-extrabold leading-tight">Authority Gap Dashboard</h1>
              <p className="text-[12px] opacity-40 mt-1 font-medium">{scans.length} diagnostic {scans.length === 1 ? "report" : "reports"} generated</p>
            </div>
            <Link to="/scan">
              <Button size="sm" className="gap-2 rounded-lg font-bold text-[12px] px-5 h-10">
                <Search className="h-3.5 w-3.5" />
                New Scan
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container max-w-5xl px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* KPI summary */}
        {scans.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="shadow-elevated border-0 rounded-xl">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.15em]">Total Scans</p>
                <p className="text-[24px] font-extrabold text-foreground mt-1">{scans.length}</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Diagnostics completed</p>
              </CardContent>
            </Card>
            <Card className="shadow-elevated border-0 rounded-xl">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.15em]">Avg. Authority</p>
                <p className={`text-[24px] font-extrabold mt-1 ${getScoreColor(avgScore)}`}>{avgScore}<span className="text-[14px] text-muted-foreground/50">/100</span></p>
                <p className={`text-[11px] font-bold mt-1 ${getScoreColor(avgScore)}`}>{getScoreLabel(avgScore)}</p>
              </CardContent>
            </Card>
            <Card className="shadow-elevated border-0 rounded-xl">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.15em]">Latest Scan</p>
                <p className="text-[14px] font-bold text-foreground mt-1 truncate">{scans[0].website_url}</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">{new Date(scans[0].created_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
            <Card className="shadow-elevated border-0 rounded-xl">
              <CardContent className="p-4 sm:p-5">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.15em]">Best Score</p>
                <p className={`text-[24px] font-extrabold mt-1 ${getScoreColor(Math.max(...scans.map(s => s.authority_gap_score)))}`}>
                  {Math.max(...scans.map(s => s.authority_gap_score))}<span className="text-[14px] text-muted-foreground/50">/100</span>
                </p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">Highest authority rating</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Authority Score Trend */}
        {scans.length >= 2 && (
          <Card className="shadow-elevated border-0 rounded-xl">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-[15px] font-extrabold text-foreground">Authority Score Trend</h2>
                  <p className="text-[11px] text-muted-foreground/60 font-medium">Score progression across all scans</p>
                </div>
              </div>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      width={35}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                      formatter={(value: number) => [`${value}/100`, "Authority Score"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ fill: "hsl(var(--primary))", r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                      activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {scans.length === 0 ? (
          <Card className="shadow-elevated border-0 rounded-xl">
            <CardContent className="py-16 text-center space-y-5">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h3 className="text-[18px] font-extrabold text-foreground">No diagnostic reports yet</h3>
                <p className="text-[13px] text-muted-foreground/70 mt-2 max-w-sm mx-auto">Run your first Authority Gap scan to analyze your clinic's search visibility, conversion structure, and growth opportunity.</p>
              </div>
              <Link to="/scan">
                <Button size="lg" className="gap-2 rounded-lg font-bold text-[13px] px-6 h-12 mt-2">
                  Run Free Scan <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="h-1.5 w-5 bg-ihd-dark-green rounded-full" />
              <span className="text-[11px] uppercase tracking-[0.15em] font-extrabold text-foreground">Diagnostic Reports</span>
            </div>
            <div className="space-y-3">
              {scans.map((scan) => {
                const delta = deltaMap.get(scan.id);
                return (
                  <Card key={scan.id} className="shadow-elevated border-0 rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="flex items-stretch">
                      {/* Score column */}
                      <div className={`flex flex-col items-center justify-center px-5 sm:px-6 py-5 ${getScoreBg(scan.authority_gap_score)} border-r min-w-[80px]`}>
                        <span className={`text-[28px] font-extrabold leading-none ${getScoreColor(scan.authority_gap_score)}`}>
                          {scan.authority_gap_score}
                        </span>
                        <span className="text-[9px] text-muted-foreground/50 font-semibold mt-1">of 100</span>
                        <span className={`text-[9px] font-extrabold uppercase tracking-[0.1em] mt-1.5 ${getScoreColor(scan.authority_gap_score)}`}>
                          {getScoreLabel(scan.authority_gap_score)}
                        </span>
                        {/* Delta indicator */}
                        {delta !== null && delta !== undefined && (
                          <div className={`flex items-center gap-0.5 mt-2 text-[10px] font-bold ${
                            delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground/50"
                          }`}>
                            {delta > 0 ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : delta < 0 ? (
                              <ArrowDownRight className="h-3 w-3" />
                            ) : (
                              <Minus className="h-3 w-3" />
                            )}
                            <span>{delta > 0 ? `+${delta}` : delta === 0 ? "0" : delta}</span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-bold text-foreground truncate">{scan.website_url}</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-2">
                            <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                              <BarChart3 className="h-3 w-3" />{scan.clinic_type}
                            </span>
                            <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{scan.location}
                            </span>
                            <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />{new Date(scan.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {/* Mini score indicators */}
                          <div className="flex items-center gap-4 mt-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className={`h-1.5 w-1.5 rounded-full ${scan.visibility_score >= 28 ? "bg-success" : scan.visibility_score >= 16 ? "bg-warning" : "bg-destructive"}`} />
                              <span className="text-[10px] text-muted-foreground/50 font-medium">Vis {scan.visibility_score}/40</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className={`h-1.5 w-1.5 rounded-full ${scan.conversion_score >= 28 ? "bg-success" : scan.conversion_score >= 16 ? "bg-warning" : "bg-destructive"}`} />
                              <span className="text-[10px] text-muted-foreground/50 font-medium">Conv {scan.conversion_score}/40</span>
                            </div>
                          </div>
                        </div>

                        <Link to={`/results?scanId=${scan.id}`}>
                          <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground text-[12px] rounded-lg font-bold gap-1.5 h-9 px-4">
                            View Report <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
