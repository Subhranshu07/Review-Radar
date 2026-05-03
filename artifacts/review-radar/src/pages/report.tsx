import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Share2, Printer, AlertTriangle, ChevronRight, Copy, Check,
  TrendingUp, TrendingDown, DollarSign, Users, BarChart2, Loader2
} from "lucide-react";
import { useGetReport, getGetReportQueryKey } from "@workspace/api-client-react";
import { Nav } from "@/components/nav";
import { formatCurrency, formatCurrencyFull, formatDate, formatNumber, cn } from "@/lib/utils";
import type { FullReport, FixAction, Complaint, PurchaseDriver, CompetitorAdvantage, MarketingAngle } from "@workspace/api-client-react";

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setValue(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

function StatCard({ label, value, icon: Icon, prefix = "", suffix = "" }: {
  label: string; value: number; icon: React.ElementType; prefix?: string; suffix?: string;
}) {
  const counted = useCountUp(value);
  return (
    <div className="p-5 rounded-xl bg-card border border-border">
      <div className="flex items-start justify-between mb-4">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">
        {prefix}{formatNumber(counted)}{suffix}
      </p>
    </div>
  );
}

function ImpactBadge({ impact }: { impact: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide",
      impact === "HIGH" ? "bg-destructive/20 text-red-400" : "bg-orange-500/20 text-orange-400"
    )}>
      {impact} IMPACT
    </span>
  );
}

function EffortBadge({ effort }: { effort: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide",
      effort === "EASY" ? "bg-chart-2/20 text-green-400" :
      effort === "HARD" ? "bg-destructive/20 text-red-400" :
      "bg-yellow-500/20 text-yellow-400"
    )}>
      {effort}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide",
      severity === "HIGH" ? "bg-destructive/20 text-red-400" :
      severity === "LOW" ? "bg-chart-2/20 text-green-400" :
      "bg-yellow-500/20 text-yellow-400"
    )}>
      {severity}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-md bg-secondary hover:bg-accent transition-colors"
      title="Copy to clipboard"
      data-testid="button-copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-chart-2" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );
}

