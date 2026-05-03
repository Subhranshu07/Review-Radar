import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, symbol = "$"): string {
  if (value >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${symbol}${Math.round(value / 1_000).toLocaleString()}K`;
  }
  return `${symbol}${Math.round(value).toLocaleString()}`;
}

export function formatCurrencyFull(value: number, symbol = "$"): string {
  return `${symbol}${Math.round(value).toLocaleString()}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}
