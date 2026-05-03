import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Search, ChevronRight, Loader2, Clock } from "lucide-react";
import { useGetReportHistory, getGetReportHistoryQueryKey } from "@workspace/api-client-react";
import { Nav } from "@/components/nav";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
      status === "COMPLETE" ? "bg-chart-2/20 text-green-400" :
      status === "PROCESSING" ? "bg-primary/20 text-primary" :
      status === "FAILED" ? "bg-destructive/20 text-red-400" :
      "bg-secondary text-muted-foreground"
    )}>
      {status}
    </span>
  );
}

export default function History() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  function handleSearchChange(val: string) {
    setSearch(val);
    clearTimeout((window as any)._searchTimer);
    (window as any)._searchTimer = setTimeout(() => setDebouncedSearch(val), 300);
  }

  const { data: reports, isLoading } = useGetReportHistory(
    debouncedSearch ? { search: debouncedSearch } : undefined,
    {
      query: {
        queryKey: getGetReportHistoryQueryKey(debouncedSearch ? { search: debouncedSearch } : undefined),
      },
    }
  );

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Report History</h1>
              <p className="text-muted-foreground text-sm mt-1">All your past market analyses</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by product name..."
                className="pl-9 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm w-full sm:w-64"
                data-testid="input-search"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="text-center py-24">
              <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {search ? "No reports match your search." : "No reports yet. Analyze your first Amazon product to get started."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/50 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Product</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Market Size</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reports.map((report, i) => (
                    <motion.tr
                      key={report.shareToken}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => report.status === "COMPLETE" && setLocation(`/report/${report.shareToken}`)}
                      className={cn(
                        "hover:bg-secondary/30 transition-colors",
                        report.status === "COMPLETE" ? "cursor-pointer" : "cursor-default"
                      )}
                      data-testid={`row-history-${report.shareToken}`}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground font-medium line-clamp-1">{report.productTitle || "—"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{report.shareToken}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(report.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-primary whitespace-nowrap">
                        {report.marketTotalRevenue > 0 ? `${formatCurrency(report.marketTotalRevenue, report.currencySymbol)}/mo` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={report.status} />
                      </td>
                      <td className="px-4 py-3">
                        {report.status === "COMPLETE" && (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
