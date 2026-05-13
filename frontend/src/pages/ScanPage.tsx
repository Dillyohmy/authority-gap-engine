import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { startScan } from "@/lib/scanClient";
import { trackEvent } from "@/lib/tracking";

const CLINIC_TYPES = [
  "Functional Medicine",
  "Hormone Therapy",
  "Weight Loss",
  "Integrative Health",
  "Chiropractic",
  "Med Spa",
  "Primary Care",
  "Other",
];

const ScanPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    websiteUrl: searchParams.get("url") || "",
    clinicType: "",
    location: "",
    monthlyPatientValue: "",
    monthlyTraffic: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    trackEvent("scan_started", form.websiteUrl);

    try {
      const { job_id } = await startScan({
        website_url: form.websiteUrl,
        clinic_type: form.clinicType,
        location: form.location,
        monthly_patient_value: form.monthlyPatientValue ? Number(form.monthlyPatientValue) : undefined,
        monthly_traffic: form.monthlyTraffic ? Number(form.monthlyTraffic) : undefined,
      });

      navigate(`/scan/loading?jobId=${job_id}`);
    } catch (err) {
      toast({
        title: "Could not start scan",
        description: err instanceof Error ? err.message : "Please check the URL and try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = form.websiteUrl && form.clinicType && form.location;

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center py-ihd-lg bg-secondary">
      <Card className="w-full max-w-lg shadow-elevated">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded bg-accent text-accent-foreground mb-ihd-xs">
            <Shield className="h-5 w-5" />
          </div>
          <CardTitle className="text-ihd-h2">Free Authority Gap Scan</CardTitle>
          <CardDescription className="text-ihd-body">
            Enter your clinic details to discover where you may be losing patients online.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-ihd-sm">
            <div className="space-y-1">
              <Label htmlFor="url" className="text-ihd-small font-semibold">Website URL *</Label>
              <Input
                id="url"
                placeholder="https://yourclinic.com"
                value={form.websiteUrl}
                onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-ihd-small font-semibold">Clinic Type *</Label>
              <Select value={form.clinicType} onValueChange={(v) => setForm({ ...form, clinicType: v })} disabled={submitting}>
                <SelectTrigger><SelectValue placeholder="Select clinic type" /></SelectTrigger>
                <SelectContent>
                  {CLINIC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="location" className="text-ihd-small font-semibold">Location *</Label>
              <Input
                id="location"
                placeholder="City, State"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
                disabled={submitting}
              />
            </div>
            <div className="grid grid-cols-2 gap-ihd-sm">
              <div className="space-y-1">
                <Label htmlFor="pv" className="text-ihd-small font-semibold">Avg Patient Value ($)</Label>
                <Input
                  id="pv"
                  type="number"
                  placeholder="350"
                  value={form.monthlyPatientValue}
                  onChange={(e) => setForm({ ...form, monthlyPatientValue: e.target.value })}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tr" className="text-ihd-small font-semibold">Monthly Traffic</Label>
                <Input
                  id="tr"
                  type="number"
                  placeholder="800"
                  value={form.monthlyTraffic}
                  onChange={(e) => setForm({ ...form, monthlyTraffic: e.target.value })}
                  disabled={submitting}
                />
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={!isValid || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting Scan…
                </>
              ) : (
                "Run Free Scan"
              )}
            </Button>
            <p className="text-[12px] text-center text-muted-foreground">
              No credit card required. Results in under 60 seconds.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScanPage;
