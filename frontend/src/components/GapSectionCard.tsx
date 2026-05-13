import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ScoreRing from "./ScoreRing";
import FindingCard from "./FindingCard";
import type { GapSection } from "@/lib/scoring";

interface GapSectionCardProps {
  title: string;
  icon: React.ReactNode;
  section: GapSection;
  showAll?: boolean;
}

const GapSectionCard = ({ title, icon, section, showAll }: GapSectionCardProps) => {
  const visibleFindings = showAll ? section.findings : section.findings.slice(0, 2);
  const hiddenCount = section.findings.length - visibleFindings.length;

  return (
    <Card className="shadow-card border">
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded bg-accent text-accent-foreground">
          {icon}
        </div>
        <div className="flex-1">
          <CardTitle className="text-ihd-h3">{title}</CardTitle>
        </div>
        <ScoreRing score={section.score} maxScore={section.maxScore} size={64} />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-ihd-body text-muted-foreground">{section.summary}</p>

        {/* Findings table header — IHD dark green */}
        {visibleFindings.length > 0 && (
          <div className="rounded overflow-hidden border">
            <div className="bg-ihd-dark-green px-4 py-2">
              <span className="text-ihd-small font-bold text-primary-foreground">Findings</span>
            </div>
            <div className="divide-y">
              {visibleFindings.map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
            </div>
          </div>
        )}

        {hiddenCount > 0 && (
          <div className="rounded border border-dashed bg-secondary p-3 text-center">
            <span className="text-ihd-small text-muted-foreground">
              + {hiddenCount} more findings in full report
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GapSectionCard;
