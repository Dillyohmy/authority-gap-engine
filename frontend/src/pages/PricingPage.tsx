import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";

const plans = [
  {
    name: "Free Authority Gap Scan",
    price: "$0",
    description: "Discover where your clinic's authority is weak.",
    features: [
      "Authority Gap Score",
      "Visibility Gap overview",
      "Conversion Gap overview",
      "Revenue Opportunity estimate",
      "Top 3 priority fixes",
    ],
    cta: "Run Free Scan",
    ctaLink: "/scan",
    highlighted: false,
  },
  {
    name: "Full Authority Gap Report",
    price: "$197",
    period: "one-time",
    description: "Complete findings, deeper analysis, and actionable recommendations.",
    features: [
      "Everything in Free Scan",
      "Full findings breakdown",
      "Expanded recommendations",
      "Detailed revenue modeling",
      "Downloadable report",
      "Future roadmap section",
    ],
    cta: "Unlock Full Report",
    ctaLink: "/scan",
    highlighted: true,
  },
  {
    name: "Authority Recovery Plan",
    price: "Custom",
    description: "Done-for-you strategy and implementation for your clinic.",
    features: [
      "Everything in Full Report",
      "Custom strategy session",
      "Implementation roadmap",
      "Priority fix execution",
      "Ongoing authority monitoring",
      "Dedicated account manager",
    ],
    cta: "Book Strategy Call",
    ctaLink: "/scan",
    highlighted: false,
  },
];

const PricingPage = () => (
  <div className="min-h-[calc(100vh-56px)] py-ihd-xl bg-secondary">
    <div className="container max-w-5xl">
      <div className="text-center mb-ihd-lg">
        <h1 className="text-ihd-h1 font-bold text-foreground">
          See Exactly How to Recover Lost Patient Opportunities
        </h1>
        <p className="mt-2 text-ihd-body text-muted-foreground max-w-xl mx-auto">
          Choose the level of insight that fits your practice.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-ihd-md">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`flex flex-col shadow-card ${
              plan.highlighted ? "border-primary ring-1 ring-primary/20 shadow-elevated" : ""
            }`}
          >
            <CardHeader>
              {plan.highlighted && (
                <div className="text-[12px] font-bold text-primary uppercase tracking-wide mb-1">Most Popular</div>
              )}
              <CardTitle className="text-ihd-h3">{plan.name}</CardTitle>
              <div className="flex items-baseline gap-1">
                <span className="text-[32px] font-bold text-foreground">{plan.price}</span>
                {plan.period && <span className="text-ihd-small text-muted-foreground">{plan.period}</span>}
              </div>
              <CardDescription className="text-ihd-small">{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ul className="space-y-2 flex-1 mb-ihd-md">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-ihd-small text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to={plan.ctaLink}>
                <Button
                  className={`w-full gap-2 ${
                    plan.highlighted
                      ? ""
                      : "bg-background text-primary border border-primary hover:bg-primary hover:text-primary-foreground"
                  }`}
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  {plan.cta} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  </div>
);

export default PricingPage;
