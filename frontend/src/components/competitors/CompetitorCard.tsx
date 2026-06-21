import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Star, MapPin, Search, Building2, ExternalLink,
  RefreshCw, Trash2, Pencil, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, Clock
} from "lucide-react";
import type { Competitor } from "@/lib/competitorsApi";
import CompetitorForm from "./CompetitorForm";
import type { CompetitorFormData } from "@/lib/competitorsApi";

interface CompetitorCardProps {
  competitor: Competitor;
  onUpdate: (id: string, data: Partial<CompetitorFormData>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onStartCrawl: (id: string) => Promise<void>;
}

const TYPE_LABELS: Record<string, string> = {
  both: "Map Pack + Organic",
  map_pack: "Map Pack",
  organic: "Organic",
};

const TYPE_COLORS: Record<string, string> = {
  both: "bg-primary/10 text-primary",
  map_pack: "bg-orange-100 text-orange-700",
  organic: "bg-green-100 text-green-700",
};

function CrawlStatusBadge({ status }: { status: Competitor["crawl_status"] }) {
  const configs = {
    not_started: { icon: Clock, label: "Not crawled", className: "bg-muted text-muted-foreground" },
    queued: { icon: Clock, label: "Queued", className: "bg-blue-100 text-blue-700" },
    processing: { icon: Loader2, label: "Crawling…", className: "bg-yellow-100 text-yellow-700" },
    completed: { icon: CheckCircle2, label: "Crawled", className: "bg-green-100 text-green-700" },
    failed: { icon: XCircle, label: "Failed", className: "bg-red-100 text-red-700" },
  };
  const cfg = configs[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.className}`}>
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
}

export default function CompetitorCard({ competitor, onUpdate, onDelete, onStartCrawl }: CompetitorCardProps) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(data: Partial<CompetitorFormData>) {
    setSubmitting(true);
    try { await onUpdate(competitor.id, data); setEditing(false); }
    finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${competitor.business_name}? This cannot be undone.`)) return;
    setDeleting(true);
    try { await onDelete(competitor.id); }
    finally { setDeleting(false); }
  }

  async function handleCrawl() {
    setCrawling(true);
    try { await onStartCrawl(competitor.id); }
    finally { setCrawling(false); }
  }

  if (editing) {
    return (
      <Card className="border-0 shadow-elevated rounded-xl">
        <CardContent className="p-5">
          <p className="text-[12px] font-extrabold uppercase tracking-wide text-primary mb-4">Edit Competitor</p>
          <CompetitorForm
            initial={competitor}
            onSubmit={handleSave}
            onCancel={() => setEditing(false)}
            submitting={submitting}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-elevated rounded-xl overflow-hidden">
      <CardContent className="p-0">
        {/* Header row */}
        <div className="flex items-start gap-3 p-4 pb-3">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-extrabold text-foreground leading-tight">{competitor.business_name}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[competitor.competitor_type]}`}>
                {TYPE_LABELS[competitor.competitor_type]}
              </span>
              <CrawlStatusBadge status={competitor.crawl_status} />
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              {competitor.website_url && (
                <a href={competitor.website_url} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-primary flex items-center gap-1 hover:underline">
                  <Globe className="h-3 w-3" /> Website <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
              {competitor.gbp_url && (
                <a href={competitor.gbp_url} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-primary flex items-center gap-1 hover:underline">
                  <MapPin className="h-3 w-3" /> GBP <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
              {competitor.review_count != null && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {competitor.star_rating ?? "?"} · {competitor.review_count} reviews
                </span>
              )}
              {competitor.observed_map_pack_rank != null && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Map #{competitor.observed_map_pack_rank}
                </span>
              )}
              {competitor.observed_organic_rank != null && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Search className="h-3 w-3" /> Organic #{competitor.observed_organic_rank}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-border/50 pt-3">
            {competitor.search_phrase && (
              <div>
                <p className="text-[10px] text-muted-foreground">Search phrase</p>
                <p className="text-[12px] font-medium">{competitor.search_phrase}</p>
              </div>
            )}
            {competitor.city_searched_from && (
              <div>
                <p className="text-[10px] text-muted-foreground">City</p>
                <p className="text-[12px] font-medium">{competitor.city_searched_from}</p>
              </div>
            )}
            {competitor.primary_gbp_category && (
              <div>
                <p className="text-[10px] text-muted-foreground">GBP Category</p>
                <p className="text-[12px] font-medium">{competitor.primary_gbp_category}</p>
              </div>
            )}
            {competitor.secondary_gbp_categories && competitor.secondary_gbp_categories.length > 0 && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-[10px] text-muted-foreground">Secondary Categories</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {competitor.secondary_gbp_categories.map(c => (
                    <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                  ))}
                </div>
              </div>
            )}
            {competitor.notes && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-[10px] text-muted-foreground">Notes</p>
                <p className="text-[12px] text-muted-foreground">{competitor.notes}</p>
              </div>
            )}
            {competitor.last_crawled_at && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-[10px] text-muted-foreground">Last crawled</p>
                <p className="text-[12px]">{new Date(competitor.last_crawled_at).toLocaleString()}</p>
              </div>
            )}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/50 bg-muted/20">
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[11px] text-muted-foreground flex items-center gap-1 hover:text-foreground"
          >
            {expanded ? <><ChevronUp className="h-3 w-3" /> Less</> : <><ChevronDown className="h-3 w-3" /> Details</>}
          </button>
          <div className="flex-1" />
          {competitor.website_url && competitor.crawl_status !== "processing" && competitor.crawl_status !== "queued" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCrawl}
              disabled={crawling}
              className="h-7 text-[11px] font-semibold gap-1 px-3"
            >
              <RefreshCw className={`h-3 w-3 ${crawling ? "animate-spin" : ""}`} />
              {competitor.crawl_status === "completed" ? "Re-crawl" : "Crawl Site"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7 w-7 p-0 text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} disabled={deleting}
            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
