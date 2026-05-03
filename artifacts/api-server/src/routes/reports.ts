import { Router } from "express";
import { db } from "@workspace/db";
import {
  reportsTable,
  analysisResultsTable,
  competitorsTable,
  ipRateLimitsTable,
} from "@workspace/db";
import { eq, desc, ilike, sql } from "drizzle-orm";
import { runPipeline } from "../services/pipeline";
import { extractAsinFromUrl } from "../services/scraper";

const router = Router();

function generateShareToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function isValidAmazonUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isAmazon =
      host === "amazon.com" ||
      host === "www.amazon.com" ||
      host === "amazon.in" ||
      host === "www.amazon.in";
    return isAmazon && /\/dp\/[A-Z0-9]{10}/.test(url);
  } catch {
    return false;
  }
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

// POST /api/analyze
router.post("/analyze", async (req, res) => {
  const ip = req.ip || "unknown";
  const { listingUrl } = req.body as { listingUrl?: string };

  if (!listingUrl || !isValidAmazonUrl(listingUrl)) {
    res.status(400).json({ error: "Please provide a valid Amazon product URL (e.g. https://www.amazon.com/dp/ASIN)" });
    return;
  }

  // Rate limiting: max 3 per IP per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const existing = await db
    .select()
    .from(ipRateLimitsTable)
    .where(eq(ipRateLimitsTable.ip, ip))
    .limit(1);

  if (existing.length > 0) {
    const record = existing[0];
    if (record.windowStart > oneHourAgo && record.count >= 3) {
      res.status(429).json({ error: "Rate limit exceeded. You can analyze 3 markets per hour. Please try again later." });
      return;
    }
    if (record.windowStart <= oneHourAgo) {
      await db
        .update(ipRateLimitsTable)
        .set({ count: 1, windowStart: new Date() })
        .where(eq(ipRateLimitsTable.ip, ip));
    } else {
      await db
        .update(ipRateLimitsTable)
        .set({ count: record.count + 1 })
        .where(eq(ipRateLimitsTable.ip, ip));
    }
  } else {
    await db.insert(ipRateLimitsTable).values({ ip, count: 1, windowStart: new Date() });
  }

  const shareToken = generateShareToken();

  const [report] = await db
    .insert(reportsTable)
    .values({
      shareToken,
      mainListingUrl: listingUrl,
      status: "PENDING",
      progressMessage: "Starting analysis...",
      percentComplete: 0,
    })
    .returning();

  // Fire and forget
  runPipeline(report.id, listingUrl).catch((err) => {
    console.error("Pipeline error:", err);
  });

  res.json({ shareToken });
});

// GET /api/status/:shareToken
router.get("/status/:shareToken", async (req, res) => {
  const { shareToken } = req.params;
  const [report] = await db
    .select({
      status: reportsTable.status,
      progressMessage: reportsTable.progressMessage,
      percentComplete: reportsTable.percentComplete,
    })
    .from(reportsTable)
    .where(eq(reportsTable.shareToken, shareToken))
    .limit(1);

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  res.json({
    status: report.status,
    progressMessage: report.progressMessage,
    percentComplete: report.percentComplete,
  });
});

