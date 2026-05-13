import type { ScanFinding } from "@/types/scanReport";
import SeverityBadge from "./SeverityBadge";

interface FindingCardProps {
  finding: ScanFinding;
  locked?: boolean;
}

const FindingCard = ({ finding, locked }: FindingCardProps) => (
  <div className="flex items-start gap-3 px-4 py-3 bg-card">
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-ihd-small text-card-foreground">{finding.label}</span>
        <SeverityBadge severity={finding.severity} />
      </div>
      <p className={`text-ihd-small text-muted-foreground ${locked ? "blur-sm select-none" : ""}`}>
        {finding.description}
      </p>
    </div>
  </div>
);

export default FindingCard;
