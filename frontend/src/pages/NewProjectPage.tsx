import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { createProject } from "@/lib/projectsApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, FolderPlus } from "lucide-react";

const NewProjectPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [clinicType, setClinicType] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    navigate("/auth");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await createProject({
        name: name.trim(),
        website_url: websiteUrl.trim() || undefined,
        clinic_type: clinicType.trim() || undefined,
        location: location.trim() || undefined,
      });
      navigate(`/projects/${project.id}/intake`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-secondary flex items-start justify-center pt-10 px-4">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-1">
            Authority Gap Engine™
          </p>
          <h1 className="text-[24px] font-extrabold text-foreground">New Audit Project</h1>
          <p className="text-[13px] text-muted-foreground/70 mt-1">
            Create a project to begin the structured intake process for a practice.
          </p>
        </div>

        <Card className="shadow-elevated border-0 rounded-xl">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[12px] font-bold uppercase tracking-[0.1em]">
                  Project Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Balanced Body Medical — Q3 Audit"
                  required
                  className="h-10 text-[13px]"
                />
                <p className="text-[11px] text-muted-foreground/60">
                  A descriptive name helps when managing multiple projects.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="website_url" className="text-[12px] font-bold uppercase tracking-[0.1em]">
                  Website URL
                </Label>
                <Input
                  id="website_url"
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://"
                  className="h-10 text-[13px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="clinic_type" className="text-[12px] font-bold uppercase tracking-[0.1em]">
                    Clinic Type
                  </Label>
                  <Input
                    id="clinic_type"
                    value={clinicType}
                    onChange={(e) => setClinicType(e.target.value)}
                    placeholder="e.g. Orthopedic"
                    className="h-10 text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="location" className="text-[12px] font-bold uppercase tracking-[0.1em]">
                    Location
                  </Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, State"
                    className="h-10 text-[13px]"
                  />
                </div>
              </div>

              {error && (
                <p className="text-[12px] text-destructive font-medium">{error}</p>
              )}

              <Button
                type="submit"
                disabled={submitting || !name.trim()}
                className="w-full h-11 font-bold text-[13px] gap-2"
              >
                {submitting ? (
                  "Creating project…"
                ) : (
                  <>
                    <FolderPlus className="h-4 w-4" />
                    Create Project & Start Intake
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NewProjectPage;
