import { Card, CardContent } from "@/components/ui/card";

interface ExecutiveSummaryProps {
  websiteUrl: string;
  clinicType: string;
  location: string;
  score: number;
  summaryText: string;
}

const ExecutiveSummary = ({ websiteUrl, clinicType, location, score, summaryText }: ExecutiveSummaryProps) => {
  const scoreLabel = score >= 75 ? "Strong" : score >= 55 ? "Moderate" : score >= 35 ? "Weak" : "Critical";
  const scoreColor = score >= 75 ? "text-success" : score >= 55 ? "text-warning" : "text-destructive";

  return (
    <Card className="shadow-elevated overflow-hidden border-0 rounded-xl">
      <div className="bg-ihd-dark-green px-5 sm:px-6 py-4">
        <h2 className="text-[15px] font-extrabold text-primary-foreground tracking-wide">Executive Summary</h2>
      </div>
      <CardContent className="p-5 sm:p-6 space-y-5">
        {/* Meta row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b">
          <MetaField label="Website" value={websiteUrl} truncate />
          <MetaField label="Clinic Type" value={clinicType} />
          <MetaField label="Location" value={location} />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-bold mb-1">Rating</p>
            <p className={`text-[13px] font-extrabold ${scoreColor}`}>{score}/100 — {scoreLabel}</p>
          </div>
        </div>
        {/* Summary */}
        <div className="bg-secondary/40 rounded-xl px-5 py-4 border-l-4 border-primary">
          <p className="text-[13px] text-foreground/75 leading-[1.75]">{summaryText}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const MetaField = ({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) => (
  <div>
    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-bold mb-1">{label}</p>
    <p className={`text-[13px] font-semibold text-foreground ${truncate ? "truncate" : ""}`}>{value}</p>
  </div>
);

export default ExecutiveSummary;
