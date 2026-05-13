import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Loader2, CheckCircle2, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { z } from "zod";

const leadSchema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email("Please enter a valid email").max(255),
  wantsStrategyReview: z.boolean(),
});

export type LeadData = z.infer<typeof leadSchema>;

interface LeadCaptureFormProps {
  onSubmit: (data: LeadData) => Promise<void>;
  loading?: boolean;
}

const LeadCaptureForm = ({ onSubmit, loading }: LeadCaptureFormProps) => {
  const [form, setForm] = useState({ name: "", email: "", wantsStrategyReview: false });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = leadSchema.safeParse(form);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    await onSubmit(result.data);
    setSuccess(true);
  };

  if (success) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        <Card className="shadow-elevated border-0 rounded-xl max-w-lg mx-auto">
          <CardContent className="flex flex-col items-center gap-3 py-10 px-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <h3 className="text-[16px] font-extrabold text-foreground">Report Unlocked</h3>
            <p className="text-[13px] text-muted-foreground">Your full diagnostic is ready below.</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="shadow-elevated border-0 rounded-xl overflow-hidden max-w-lg mx-auto">
        <div className="bg-ihd-dark-green px-5 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary-foreground/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-[15px] font-extrabold text-primary-foreground">Unlock Your Full Report</h3>
              <p className="text-[11px] text-primary-foreground/50 font-medium">Enter your details to access the complete diagnostic</p>
            </div>
          </div>
        </div>

        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="lead-name" className="text-[12px] font-semibold text-foreground/80">
                  Name <span className="text-muted-foreground/50">(optional)</span>
                </Label>
                <Input
                  id="lead-name"
                  placeholder="John"
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10 text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-email" className="text-[12px] font-semibold text-foreground/80">Email *</Label>
                <Input
                  id="lead-email"
                  type="email"
                  placeholder="john@clinic.com"
                  maxLength={255}
                  value={form.email}
                  onChange={(e) => { setForm({ ...form, email: e.target.value }); setError(""); }}
                  required
                  className="h-10 text-[13px]"
                />
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-1">
              <Checkbox
                id="lead-strategy"
                checked={form.wantsStrategyReview}
                onCheckedChange={(checked) => setForm({ ...form, wantsStrategyReview: checked === true })}
                className="mt-0.5"
              />
              <Label htmlFor="lead-strategy" className="text-[12px] text-muted-foreground leading-relaxed cursor-pointer">
                I'd like a strategy review of this report
              </Label>
            </div>

            {error && (
              <p className="text-[12px] text-destructive font-medium">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-[13px] font-bold gap-2 rounded-lg"
              size="lg"
              disabled={!form.email.trim() || loading}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Unlocking…</>
              ) : (
                <>View Full Report <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>

            <p className="text-[10px] text-center text-muted-foreground/50 leading-relaxed">
              Your information is kept private and never shared. No credit card required.
            </p>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default LeadCaptureForm;
