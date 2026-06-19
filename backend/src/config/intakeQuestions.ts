export type QuestionType =
  | "url"
  | "text"
  | "textarea"
  | "select"
  | "multitext"
  | "yesno"
  | "file_note";

export interface IntakeQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  placeholder?: string;
  hint?: string;
  options?: string[]; // for select type
}

export interface IntakeSection {
  id: string;
  title: string;
  description: string;
  questions: IntakeQuestion[];
}

export const INTAKE_SECTIONS: IntakeSection[] = [
  {
    id: "practice",
    title: "Practice Overview",
    description: "Basic information about the practice being audited.",
    questions: [
      {
        id: "practice_name",
        label: "Practice Name",
        type: "text",
        required: true,
        placeholder: "e.g. Balanced Body Medical",
      },
      {
        id: "website_url",
        label: "Website URL",
        type: "url",
        required: true,
        placeholder: "https://",
      },
      {
        id: "clinic_type",
        label: "Clinic / Practice Type",
        type: "text",
        required: true,
        placeholder: "e.g. Orthopedic Surgery, Family Medicine, Med Spa",
      },
      {
        id: "location",
        label: "Primary Location",
        type: "text",
        required: true,
        placeholder: "City, State",
      },
      {
        id: "service_area",
        label: "Full Service Area",
        type: "textarea",
        required: false,
        placeholder: "List cities, counties, or radius (e.g. Dallas metro, 30-mile radius from downtown)",
        hint: "Include all geographic areas the practice actively serves or wants to rank in.",
      },
    ],
  },
  {
    id: "online_presence",
    title: "Online Presence",
    description: "Links and info about the practice's existing online footprint.",
    questions: [
      {
        id: "google_business_profile_url",
        label: "Google Business Profile URL",
        type: "url",
        required: true,
        placeholder: "https://maps.google.com/...",
        hint: "Find it by searching the practice name on Google Maps and copying the URL.",
      },
      {
        id: "sitemap_url",
        label: "Sitemap URL",
        type: "url",
        required: false,
        placeholder: "https://example.com/sitemap.xml",
        hint: "Usually found at /sitemap.xml or /sitemap_index.xml",
      },
      {
        id: "google_reviews_notes",
        label: "Google Reviews — Notes or Export",
        type: "textarea",
        required: false,
        placeholder: "Paste review text, average rating, total count, or any notes about review patterns.",
        hint: "Screenshots work too — describe what you see: rating, count, themes in reviews.",
      },
    ],
  },
  {
    id: "data_analytics",
    title: "Data & Analytics",
    description: "Performance data from Google tools and keyword tracking.",
    questions: [
      {
        id: "search_console_notes",
        label: "Google Search Console — Key Data",
        type: "textarea",
        required: false,
        placeholder: "Paste top queries, impressions, CTR, or export summary. Or describe what you know.",
        hint: "Export a CSV from Search Console > Performance > Pages and paste key rows, or summarize.",
      },
      {
        id: "analytics_notes",
        label: "Google Analytics — Traffic Summary",
        type: "textarea",
        required: false,
        placeholder: "Paste top pages, sessions, sources, or any notable traffic patterns.",
        hint: "A screenshot description or exported CSV summary is fine.",
      },
      {
        id: "ranking_keywords",
        label: "Currently Ranking Keywords",
        type: "textarea",
        required: false,
        placeholder: "List keywords and approximate positions (e.g. 'knee surgeon dallas — #4')",
        hint: "Paste from SEMrush, Ahrefs, or manually list known rankings.",
      },
    ],
  },
  {
    id: "competitive",
    title: "Competitive Landscape",
    description: "Who the practice competes with for patients.",
    questions: [
      {
        id: "competitor_urls",
        label: "Competitor Website URLs",
        type: "multitext",
        required: false,
        placeholder: "https://competitor.com",
        hint: "Add up to 5 direct competitors. These will be used for gap analysis in the audit phase.",
      },
    ],
  },
  {
    id: "revenue_services",
    title: "Revenue & Services",
    description: "What the practice offers and how it generates revenue.",
    questions: [
      {
        id: "revenue_services",
        label: "Primary Revenue-Generating Services",
        type: "multitext",
        required: true,
        placeholder: "e.g. Joint Replacement Surgery",
        hint: "List the services that drive the most revenue. These shape keyword and content priorities.",
      },
      {
        id: "profitable_treatments",
        label: "Most Profitable Treatments",
        type: "multitext",
        required: false,
        placeholder: "e.g. Stem Cell Therapy, LASIK",
        hint: "If different from the above, list high-margin treatments worth prioritizing in the audit.",
      },
      {
        id: "insurance_plans",
        label: "Insurance Plans Accepted",
        type: "multitext",
        required: false,
        placeholder: "e.g. Blue Cross Blue Shield, Medicare",
        hint: "Insurance acceptance affects local patient volume and targeting.",
      },
      {
        id: "referral_workflow",
        label: "Referral Workflow",
        type: "textarea",
        required: false,
        placeholder: "Describe how the practice receives and handles referrals from other providers.",
        hint: "e.g. 'We receive fax referrals from PCPs, call within 24h, and have a dedicated referral coordinator.'",
      },
    ],
  },
  {
    id: "trust_proof",
    title: "Trust & Social Proof",
    description: "Patient trust signals that affect conversion.",
    questions: [
      {
        id: "has_photos",
        label: "Does the practice have professional photos of the facility and team?",
        type: "yesno",
        required: true,
      },
      {
        id: "testimonials",
        label: "Patient Testimonials",
        type: "textarea",
        required: false,
        placeholder: "Paste 2–5 testimonials or describe where they are published.",
        hint: "Copy from Google, Healthgrades, Zocdoc, or the website itself.",
      },
      {
        id: "has_before_after",
        label: "Does the practice have before/after case examples to share?",
        type: "yesno",
        required: false,
      },
    ],
  },
  {
    id: "conversion_compliance",
    title: "Conversion & Compliance",
    description: "CTA preferences, schema, metadata goals, and compliance requirements.",
    questions: [
      {
        id: "preferred_cta",
        label: "Preferred Primary Call to Action",
        type: "select",
        required: true,
        options: [
          "Call to schedule",
          "Request an appointment online",
          "Fill out a contact form",
          "Chat / message us",
          "Get a free consultation",
          "Download a patient guide",
        ],
        hint: "This becomes the anchor CTA recommendation in the audit report.",
      },
      {
        id: "schema_markup_notes",
        label: "Schema Markup — Current Status",
        type: "textarea",
        required: false,
        placeholder: "Paste the schema code, a URL to check, or describe what you know.",
        hint: "Check with Google's Rich Results Test or search 'schema markup' in the page source.",
      },
      {
        id: "title_meta_goals",
        label: "Title & Meta Description Goals",
        type: "textarea",
        required: false,
        placeholder: "Describe any keyword or messaging targets for page titles and meta descriptions.",
        hint: "e.g. 'We want to rank for knee surgeon in Dallas and highlight our same-day appointments.'",
      },
      {
        id: "hipaa_requirements",
        label: "HIPAA Requirements",
        type: "yesno",
        required: true,
        hint: "Does the practice need HIPAA-compliant forms and data handling in recommendations?",
      },
      {
        id: "hipaa_notes",
        label: "HIPAA or Compliance Details",
        type: "textarea",
        required: false,
        placeholder: "Add any specific compliance requirements, existing BAAs, or restrictions.",
      },
    ],
  },
];

export const ALL_QUESTIONS: IntakeQuestion[] = INTAKE_SECTIONS.flatMap(
  (s) => s.questions
);

export const REQUIRED_QUESTION_IDS = new Set(
  ALL_QUESTIONS.filter((q) => q.required).map((q) => q.id)
);