// GET /api/report/:shareToken
router.get("/report/:shareToken", async (req, res) => {
  const { shareToken } = req.params;

  const [report] = await db
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.shareToken, shareToken))
    .limit(1);

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  const [analysis] = await db
    .select()
    .from(analysisResultsTable)
    .where(eq(analysisResultsTable.reportId, report.id))
    .limit(1);

  const competitors = await db
    .select()
    .from(competitorsTable)
    .where(eq(competitorsTable.reportId, report.id))
    .orderBy(competitorsTable.position);

  const emptyAnalysis = {
    purchaseDrivers: [],
    keyPhrases: [],
    buyerPersona: "",
    emotionalTriggers: [],
    topComplaints: [],
    returnReasons: [],
    unmetExpectations: [],
    competitorAdvantages: [],
    productWeaknesses: [],
    productStrengths: [],
    missedPositioning: [],
    fixRightNow: [],
    featureGaps: [],
    quickWins: [],
    improvedTitle: "",
    improvedBullets: [],
    marketingAngles: [],
    adHeadlines: [],
    toneAndVoiceNotes: "",
  };

  const parsedAnalysis = analysis
    ? {
        purchaseDrivers: parseJson(analysis.purchaseDrivers, []),
        keyPhrases: parseJson(analysis.keyPhrases, []),
        buyerPersona: analysis.buyerPersona,
        emotionalTriggers: parseJson(analysis.emotionalTriggers, []),
        topComplaints: parseJson(analysis.topComplaints, []),
        returnReasons: parseJson(analysis.returnReasons, []),
        unmetExpectations: parseJson(analysis.unmetExpectations, []),
        competitorAdvantages: parseJson(analysis.competitorAdvantages, []),
        productWeaknesses: parseJson(analysis.productWeaknesses, []),
        productStrengths: parseJson(analysis.productStrengths, []),
        missedPositioning: parseJson(analysis.missedPositioning, []),
        fixRightNow: parseJson(analysis.fixRightNow, []),
        featureGaps: parseJson(analysis.featureGaps, []),
        quickWins: parseJson(analysis.quickWins, []),
        improvedTitle: analysis.improvedTitle,
        improvedBullets: parseJson(analysis.improvedBullets, []),
        marketingAngles: parseJson(analysis.marketingAngles, []),
        adHeadlines: parseJson(analysis.adHeadlines, []),
        toneAndVoiceNotes: analysis.toneAndVoiceNotes,
      }
    : emptyAnalysis;

  res.json({
    id: report.id,
    shareToken: report.shareToken,
    mainListingUrl: report.mainListingUrl,
    mainProductTitle: report.mainProductTitle,
    mainProductAsin: report.mainProductAsin,
    mainProductBrand: report.mainProductBrand,
    mainProductPrice: report.mainProductPrice,
    mainProductRating: report.mainProductRating,
    mainProductReviewCount: report.mainProductReviewCount,
    mainProductBsr: report.mainProductBsr,
    mainProductBullets: report.mainProductBullets,
    estimatedMonthlyRevenue: report.estimatedMonthlyRevenue,
    marketTotalRevenue: report.marketTotalRevenue,
    totalReviewsAnalyzed: report.totalReviewsAnalyzed,
    marketplace: report.marketplace,
    currencySymbol: report.currencySymbol,
    status: report.status,
    createdAt: report.createdAt?.toISOString() ?? "",
    completedAt: report.completedAt?.toISOString() ?? "",
    analysis: parsedAnalysis,
    competitors: competitors.map((c) => ({
      id: c.id,
      productTitle: c.productTitle,
      asin: c.asin,
      brand: c.brand,
      price: c.price,
      rating: c.rating,
      reviewCount: c.reviewCount,
      bsr: c.bsr,
      estimatedMonthlyRevenue: c.estimatedMonthlyRevenue,
      bulletPoints: c.bulletPoints,
      position: c.position,
    })),
  });
});

// GET /api/reports/recent
router.get("/reports/recent", async (_req, res) => {
  const reports = await db
    .select({
      shareToken: reportsTable.shareToken,
      productTitle: reportsTable.mainProductTitle,
      marketTotalRevenue: reportsTable.marketTotalRevenue,
      createdAt: reportsTable.createdAt,
    })
    .from(reportsTable)
    .where(eq(reportsTable.status, "COMPLETE"))
    .orderBy(desc(reportsTable.createdAt))
    .limit(10);

  res.json(
    reports.map((r) => ({
      shareToken: r.shareToken,
      productTitle: r.productTitle,
      marketTotalRevenue: r.marketTotalRevenue,
      currencySymbol: r.currencySymbol,
      createdAt: r.createdAt?.toISOString() ?? "",
    }))
  );
});

// GET /api/reports/history
router.get("/reports/history", async (req, res) => {
  const search = req.query.search as string | undefined;

  let query = db
    .select({
      shareToken: reportsTable.shareToken,
      productTitle: reportsTable.mainProductTitle,
      marketTotalRevenue: reportsTable.marketTotalRevenue,
      currencySymbol: reportsTable.currencySymbol,
      status: reportsTable.status,
      createdAt: reportsTable.createdAt,
    })
    .from(reportsTable)
    .orderBy(desc(reportsTable.createdAt))
    .limit(100);

  const rows = await query;

  const filtered = search
    ? rows.filter((r) =>
        r.productTitle.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  res.json(
    filtered.map((r) => ({
      shareToken: r.shareToken,
      productTitle: r.productTitle,
      marketTotalRevenue: r.marketTotalRevenue,
      currencySymbol: r.currencySymbol,
      status: r.status,
      createdAt: r.createdAt?.toISOString() ?? "",
    }))
  );
});

// GET /api/stats
router.get("/stats", async (_req, res) => {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(reportsTable)
    .where(eq(reportsTable.status, "COMPLETE"));

  const [reviewRow] = await db
    .select({ total: sql<number>`coalesce(sum(total_reviews_analyzed), 0)` })
    .from(reportsTable)
    .where(eq(reportsTable.status, "COMPLETE"));

  res.json({
    totalReportsGenerated: Number(countRow?.count ?? 0),
    totalReviewsAnalyzed: Number(reviewRow?.total ?? 0),
  });
});

export default router;
