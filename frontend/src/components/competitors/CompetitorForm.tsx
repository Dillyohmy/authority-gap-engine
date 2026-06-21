import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Competitor, CompetitorFormData } from "@/lib/competitorsApi";

interface CompetitorFormProps {
  initial?: Partial<Competitor>;
  onSubmit: (data: Partial<CompetitorFormData>) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

const defaultForm: Partial<CompetitorFormData> = {
  business_name: "",
  website_url: "",
  gbp_url: "",
  competitor_type: "both",
  search_phrase: "",
  city_searched_from: "",
  observed_map_pack_rank: undefined,
  observed_organic_rank: undefined,
  review_count: undefined,
  star_rating: undefined,
  primary_gbp_category: "",
  secondary_gbp_categories: [],
  notes: "",
};

export default function CompetitorForm({ initial, onSubmit, onCancel, submitting }: CompetitorFormProps) {
  const [form, setForm] = useState<Partial<CompetitorFormData>>({ ...defaultForm, ...initial });
  const [secondaryCats, setSecondaryCats] = useState((initial?.secondary_gbp_categories ?? []).join(", "));

  function set<K extends keyof CompetitorFormData>(key: K, value: CompetitorFormData[K] | undefined) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cats = secondaryCats.split(",").map(s => s.trim()).filter(Boolean);
    await onSubmit({ ...form, secondary_gbp_categories: cats.length > 0 ? cats : null });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label className="text-[12px] font-semibold">Business Name *</Label>
          <Input
            value={form.business_name ?? ""}
            onChange={e => set("business_name", e.target.value)}
            placeholder="e.g. Smith Family Dental"
            required
            className="mt-1 text-[13px]"
          />
        </div>

        <div>
          <Label className="text-[12px] font-semibold">Website URL</Label>
          <Input
            value={form.website_url ?? ""}
            onChange={e => set("website_url", e.target.value || null)}
            placeholder="https://example.com"
            type="url"
            className="mt-1 text-[13px]"
          />
        </div>

        <div>
          <Label className="text-[12px] font-semibold">Google Business Profile URL</Label>
          <Input
            value={form.gbp_url ?? ""}
            onChange={e => set("gbp_url", e.target.value || null)}
            placeholder="https://maps.google.com/..."
            className="mt-1 text-[13px]"
          />
        </div>

        <div>
          <Label className="text-[12px] font-semibold">Competitor Type</Label>
          <Select
            value={form.competitor_type ?? "both"}
            onValueChange={v => set("competitor_type", v as CompetitorFormData["competitor_type"])}
          >
            <SelectTrigger className="mt-1 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="both">Map Pack + Organic</SelectItem>
              <SelectItem value="map_pack">Map Pack Only</SelectItem>
              <SelectItem value="organic">Organic Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-[12px] font-semibold">Search Phrase Used</Label>
          <Input
            value={form.search_phrase ?? ""}
            onChange={e => set("search_phrase", e.target.value || null)}
            placeholder="e.g. dentist near downtown"
            className="mt-1 text-[13px]"
          />
        </div>

        <div>
          <Label className="text-[12px] font-semibold">City Searched From</Label>
          <Input
            value={form.city_searched_from ?? ""}
            onChange={e => set("city_searched_from", e.target.value || null)}
            placeholder="e.g. Austin, TX"
            className="mt-1 text-[13px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[12px] font-semibold">Map Pack Rank</Label>
            <Input
              type="number"
              min={1} max={20}
              value={form.observed_map_pack_rank ?? ""}
              onChange={e => set("observed_map_pack_rank", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="1–20"
              className="mt-1 text-[13px]"
            />
          </div>
          <div>
            <Label className="text-[12px] font-semibold">Organic Rank</Label>
            <Input
              type="number"
              min={1} max={100}
              value={form.observed_organic_rank ?? ""}
              onChange={e => set("observed_organic_rank", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="1–100"
              className="mt-1 text-[13px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[12px] font-semibold">Review Count</Label>
            <Input
              type="number"
              min={0}
              value={form.review_count ?? ""}
              onChange={e => set("review_count", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 128"
              className="mt-1 text-[13px]"
            />
          </div>
          <div>
            <Label className="text-[12px] font-semibold">Star Rating</Label>
            <Input
              type="number"
              min={0} max={5} step={0.1}
              value={form.star_rating ?? ""}
              onChange={e => set("star_rating", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 4.7"
              className="mt-1 text-[13px]"
            />
          </div>
        </div>

        <div>
          <Label className="text-[12px] font-semibold">Primary GBP Category</Label>
          <Input
            value={form.primary_gbp_category ?? ""}
            onChange={e => set("primary_gbp_category", e.target.value || null)}
            placeholder="e.g. Dentist"
            className="mt-1 text-[13px]"
          />
        </div>

        <div>
          <Label className="text-[12px] font-semibold">Secondary GBP Categories</Label>
          <Input
            value={secondaryCats}
            onChange={e => setSecondaryCats(e.target.value)}
            placeholder="Comma separated, e.g. Orthodontist, Pediatric"
            className="mt-1 text-[13px]"
          />
        </div>

        <div className="sm:col-span-2">
          <Label className="text-[12px] font-semibold">Notes</Label>
          <Textarea
            value={form.notes ?? ""}
            onChange={e => set("notes", e.target.value || null)}
            placeholder="Any additional notes about this competitor..."
            rows={2}
            className="mt-1 text-[13px] resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={submitting} size="sm" className="font-bold text-[12px] h-9 px-5">
          {submitting ? "Saving…" : initial?.id ? "Save Changes" : "Add Competitor"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-[12px] h-9">
          Cancel
        </Button>
      </div>
    </form>
  );
}
