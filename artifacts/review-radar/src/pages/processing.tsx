import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useGetStatus, getGetStatusQueryKey } from "@workspace/api-client-react";
import { Nav } from "@/components/nav";

const STEPS = [
  { label: "Finding your listing", threshold: 10 },
  { label: "Discovering competitors", threshold: 20 },
  { label: "Collecting reviews", threshold: 40 },
  { label: "Running AI analysis", threshold: 85 },
  { label: "Building your dashboard", threshold: 100 },
];

export default function Processing() {
  const params = useParams<{ shareToken: string }>();
  const shareToken = params.shareToken;
  const [, setLocation] = useLocation();

  const { data: status } = useGetStatus(shareToken, {
    query: {
      queryKey: getGetStatusQueryKey(shareToken),
      enabled: !!shareToken,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.status === "COMPLETE" || data?.status === "FAILED") return false;
        return 3000;
      },
    },
  });

  useEffect(() => {
    if (status?.status === "COMPLETE") {
      setTimeout(() => setLocation(`/report/${shareToken}`), 500);
    }
  }, [status?.status, shareToken, setLocation]);

  const pct = status?.percentComplete ?? 0;

  function getStepState(stepIndex: number) {
    const threshold = STEPS[stepIndex].threshold;
    const prevThreshold = stepIndex > 0 ? STEPS[stepIndex - 1].threshold : 0;
    if (pct >= threshold) return "done";
    if (pct >= prevThreshold) return "active";
    return "pending";
  }

  if (status?.status === "FAILED") {
    return (
      <div className="min-h-screen bg-background">
        <Nav />
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/15 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Analysis Failed</h2>
          <p className="text-muted-foreground mb-8 text-sm">
            {status.progressMessage || "An error occurred. Please try again with a different Amazon URL."}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-2xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-14 h-14 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Analyzing Your Market</h2>
          <p className="text-muted-foreground text-sm">
            {status?.progressMessage || "Starting analysis..."}
          </p>
        </motion.div>

        {/* Progress bar */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-muted-foreground">Progress</span>
            <span className="text-xs font-semibold text-primary">{Math.round(pct)}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const state = getStepState(i);
            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  state === "active"
                    ? "border-primary/30 bg-primary/8"
                    : state === "done"
                    ? "border-border bg-card/50"
                    : "border-transparent bg-transparent"
                }`}
                data-testid={`step-${i}`}
              >
                {state === "done" ? (
                  <CheckCircle2 className="w-4 h-4 text-chart-2 shrink-0" />
                ) : state === "active" ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    state === "active"
                      ? "text-foreground font-medium"
                      : state === "done"
                      ? "text-muted-foreground"
                      : "text-muted-foreground/40"
                  }`}
                >
                  {step.label}
                </span>
              </motion.div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          This typically takes 1–3 minutes. Don't close this tab.
        </p>
      </div>
    </div>
  );
}