export default function Report() {
  const params = useParams<{ shareToken: string }>();
  const shareToken = params.shareToken;

  const { data: report, isLoading } = useGetReport(shareToken, {
    query: { enabled: !!shareToken, queryKey: getGetReportQueryKey(shareToken) },
  });

  const [shareCopied, setShareCopied] = useState(false);

  function copyShareUrl() {
    navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <div className="text-center py-32 text-muted-foreground">Report not found.</div>
      </div>
    );
  }

  const a = report.analysis;
  const marketShare = report.marketTotalRevenue > 0
    ? (report.estimatedMonthlyRevenue / report.marketTotalRevenue) * 100
    : 0;
  const totalReviews = report.totalReviewsAnalyzed + report.mainProductReviewCount;

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <p className="text-xs text-primary font-medium uppercase tracking-wider mb-1">
                Market Analysis Report &bull; Generated {formatDate(report.createdAt)}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                {report.mainProductTitle || "Product Analysis"}
              </h1>
              {report.mainProductBrand && (
                <p className="text-muted-foreground text-sm mt-1">by {report.mainProductBrand}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={copyShareUrl}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-accent border border-border text-sm text-foreground transition-colors"
                data-testid="button-share"
              >
                {shareCopied ? <Check className="w-3.5 h-3.5 text-chart-2" /> : <Share2 className="w-3.5 h-3.5" />}
                {shareCopied ? "Copied!" : "Share"}
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-accent border border-border text-sm text-foreground transition-colors"
                data-testid="button-print"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>
          </div>
        </motion.div>

        {/* Section 1: Market Snapshot */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Market Snapshot</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total Market Size" value={Math.round(report.marketTotalRevenue)} icon={DollarSign} prefix="$" suffix="/mo" />
            <StatCard label="Your Est. Revenue" value={Math.round(report.estimatedMonthlyRevenue)} icon={TrendingUp} prefix="$" suffix="/mo" />
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-start justify-between mb-4">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Market Share</span>
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                  <BarChart2 className="w-4 h-4 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{marketShare.toFixed(1)}%</p>
            </div>
            <StatCard label="Reviews Analyzed" value={totalReviews} icon={Users} />
          </div>
        </motion.section>

        {/* Section 2: Fix Right Now */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h2 className="text-lg font-bold text-foreground">What You Should Fix RIGHT NOW</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Ranked by impact. Based on real customer data.</p>
          <div className="space-y-3">
            {(a.fixRightNow as FixAction[]).map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="p-4 rounded-xl bg-card border border-border hover:border-destructive/20 transition-all"
                data-testid={`card-fix-${i}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl font-black text-destructive/30 leading-none mt-0.5 w-6 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <ImpactBadge impact={item.impact} />
                      <EffortBadge effort={item.effort} />
                    </div>
                    <p className="font-semibold text-foreground text-sm mb-1">{item.action}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.reasoning}</p>
                  </div>
                </div>
              </motion.div>
            ))}
            {a.fixRightNow.length === 0 && (
              <p className="text-muted-foreground text-sm">Analysis in progress...</p>
            )}
          </div>
        </motion.section>

        {/* Section 3: Customer Insights */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Customer Insights</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Purchase Drivers */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <h3 className="text-sm font-semibold text-foreground mb-4">What Drives Purchases</h3>
              <div className="space-y-4">
                {(a.purchaseDrivers as PurchaseDriver[]).map((d, i) => (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-foreground">{d.driver}</span>
                      <span className="text-xs font-bold text-primary">{d.percentage}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden mb-1">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${d.percentage}%` }}
                        transition={{ delay: 0.1 * i, duration: 0.7 }}
                      />
                    </div>
                    {d.examplePhrase && (
                      <p className="text-xs text-muted-foreground italic">"{d.examplePhrase}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Top Complaints */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <h3 className="text-sm font-semibold text-foreground mb-4">Top Complaints</h3>
              <div className="space-y-3">
                {(a.topComplaints as Complaint[]).map((c, i) => (
                  <div key={i} className="p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityBadge severity={c.severity} />
                      <span className="text-xs text-muted-foreground">{c.frequency}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">{c.complaint}</p>
                    {c.exampleQuote && (
                      <p className="text-xs text-muted-foreground italic">"{c.exampleQuote}"</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Key Phrases */}
          {a.keyPhrases.length > 0 && (
            <div className="p-4 rounded-xl bg-card border border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Key Phrases Your Customers Use
              </p>
              <div className="flex flex-wrap gap-2">
                {(a.keyPhrases as string[]).map((phrase, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium"
                    data-testid={`badge-phrase-${i}`}
                  >
                    {phrase}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.section>

        {/* Section 4: Competitive Gap Analysis */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Competitive Gap Analysis</h2>

          {/* Competitor Table */}
          {report.competitors.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/50 border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rank</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rating</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reviews</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Est. Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {/* Your product row */}
                    <tr className="bg-primary/8 border-l-2 border-l-primary">
                      <td className="px-4 py-3 text-xs font-bold text-primary">YOU</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground text-xs line-clamp-2">{report.mainProductTitle}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-foreground">${report.mainProductPrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-xs text-foreground">{report.mainProductRating.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-xs text-foreground">{formatNumber(report.mainProductReviewCount)}</td>
                      <td className="px-4 py-3 text-right text-xs text-primary font-semibold">{formatCurrency(report.estimatedMonthlyRevenue)}/mo</td>
                    </tr>
                    {report.competitors.map((comp, i) => (
                      <tr key={comp.id} className="hover:bg-secondary/30 transition-colors" data-testid={`row-competitor-${comp.id}`}>
                        <td className="px-4 py-3 text-xs text-muted-foreground font-medium">#{i + 1}</td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-foreground line-clamp-2">{comp.productTitle}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-foreground">${comp.price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-xs text-foreground">{comp.rating.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right text-xs text-foreground">{formatNumber(comp.reviewCount)}</td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatCurrency(comp.estimatedMonthlyRevenue)}/mo</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Competitor advantages + missed positioning */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-card border border-border">
              <h3 className="text-sm font-semibold text-foreground mb-3">What Competitors Emphasize (That You Don't)</h3>
              <div className="space-y-2">
                {(a.competitorAdvantages as CompetitorAdvantage[]).map((adv, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-1 w-5 h-5 rounded-full bg-destructive/15 flex items-center justify-center shrink-0 text-xs font-bold text-destructive">{adv.howManyCompetitorsMention}</span>
                    <p className="text-xs text-muted-foreground">{adv.point}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 rounded-xl bg-card border border-border">
              <h3 className="text-sm font-semibold text-foreground mb-3">Your Missed Positioning Opportunities</h3>
              <div className="space-y-2">
                {(a.missedPositioning as string[]).map((opp, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">{opp}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Section 5: Listing Rewritten */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Instant Fix Generator</h2>
          <p className="text-sm text-muted-foreground mb-4">Your listing, rewritten. Based on real customer language and competitor gaps.</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* Current */}
            <div className="p-5 rounded-xl bg-secondary/30 border border-border">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Current Listing</h3>
              <p className="text-sm font-medium text-muted-foreground mb-3">{report.mainProductTitle}</p>
              <div className="space-y-2">
                {report.mainProductBullets.split("\n").filter(Boolean).map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-muted-foreground/50 mt-0.5 shrink-0">•</span>
                    <p className="text-xs text-muted-foreground">{b}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Improved */}
            <div className="p-5 rounded-xl bg-primary/5 border border-primary/20">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">AI Optimized Version</h3>
              {a.improvedTitle && (
                <p className="text-sm font-semibold text-foreground mb-3 bg-chart-2/10 px-2 py-1 rounded text-green-400">{a.improvedTitle}</p>
              )}
              <div className="space-y-2">
                {(a.improvedBullets as string[]).map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-primary/50 mt-0.5 shrink-0">•</span>
                    <p className="text-xs text-foreground">{b}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Marketing Angles */}
          {(a.marketingAngles as MarketingAngle[]).length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Marketing Angles</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(a.marketingAngles as MarketingAngle[]).map((angle, i) => (
                  <div key={i} className="p-4 rounded-xl bg-card border border-border">
                    <p className="text-xs font-bold text-primary mb-1">{angle.angle}</p>
                    <p className="text-xs text-muted-foreground mb-2">For: {angle.targetAudience}</p>
                    <p className="text-sm font-semibold text-foreground italic">"{angle.hook}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ad Headlines */}
          {(a.adHeadlines as string[]).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Suggested Ad Headlines</h3>
              <div className="space-y-2">
                {(a.adHeadlines as string[]).map((headline, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border" data-testid={`card-headline-${i}`}>
                    <p className="flex-1 text-sm font-medium text-foreground">{headline}</p>
                    <CopyButton text={headline} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.section>

        {/* Section 6: Quick Wins */}
        {(a.quickWins as string[]).length > 0 && (
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Quick Wins</h2>
            <p className="text-sm text-muted-foreground mb-4">Do these this week.</p>
            <div className="space-y-2">
              {(a.quickWins as string[]).map((win, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border" data-testid={`card-quickwin-${i}`}>
                  <div className="w-5 h-5 rounded border border-border mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground">{win}</p>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Section 7: Share */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <div className="p-6 rounded-xl bg-card border border-border">
            <h2 className="text-sm font-semibold text-foreground mb-4">Share this report</h2>
            <div className="p-4 rounded-lg bg-secondary/50 border border-border mb-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Just analyzed my Amazon market with Review Radar.<br />
                Found {a.fixRightNow.length} critical gaps competitors are exploiting.<br />
                Market size: {formatCurrency(report.marketTotalRevenue)}/month.<br />
                Get your free analysis → {window.location.href}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-xs text-muted-foreground font-mono truncate">
                {window.location.href}
              </div>
              <button
                onClick={copyShareUrl}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors"
                data-testid="button-copy-share-url"
              >
                {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {shareCopied ? "Copied!" : "Copy URL"}
              </button>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  );
}
