import { useEffect, useState, useCallback, useRef } from "react";
import { listUploads } from "@/lib/uploadsApi";
import { getParseStatus } from "@/lib/uploadsApi";
import type { UploadedFile } from "@/lib/uploadsApi";
import { UploadCategoryCard } from "./UploadCategoryCard";

// Category definitions mirrored from backend (avoid an extra API call)
// Keep in sync with backend/src/config/uploadCategories.ts
const CATEGORIES = [
  // Google Search Console
  { id: "gsc_queries", label: "Search Console — Queries", description: "Queries export from Google Search Console Performance", helpText: "In Search Console → Performance → Export → Download CSV. Include queries with clicks, impressions, CTR, and average position.", required: true, acceptedExtensions: [".csv"], maxSizeBytes: 10 * 1024 * 1024, fileType: "csv", auditArea: "Google Search Console" },
  { id: "gsc_pages", label: "Search Console — Pages", description: "Pages export from Google Search Console Performance", helpText: "In Search Console → Performance → Pages tab → Export → Download CSV.", required: true, acceptedExtensions: [".csv"], maxSizeBytes: 10 * 1024 * 1024, fileType: "csv", auditArea: "Google Search Console" },
  { id: "gsc_devices", label: "Search Console — Devices", description: "Devices export from Google Search Console", helpText: "In Search Console → Performance → Devices tab → Export CSV.", required: false, acceptedExtensions: [".csv"], maxSizeBytes: 10 * 1024 * 1024, fileType: "csv", auditArea: "Google Search Console" },
  { id: "gsc_countries", label: "Search Console — Countries", description: "Countries export from Google Search Console", helpText: "In Search Console → Performance → Countries tab → Export CSV.", required: false, acceptedExtensions: [".csv"], maxSizeBytes: 10 * 1024 * 1024, fileType: "csv", auditArea: "Google Search Console" },
  // Google Analytics
  { id: "ga_traffic_acquisition", label: "GA — Traffic Acquisition", description: "Traffic Acquisition report from Google Analytics", helpText: "In GA4 → Reports → Acquisition → Traffic Acquisition → Export.", required: true, acceptedExtensions: [".csv"], maxSizeBytes: 10 * 1024 * 1024, fileType: "csv", auditArea: "Google Analytics" },
  { id: "ga_landing_pages", label: "GA — Landing Pages", description: "Landing Pages report from Google Analytics", helpText: "In GA4 → Reports → Engagement → Landing Page → Export.", required: true, acceptedExtensions: [".csv"], maxSizeBytes: 10 * 1024 * 1024, fileType: "csv", auditArea: "Google Analytics" },
  { id: "ga_events", label: "GA — Events", description: "Events report from Google Analytics", helpText: "In GA4 → Reports → Engagement → Events → Export.", required: false, acceptedExtensions: [".csv"], maxSizeBytes: 10 * 1024 * 1024, fileType: "csv", auditArea: "Google Analytics" },
  { id: "ga_conversions", label: "GA — Conversions", description: "Conversions report from Google Analytics", helpText: "In GA4 → Reports → Conversions → Export.", required: false, acceptedExtensions: [".csv"], maxSizeBytes: 10 * 1024 * 1024, fileType: "csv", auditArea: "Google Analytics" },
  // Competitors
  { id: "keyword_rankings", label: "Keyword Rankings", description: "Keyword ranking export from your rank tracking tool", helpText: "Export from SEMrush, Ahrefs, Moz, BrightLocal, or similar. Should include keyword, position, URL, and search volume.", required: false, acceptedExtensions: [".csv"], maxSizeBytes: 10 * 1024 * 1024, fileType: "csv", auditArea: "Competitors" },
  { id: "competitor_screenshot", label: "Competitor Screenshot", description: "Screenshot of a competitor's website or listing", helpText: "Screenshots of competitor homepages, service pages, or GBP listings.", required: false, acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"], maxSizeBytes: 10 * 1024 * 1024, fileType: "image", auditArea: "Competitors" },
  // Google Business Profile
  { id: "gbp_screenshot", label: "Google Business Profile Screenshot", description: "Screenshot of your Google Business Profile listing", helpText: "Screenshot of your full Google Business Profile as it appears in search.", required: false, acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"], maxSizeBytes: 10 * 1024 * 1024, fileType: "image", auditArea: "Google Business Profile" },
  { id: "map_pack_screenshot", label: "Map Pack Screenshot", description: "Screenshot of the local map pack for your main search term", helpText: "Search for your main service + city and screenshot the map pack.", required: false, acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"], maxSizeBytes: 10 * 1024 * 1024, fileType: "image", auditArea: "Google Business Profile" },
  // Reviews
  { id: "reviews_screenshot", label: "Google Reviews Screenshot", description: "Screenshot of your Google reviews panel", helpText: "Screenshot showing your reviews count, star rating, and recent reviews.", required: false, acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"], maxSizeBytes: 10 * 1024 * 1024, fileType: "image", auditArea: "Reviews and Testimonials" },
  { id: "testimonial_file", label: "Testimonials", description: "Patient testimonials or reviews (CSV, PDF, or image)", helpText: "Collected testimonials, exported reviews CSV, or screenshots of patient feedback.", required: false, acceptedExtensions: [".csv", ".pdf", ".png", ".jpg", ".jpeg", ".webp"], maxSizeBytes: 25 * 1024 * 1024, fileType: "document", auditArea: "Reviews and Testimonials" },
  // Photos
  { id: "business_photo", label: "Business / Clinic Photo", description: "Photo of your clinic, office, or facility", helpText: "Interior or exterior photos of your clinic.", required: false, acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"], maxSizeBytes: 10 * 1024 * 1024, fileType: "image", auditArea: "Photos" },
  { id: "provider_photo", label: "Provider / Team Photo", description: "Photo of providers, staff, or the full team", helpText: "Professional headshots or team photos.", required: false, acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"], maxSizeBytes: 10 * 1024 * 1024, fileType: "image", auditArea: "Photos" },
  { id: "equipment_photo", label: "Equipment Photo", description: "Photo of specialized equipment or technology", helpText: "Photos of diagnostic equipment, treatment technology, or specialty tools.", required: false, acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"], maxSizeBytes: 10 * 1024 * 1024, fileType: "image", auditArea: "Photos" },
  // Compliance
  { id: "compliance_document", label: "Compliance Document", description: "HIPAA, ADA, privacy policy, or compliance documentation", helpText: "Privacy policy, HIPAA notice, accessibility statement, or other compliance docs.", required: false, acceptedExtensions: [".pdf", ".png", ".jpg", ".jpeg"], maxSizeBytes: 25 * 1024 * 1024, fileType: "pdf", auditArea: "Compliance" },
  // General
  { id: "general_supporting_document", label: "General Supporting Document", description: "Any other file relevant to the audit", helpText: "Any other supporting file for the audit.", required: false, acceptedExtensions: [".pdf", ".csv", ".png", ".jpg", ".jpeg", ".webp"], maxSizeBytes: 25 * 1024 * 1024, fileType: "document", auditArea: "General Documents" },
] as const;

const AUDIT_AREAS = [
  "Google Search Console",
  "Google Analytics",
  "Competitors",
  "Google Business Profile",
  "Reviews and Testimonials",
  "Photos",
  "Compliance",
  "General Documents",
] as const;

interface Props {
  projectId: string;
  token: string;
}

export function UploadCenter({ projectId, token }: Props) {
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUploads = useCallback(async () => {
    try {
      const { uploads: data } = await listUploads(projectId, token);
      setUploads(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load uploads");
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  // Poll parse status for any processing files
  useEffect(() => {
    const processingIds = uploads
      .filter((u) => u.parse_status === "pending" || u.parse_status === "processing")
      .map((u) => u.id);

    if (processingIds.length === 0) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const updates = await Promise.all(
          processingIds.map((id) => getParseStatus(projectId, id, token))
        );
        setUploads((prev) =>
          prev.map((u) => {
            const update = updates.find((up) => up.id === u.id);
            if (update) return { ...u, parse_status: update.parse_status, parse_error: update.parse_error };
            return u;
          })
        );
        // Stop polling if all done
        const stillProcessing = updates.some(
          (u) => u.parse_status === "pending" || u.parse_status === "processing"
        );
        if (!stillProcessing && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // silent
      }
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [uploads, projectId, token]);

  const handleUploadComplete = useCallback((file: UploadedFile) => {
    setUploads((prev) => {
      const existing = prev.find((u) => u.file_category === file.file_category);
      if (existing) return prev.map((u) => (u.id === existing.id ? file : u));
      return [file, ...prev];
    });
  }, []);

  const handleUploadDeleted = useCallback((uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  }, []);

  const uploadsByCategory = new Map(uploads.map((u) => [u.file_category, u]));

  const requiredTotal = CATEGORIES.filter((c) => c.required).length;
  const requiredDone = CATEGORIES.filter(
    (c) => c.required && uploadsByCategory.get(c.id)?.upload_status === "uploaded"
  ).length;
  const totalUploaded = uploads.filter((u) => u.upload_status === "uploaded").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mr-2" />
        Loading uploads…
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-sm py-8 text-center">{error}</p>;
  }

  return (
    <div className="space-y-8">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{totalUploaded}</p>
          <p className="text-xs text-slate-500 mt-1">Files Uploaded</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
          <p className={`text-2xl font-bold ${requiredDone === requiredTotal ? "text-green-600" : "text-amber-600"}`}>
            {requiredDone}/{requiredTotal}
          </p>
          <p className="text-xs text-slate-500 mt-1">Required Files</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-center">
          <p className={`text-2xl font-bold ${requiredDone === requiredTotal ? "text-green-600" : "text-amber-600"}`}>
            {requiredTotal > 0 ? Math.round((requiredDone / requiredTotal) * 100) : 100}%
          </p>
          <p className="text-xs text-slate-500 mt-1">Upload Readiness</p>
        </div>
      </div>

      {/* Categories grouped by audit area */}
      {AUDIT_AREAS.map((area) => {
        const areaCategories = CATEGORIES.filter((c) => c.auditArea === area);
        if (areaCategories.length === 0) return null;
        return (
          <section key={area}>
            <h2 className="text-base font-semibold text-slate-700 mb-3 pb-1 border-b border-slate-200">
              {area}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {areaCategories.map((cat) => (
                <UploadCategoryCard
                  key={cat.id}
                  projectId={projectId}
                  token={token}
                  category={cat}
                  currentUpload={uploadsByCategory.get(cat.id) ?? null}
                  onUploadComplete={handleUploadComplete}
                  onUploadDeleted={handleUploadDeleted}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
