export type UploadCategory =
  | "gsc_queries"
  | "gsc_pages"
  | "gsc_devices"
  | "gsc_countries"
  | "ga_traffic_acquisition"
  | "ga_landing_pages"
  | "ga_events"
  | "ga_conversions"
  | "keyword_rankings"
  | "gbp_screenshot"
  | "reviews_screenshot"
  | "map_pack_screenshot"
  | "competitor_screenshot"
  | "testimonial_file"
  | "business_photo"
  | "provider_photo"
  | "equipment_photo"
  | "compliance_document"
  | "general_supporting_document";

export type FileType = "csv" | "pdf" | "image" | "document";

export interface UploadCategoryDef {
  id: UploadCategory;
  label: string;
  description: string;
  fileType: FileType;
  acceptedMimeTypes: string[];
  acceptedExtensions: string[];
  maxSizeBytes: number;
  required: boolean;
  /** Whether this category triggers CSV parsing */
  parseable: boolean;
  auditArea: string;
  helpText?: string;
}

const MB = 1024 * 1024;

export const UPLOAD_CATEGORIES: Record<UploadCategory, UploadCategoryDef> = {
  gsc_queries: {
    id: "gsc_queries",
    label: "Search Console — Queries",
    description: "Queries export from Google Search Console Performance",
    fileType: "csv",
    acceptedMimeTypes: ["text/csv", "application/vnd.ms-excel", "application/csv"],
    acceptedExtensions: [".csv"],
    maxSizeBytes: 10 * MB,
    required: true,
    parseable: true,
    auditArea: "Google Search Console",
    helpText:
      "In Search Console → Performance → Export → Download CSV. Include queries with clicks, impressions, CTR, and average position.",
  },
  gsc_pages: {
    id: "gsc_pages",
    label: "Search Console — Pages",
    description: "Pages export from Google Search Console Performance",
    fileType: "csv",
    acceptedMimeTypes: ["text/csv", "application/vnd.ms-excel", "application/csv"],
    acceptedExtensions: [".csv"],
    maxSizeBytes: 10 * MB,
    required: true,
    parseable: true,
    auditArea: "Google Search Console",
    helpText:
      "In Search Console → Performance → Pages tab → Export → Download CSV. Shows which pages are ranking and their traffic.",
  },
  gsc_devices: {
    id: "gsc_devices",
    label: "Search Console — Devices",
    description: "Devices export from Google Search Console Performance",
    fileType: "csv",
    acceptedMimeTypes: ["text/csv", "application/vnd.ms-excel", "application/csv"],
    acceptedExtensions: [".csv"],
    maxSizeBytes: 10 * MB,
    required: false,
    parseable: true,
    auditArea: "Google Search Console",
    helpText: "In Search Console → Performance → Devices tab → Export CSV.",
  },
  gsc_countries: {
    id: "gsc_countries",
    label: "Search Console — Countries",
    description: "Countries export from Google Search Console Performance",
    fileType: "csv",
    acceptedMimeTypes: ["text/csv", "application/vnd.ms-excel", "application/csv"],
    acceptedExtensions: [".csv"],
    maxSizeBytes: 10 * MB,
    required: false,
    parseable: true,
    auditArea: "Google Search Console",
    helpText: "In Search Console → Performance → Countries tab → Export CSV.",
  },
  ga_traffic_acquisition: {
    id: "ga_traffic_acquisition",
    label: "Google Analytics — Traffic Acquisition",
    description: "Traffic Acquisition report export from Google Analytics",
    fileType: "csv",
    acceptedMimeTypes: ["text/csv", "application/vnd.ms-excel", "application/csv"],
    acceptedExtensions: [".csv"],
    maxSizeBytes: 10 * MB,
    required: true,
    parseable: true,
    auditArea: "Google Analytics",
    helpText:
      "In GA4 → Reports → Acquisition → Traffic Acquisition → Export. Shows channels, sessions, users, and engagement.",
  },
  ga_landing_pages: {
    id: "ga_landing_pages",
    label: "Google Analytics — Landing Pages",
    description: "Landing Pages report export from Google Analytics",
    fileType: "csv",
    acceptedMimeTypes: ["text/csv", "application/vnd.ms-excel", "application/csv"],
    acceptedExtensions: [".csv"],
    maxSizeBytes: 10 * MB,
    required: true,
    parseable: true,
    auditArea: "Google Analytics",
    helpText:
      "In GA4 → Reports → Engagement → Landing Page → Export. Shows which pages bring in the most users.",
  },
  ga_events: {
    id: "ga_events",
    label: "Google Analytics — Events",
    description: "Events report export from Google Analytics",
    fileType: "csv",
    acceptedMimeTypes: ["text/csv", "application/vnd.ms-excel", "application/csv"],
    acceptedExtensions: [".csv"],
    maxSizeBytes: 10 * MB,
    required: false,
    parseable: true,
    auditArea: "Google Analytics",
    helpText: "In GA4 → Reports → Engagement → Events → Export.",
  },
  ga_conversions: {
    id: "ga_conversions",
    label: "Google Analytics — Conversions",
    description: "Conversions report export from Google Analytics",
    fileType: "csv",
    acceptedMimeTypes: ["text/csv", "application/vnd.ms-excel", "application/csv"],
    acceptedExtensions: [".csv"],
    maxSizeBytes: 10 * MB,
    required: false,
    parseable: true,
    auditArea: "Google Analytics",
    helpText: "In GA4 → Reports → Conversions → Export.",
  },
  keyword_rankings: {
    id: "keyword_rankings",
    label: "Keyword Rankings",
    description: "Keyword ranking export from your rank tracking tool",
    fileType: "csv",
    acceptedMimeTypes: ["text/csv", "application/vnd.ms-excel", "application/csv"],
    acceptedExtensions: [".csv"],
    maxSizeBytes: 10 * MB,
    required: false,
    parseable: true,
    auditArea: "Competitors",
    helpText:
      "Export from SEMrush, Ahrefs, Moz, BrightLocal, or similar. Should include keyword, position, URL, and search volume.",
  },
  gbp_screenshot: {
    id: "gbp_screenshot",
    label: "Google Business Profile Screenshot",
    description: "Screenshot of your Google Business Profile listing",
    fileType: "image",
    acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
    maxSizeBytes: 10 * MB,
    required: false,
    parseable: false,
    auditArea: "Google Business Profile",
    helpText: "Screenshot of your full Google Business Profile as it appears in search.",
  },
  reviews_screenshot: {
    id: "reviews_screenshot",
    label: "Google Reviews Screenshot",
    description: "Screenshot of your Google reviews panel",
    fileType: "image",
    acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
    maxSizeBytes: 10 * MB,
    required: false,
    parseable: false,
    auditArea: "Reviews and Testimonials",
    helpText: "Screenshot showing your reviews count, star rating, and recent reviews.",
  },
  map_pack_screenshot: {
    id: "map_pack_screenshot",
    label: "Map Pack Screenshot",
    description: "Screenshot of the local map pack for your main search term",
    fileType: "image",
    acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
    maxSizeBytes: 10 * MB,
    required: false,
    parseable: false,
    auditArea: "Google Business Profile",
    helpText:
      "Search for your main service + city (e.g. 'physical therapy Austin') and screenshot the map pack.",
  },
  competitor_screenshot: {
    id: "competitor_screenshot",
    label: "Competitor Screenshot",
    description: "Screenshot of a competitor's website or listing",
    fileType: "image",
    acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
    maxSizeBytes: 10 * MB,
    required: false,
    parseable: false,
    auditArea: "Competitors",
    helpText: "Screenshots of competitor homepages, service pages, or GBP listings.",
  },
  testimonial_file: {
    id: "testimonial_file",
    label: "Testimonials",
    description: "Patient testimonials or reviews (CSV, PDF, or image)",
    fileType: "document",
    acceptedMimeTypes: [
      "text/csv",
      "application/csv",
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
    ],
    acceptedExtensions: [".csv", ".pdf", ".png", ".jpg", ".jpeg", ".webp"],
    maxSizeBytes: 25 * MB,
    required: false,
    parseable: false,
    auditArea: "Reviews and Testimonials",
    helpText: "Collected testimonials, exported reviews CSV, or screenshots of patient feedback.",
  },
  business_photo: {
    id: "business_photo",
    label: "Business / Clinic Photo",
    description: "Photo of your clinic, office, or facility",
    fileType: "image",
    acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
    maxSizeBytes: 10 * MB,
    required: false,
    parseable: false,
    auditArea: "Photos",
    helpText: "Interior or exterior photos of your clinic.",
  },
  provider_photo: {
    id: "provider_photo",
    label: "Provider / Team Photo",
    description: "Photo of providers, staff, or the full team",
    fileType: "image",
    acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
    maxSizeBytes: 10 * MB,
    required: false,
    parseable: false,
    auditArea: "Photos",
    helpText: "Professional headshots or team photos for the website and GBP.",
  },
  equipment_photo: {
    id: "equipment_photo",
    label: "Equipment Photo",
    description: "Photo of specialized equipment or technology",
    fileType: "image",
    acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
    acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
    maxSizeBytes: 10 * MB,
    required: false,
    parseable: false,
    auditArea: "Photos",
    helpText: "Photos of diagnostic equipment, treatment technology, or specialty tools.",
  },
  compliance_document: {
    id: "compliance_document",
    label: "Compliance Document",
    description: "HIPAA, ADA, privacy policy, or other compliance documentation",
    fileType: "pdf",
    acceptedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
    acceptedExtensions: [".pdf", ".png", ".jpg", ".jpeg"],
    maxSizeBytes: 25 * MB,
    required: false,
    parseable: false,
    auditArea: "Compliance",
    helpText: "Privacy policy, HIPAA notice, accessibility statement, or other compliance docs.",
  },
  general_supporting_document: {
    id: "general_supporting_document",
    label: "General Supporting Document",
    description: "Any other file relevant to the audit",
    fileType: "document",
    acceptedMimeTypes: [
      "application/pdf",
      "text/csv",
      "application/csv",
      "image/png",
      "image/jpeg",
      "image/webp",
    ],
    acceptedExtensions: [".pdf", ".csv", ".png", ".jpg", ".jpeg", ".webp"],
    maxSizeBytes: 25 * MB,
    required: false,
    parseable: false,
    auditArea: "General Documents",
    helpText: "Any other supporting file for the audit that doesn't fit another category.",
  },
};

