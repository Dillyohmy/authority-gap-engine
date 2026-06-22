import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, Unplug,
  ChevronRight, ExternalLink, Database, Search, BarChart3, Building2,
  ArrowRight, Loader2, ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  integrationsApi,
  type ProjectIntegration,
  type IntegrationType,
  type GscProperty,
  type Ga4Property,
  type SyncStatus,
} from "@/lib/integrationsApi";

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "connected") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Connected</Badge>;
  if (status === "running") return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Syncing…</Badge>;
  if (status === "error" || status === "expired") return <Badge className="bg-red-100 text-red-800 border-red-200 capitalize">{status}</Badge>;
  if (status === "revoked") return <Badge variant="secondary">Disconnected</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Not connected</Badge>;
}

function SyncStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === "success") return <span className="text-xs text-emerald-600">Last sync: success</span>;
  if (status === "running") return <span className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Syncing…</span>;
  if (status === "error") return <span className="text-xs text-red-600">Last sync: failed</span>;
  return null;
}

function fmt(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Property picker modal (simple inline dropdown) ────────────────────────────

interface PropertyPickerProps {
  projectId: string;
  integration: ProjectIntegration;
  onDone: () => void;
}

function PropertyPicker({ projectId, integration, onDone }: PropertyPickerProps) {
  const { toast } = useToast();
  const [properties, setProperties] = useState<GscProperty[] | Ga4Property[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    integrationsApi.listProperties(projectId, integration.id)
      .then(r => setProperties(r.properties as GscProperty[] | Ga4Property[]))
      .catch(e => toast({ title: "Could not load properties", description: (e as Error).message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [projectId, integration.id, toast]);

  async function select(prop: GscProperty | Ga4Property) {
    setSaving(true);
    try {
      if ("siteUrl" in prop) {
        await integrationsApi.selectProperty(projectId, integration.id, {
          siteUrl: prop.siteUrl,
          propertyName: prop.siteUrl,
        });
      } else {
        await integrationsApi.selectProperty(projectId, integration.id, {
          propertyId: prop.propertyId,
          propertyName: prop.propertyName,
        });
      }
      toast({ title: "Property selected" });
      onDone();
    } catch (e) {
      toast({ title: "Failed to select property", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (!properties || properties.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No properties found in this account.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1">
      <p className="text-xs font-medium text-muted-foreground mb-2">Select a property:</p>
      {(properties as Array<GscProperty | Ga4Property>).map((prop, i) => {
        const isGsc = "siteUrl" in prop;
        const label = isGsc ? (prop as GscProperty).siteUrl : `${(prop as Ga4Property).propertyName} (${(prop as Ga4Property).accountName})`;
        return (
          <button
            key={i}
            onClick={() => select(prop)}
            disabled={saving}
            className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-muted border border-transparent hover:border-border transition-colors"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Integration card ──────────────────────────────────────────────────────────

interface CardConfig {
  type: IntegrationType;
  icon: React.ReactNode;
  label: string;
  description: string;
  scopeNote: string;
  comingSoon?: boolean;
}

const CARD_CONFIGS: CardConfig[] = [
  {
    type: "search_console",
    icon: <Search className="h-5 w-5 text-blue-600" />,
    label: "Google Search Console",
    description: "Pull query rankings, impressions, clicks, and page performance data directly from GSC.",
    scopeNote: "Read-only access to your Search Console properties",
  },
  {
    type: "google_analytics",
    icon: <BarChart3 className="h-5 w-5 text-orange-500" />,
    label: "Google Analytics 4",
    description: "Pull traffic acquisition, landing page engagement, conversions, and city-level data from GA4.",
    scopeNote: "Read-only access to your Analytics properties",
  },
  {
    type: "google_business_profile",
    icon: <Building2 className="h-5 w-5 text-green-600" />,
    label: "Google Business Profile",
    description: "Connect your GBP to validate local authority signals and review metrics.",
    scopeNote: "Coming in a future update",
    comingSoon: true,
  },
];

interface IntegrationCardProps {
  config: CardConfig;
  integration: ProjectIntegration | undefined;
  projectId: string;
  onRefresh: () => void;
}

function IntegrationCard({ config, integration, projectId, onRefresh }: IntegrationCardProps) {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const isConnected = integration?.status === "connected";
  const hasProperty = !!(integration?.site_url || integration?.property_id);
  const isSyncing = integration?.last_sync_status === "running" || syncing;

  // Poll sync status while syncing
  useEffect(() => {
    if (!integration || !isSyncing) {
      if (pollInterval) { clearInterval(pollInterval); setPollInterval(null); }
      return;
    }
    const iv = setInterval(async () => {
      try {
        const status = await integrationsApi.syncStatus(projectId, integration.id);
        setSyncStatus(status);
        if (status.lastSyncStatus !== "running") {
          clearInterval(iv);
          setPollInterval(null);
          setSyncing(false);
          onRefresh();
        }
      } catch { /* ignore */ }
    }, 3000);
    setPollInterval(iv);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncing, integration?.id]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const { url } = await integrationsApi.connect(projectId, config.type);
      window.location.href = url;
    } catch (e) {
      toast({ title: "Could not start OAuth", description: (e as Error).message, variant: "destructive" });
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!integration) return;
    setDisconnecting(true);
    try {
      await integrationsApi.disconnect(projectId, integration.id);
      toast({ title: "Disconnected" });
      onRefresh();
    } catch (e) {
      toast({ title: "Disconnect failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSync() {
    if (!integration) return;
    setSyncing(true);
    try {
      await integrationsApi.sync(projectId, integration.id, 28);
      toast({ title: "Sync started", description: "Data will be available in about a minute." });
      onRefresh();
    } catch (e) {
      toast({ title: "Sync failed", description: (e as Error).message, variant: "destructive" });
      setSyncing(false);
    }
  }

  return (
    <Card className={`border ${config.comingSoon ? "opacity-60" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-muted/50">{config.icon}</div>
            <div>
              <CardTitle className="text-sm font-semibold">{config.label}</CardTitle>
              {config.comingSoon && (
                <Badge variant="secondary" className="text-[10px] mt-0.5">Coming Soon</Badge>
              )}
            </div>
          </div>
          <StatusBadge status={integration?.status ?? "not_connected"} />
        </div>
        <CardDescription className="text-xs mt-1">{config.description}</CardDescription>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Connected account info */}
        {isConnected && (
          <div className="rounded-md bg-muted/40 px-3 py-2 space-y-1">
            {integration.external_account_email && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>{integration.external_account_email}</span>
              </div>
            )}
            {hasProperty && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Property: </span>
                {integration.property_name || integration.site_url || integration.property_id}
              </div>
            )}
            {integration.last_sync_at && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Last sync: {fmt(integration.last_sync_at)}</span>
                <SyncStatusBadge status={integration.last_sync_status} />
              </div>
            )}
            {integration.last_sync_error && (
              <div className="flex items-start gap-1.5 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{integration.last_sync_error}</span>
              </div>
            )}
          </div>
        )}

        {/* Property picker */}
        {isConnected && !hasProperty && (
          <div>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs gap-1.5"
              onClick={() => setShowPicker(!showPicker)}
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Select property
            </Button>
            {showPicker && (
              <PropertyPicker
                projectId={projectId}
                integration={integration!}
                onDone={() => { setShowPicker(false); onRefresh(); }}
              />
            )}
          </div>
        )}

        {/* Action buttons */}
        {config.comingSoon ? null : !isConnected ? (
          <Button
            size="sm"
            className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
            {connecting ? "Redirecting to Google…" : "Connect Google Account"}
          </Button>
        ) : (
          <div className="flex gap-2">
            {hasProperty && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs gap-1.5"
                onClick={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {isSyncing ? "Syncing…" : "Sync Now"}
              </Button>
            )}
            {isConnected && !hasProperty && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs gap-1.5"
                onClick={() => setShowPicker(!showPicker)}
              >
                <Database className="h-3.5 w-3.5" />
                Select Property
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-destructive hover:text-destructive gap-1"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
              Disconnect
            </Button>
          </div>
        )}

        {/* Scope note */}
        <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
          <span>🔒</span> {config.scopeNote}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [integrations, setIntegrations] = useState<ProjectIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await integrationsApi.list(projectId);
      setIntegrations(res.integrations);
    } catch (e) {
      toast({ title: "Could not load integrations", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    load();
  }, [user, navigate, load]);

  // Handle OAuth callback params
  useEffect(() => {
    const connected = searchParams.get("connected");
    const oauthError = searchParams.get("oauth_error");

    if (connected) {
      const label = connected === "search_console" ? "Google Search Console" : "Google Analytics 4";
      toast({ title: `${label} connected`, description: "Select a property to start syncing data." });
      load();
    }
    if (oauthError) {
      const messages: Record<string, string> = {
        access_denied: "You declined Google access.",
        missing_params: "OAuth callback missing required parameters.",
        invalid_state: "Security check failed — please try again.",
        storage_failed: "Could not save your connection. Please try again.",
      };
      toast({
        title: "Google connection failed",
        description: messages[oauthError] || oauthError,
        variant: "destructive",
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  const getIntegration = (type: IntegrationType) =>
    integrations.find(i => i.integration_type === type);

  const connectedCount = integrations.filter(i => i.status === "connected").length;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-secondary">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/projects" className="hover:text-foreground transition-colors">Projects</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to={`/projects/${projectId}`} className="hover:text-foreground transition-colors">Dashboard</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Connected Data Sources</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Connected Data Sources</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your Google accounts so Authority Gap Engine can pull live performance data instead of relying only on uploaded CSVs.
            </p>
          </div>
          {connectedCount > 0 && (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 shrink-0">
              {connectedCount} connected
            </Badge>
          )}
        </div>

        {/* Info banner */}
        <div className="rounded-lg border bg-blue-50 border-blue-200 px-4 py-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">How it works</p>
          <p>Connect your Google account below. We request only read-only access — we never write data to your account. Your authorization tokens are encrypted and stored securely. You can disconnect at any time.</p>
        </div>

        {/* Integration cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-52 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CARD_CONFIGS.map(config => (
              <IntegrationCard
                key={config.type}
                config={config}
                integration={getIntegration(config.type)}
                projectId={projectId!}
                onRefresh={load}
              />
            ))}

            {/* How data is used */}
            <Card className="border bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  How connected data improves your score
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground space-y-1.5">
                <div className="flex items-start gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />
                  <span>Search Console queries feed the Service Authority and Competitive tabs</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-orange-500" />
                  <span>GA4 city data improves Local Authority scoring</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
                  <span>GA4 conversion data boosts Trust &amp; Conversion accuracy</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-purple-500" />
                  <span>Live API data takes priority over uploaded CSVs automatically</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-500" />
                  <span>Growth plan tasks are generated from near-page-1 queries and weak conversion pages</span>
                </div>
                <p className="pt-1 text-[10px]">Existing CSV uploads continue to work and are not removed when you connect an API.</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Back to dashboard */}
        <div className="flex justify-center pt-2">
          <Link to={`/projects/${projectId}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}
