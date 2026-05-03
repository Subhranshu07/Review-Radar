import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Search, ArrowRight, Loader2, TrendingUp, BarChart3 } from "lucide-react";
import { useAnalyzeProduct, useGetStats, useGetRecentReports } from "@workspace/api-client-react";
import { Nav } from "@/components/nav";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

function isValidAmazonUrl(url: string): boolean {
  try {
    const parsed = new URL(url.startsWith("http") ? url : "https://" + url);
    const host = parsed.hostname.toLowerCase();
    if (host === "amzn.in" || host === "amzn.com") {
      return /^\/d\/[A-Za-z0-9]+/.test(parsed.pathname);
    }
    const isAmazon =
      host === "amazon.com" || host === "www.amazon.com" ||
      host === "amazon.in"  || host === "www.amazon.in";
    return isAmazon && /\/dp\/[A-Z0-9]{10}/.test(url);
  } catch {
    return false;
  }
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const analyze = useAnalyzeProduct();
  const { data: stats } = useGetStats();
  const { data: recentReports } = useGetRecentReports();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!url.trim()) {
      setError("Please enter an Amazon product URL");
      return;
    }
    const isValid = isValidAmazonUrl(url);
    if (!isValid) {
      setError("Please enter a valid Amazon URL — full (amazon.com/dp/...) or short (amzn.in/d/...)");
      return;
    }
    analyze.mutate(
      { data: { listingUrl: url.trim() } },
      {
        onSuccess: (res) => {
          setLocation(`/processing/${res.shareToken}`);
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          setError(msg || "Failed to start analysis. Please try again.");
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {stats && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8">
                <BarChart3 className="w-3 h-3" />
                {formatNumber(stats.totalReportsGenerated)} markets analyzed &bull; {formatNumber(stats.totalReviewsAnalyzed)} reviews processed
              </div>
            )}

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight tracking-tight mb-6">
              Your competitors are winning.
              <br />
              <span className="text-primary">Find out exactly why.</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Paste any Amazon listing. Get 1000+ reviews analyzed, competitor gaps found, and your listing rewritten — in under 2 minutes.
            </p>

            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
              <div className="relative flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="amazon.com/dp/B08... or amzn.in/d/... or amazon.in/dp/..."
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
                    data-testid="input-amazon-url"
                    disabled={analyze.isPending}
                  />
                </div>
                <button
                  type="submit"
                  disabled={analyze.isPending}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap glow-indigo"
                  data-testid="button-analyze"
                >
                  {analyze.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      Analyze My Market
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 text-sm text-destructive text-left"
                  data-testid="text-error"
                >
                  {error}
                </motion.p>
              )}

              <p className="mt-3 text-xs text-muted-foreground">
                Analyzes your listing + 9 competitors + 500–1000 reviews
              </p>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Feature pills */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex flex-wrap justify-center gap-3 mb-16">
          {[
            "Customer psychology analysis",
            "Complaint detection",
            "Competitor gap analysis",
            "AI listing rewrite",
            "Revenue estimation",
            "Marketing angles",
          ].map((f) => (
            <span
              key={f}
              className="px-3 py-1.5 rounded-full bg-card border border-border text-muted-foreground text-xs"
            >
              {f}
            </span>
          ))}
        </div>

        {/* Recent reports */}
        {recentReports && recentReports.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Recent Analyses
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentReports.map((report, i) => (
                <motion.a
                  key={report.shareToken}
                  href={`/report/${report.shareToken}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className="block p-4 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-card/80 transition-all cursor-pointer group"
                  data-testid={`card-recent-report-${report.shareToken}`}
                >
                  <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors mb-2">
                    {report.productTitle}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-primary font-semibold">
                      {formatCurrency(report.marketTotalRevenue, report.currencySymbol)}/mo market
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(report.createdAt)}
                    </span>
                  </div>
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}
      </section>
    </div>
  );
}