export const AUDIT_AREAS = [
  "Google Search Console",
  "Google Analytics",
  "Competitors",
  "Google Business Profile",
  "Reviews and Testimonials",
  "Photos",
  "Compliance",
  "General Documents",
] as const;

export type AuditArea = (typeof AUDIT_AREAS)[number];

/** Categories that have CSV parsing support */
export const PARSEABLE_CATEGORIES: UploadCategory[] = Object.values(UPLOAD_CATEGORIES)
  .filter((c) => c.parseable)
  .map((c) => c.id);

/** Map category → parse data_type string */
export const CATEGORY_TO_DATA_TYPE: Partial<Record<UploadCategory, string>> = {
  gsc_queries: "gsc_queries",
  gsc_pages: "gsc_pages",
  gsc_devices: "gsc_devices",
  gsc_countries: "gsc_countries",
  ga_traffic_acquisition: "ga_traffic_acquisition",
  ga_landing_pages: "ga_landing_pages",
  ga_events: "ga_events",
  ga_conversions: "ga_conversions",
  keyword_rankings: "keyword_rankings",
};

/** Required upload categories for readiness scoring */
export const REQUIRED_UPLOAD_CATEGORIES: UploadCategory[] = Object.values(UPLOAD_CATEGORIES)
  .filter((c) => c.required)
  .map((c) => c.id);

export const ALL_CATEGORY_IDS = Object.keys(UPLOAD_CATEGORIES) as UploadCategory[];
