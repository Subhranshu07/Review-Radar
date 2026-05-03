import { Link, useLocation } from "wouter";
import { BarChart3, History, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function Nav() {
  const [location] = useLocation();

  return (
    <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground tracking-tight">Review Radar</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/"
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                location === "/"
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              data-testid="link-home"
            >
              Analyze
            </Link>
            <Link
              href="/history"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                location === "/history"
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              data-testid="link-history"
            >
              <History className="w-3.5 h-3.5" />
              History
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
