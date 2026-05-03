import { db } from "@workspace/db";
import {
  reportsTable,
  analysisResultsTable,
  competitorsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  scrapeListing,
  scrapeCompetitorAsins,
  scrapeReviews,
  estimateMonthlyRevenue,
  extractAsinFromUrl,
} from "./scraper";
import {
  runCustomerAnalyst,
  runComplaintDetector,
  runCompetitorStrategist,
  runProductManager,
  runCopywriter,
} from "./groq";

async function updateProgress(
  reportId: number,
  message: string,
  percent: number,
  status = "PROCESSING"
) {
  await db
    .update(reportsTable)
    .set({
      status,
      progressMessage: message,
      percentComplete: percent,
    })
    .where(eq(reportsTable.id, reportId));
}

export async function runPipeline(reportId: number, listingUrl: string) {
  try {
    await updateProgress(reportId, "Fetching your listing...", 5);

    let mainListing;
    try {
      mainListing = await scrapeListing(listingUrl);
    } catch (err) {
      logger.error({ err, listingUrl }, "Failed to scrape main listing");
      await db
        .update(reportsTable)
        .set({ status: "FAILED", progressMessage: "Failed to scrape your listing. Make sure the URL is a valid Amazon product page." })
        .where(eq(reportsTable.id, reportId));
      return;
    }

    const mainRevenue = estimateMonthlyRevenue(mainListing.bsr, mainListing.price);

    await db
      .update(reportsTable)
      .set({
        mainProductTitle: mainListing.title,
        mainProductAsin: mainListing.asin,
        mainProductBrand: mainListing.brand,
        mainProductPrice: mainListing.price,
        mainProductRating: mainListing.rating,
        mainProductReviewCount: mainListing.reviewCount,
        mainProductBsr: mainListing.bsr,
        mainProductBullets: mainListing.bulletPoints,
        estimatedMonthlyRevenue: mainRevenue,
      })
      .where(eq(reportsTable.id, reportId));

    await updateProgress(reportId, "Discovering 9 competitors...", 10);

    let competitorAsins: string[] = [];
    try {
      competitorAsins = await scrapeCompetitorAsins(mainListing.title, mainListing.asin);
    } catch (err) {
      logger.warn({ err }, "Failed to find competitor ASINs");
    }

    await updateProgress(reportId, "Collecting reviews from all listings...", 15);

    const allReviews: { rating: number; title: string; body: string }[] = [];

    // Scrape main product reviews
    try {
      const mainReviews = await scrapeReviews(mainListing.asin);
      allReviews.push(...mainReviews);
    } catch (err) {
      logger.warn({ err }, "Failed to scrape main product reviews");
    }

    // Scrape competitor listings and reviews
    const competitorListings: { title: string; bulletPoints: string; revenue: number; asin: string }[] = [];
    let totalMarketRevenue = mainRevenue;

    for (let i = 0; i < competitorAsins.length; i++) {
      const asin = competitorAsins[i];
      const url = `https://www.amazon.com/dp/${asin}`;
      const pct = 15 + Math.round(((i + 1) / competitorAsins.length) * 25);
      await updateProgress(reportId, `Collecting competitor data (${i + 1}/${competitorAsins.length})...`, pct);

      let listing;
      try {
        listing = await scrapeListing(url);
      } catch {
        logger.warn({ asin }, "Failed to scrape competitor listing, skipping");
        continue;
      }

      const compRevenue = estimateMonthlyRevenue(listing.bsr, listing.price);
      totalMarketRevenue += compRevenue;
      competitorListings.push({ title: listing.title, bulletPoints: listing.bulletPoints, revenue: compRevenue, asin: listing.asin });

      await db.insert(competitorsTable).values({
        reportId,
        productTitle: listing.title,
        asin: listing.asin,
        brand: listing.brand,
        price: listing.price,
        rating: listing.rating,
        reviewCount: listing.reviewCount,
        bsr: listing.bsr,
        estimatedMonthlyRevenue: compRevenue,
        bulletPoints: listing.bulletPoints,
        position: i + 1,
      });

      try {
        const compReviews = await scrapeReviews(asin, 3);
        allReviews.push(...compReviews);
      } catch {
        logger.warn({ asin }, "Failed to scrape competitor reviews, skipping");
      }
    }

    await db
      .update(reportsTable)
      .set({
        marketTotalRevenue: totalMarketRevenue,
        totalReviewsAnalyzed: allReviews.length,
      })
      .where(eq(reportsTable.id, reportId));

    await updateProgress(reportId, "Customer Analyst running... (Role 1 of 5)", 42);
    const customerAnalysis = await runCustomerAnalyst(mainListing.title, allReviews);

    await updateProgress(reportId, "Complaint Detector running... (Role 2 of 5)", 54);
    const complaintAnalysis = await runComplaintDetector(mainListing.title, allReviews);

    await updateProgress(reportId, "Competitor Strategist running... (Role 3 of 5)", 66);
    const competitorAnalysis = await runCompetitorStrategist(
      mainListing.title,
      mainListing.bulletPoints,
      complaintAnalysis,
      competitorListings
    );

    await updateProgress(reportId, "Product Manager running... (Role 4 of 5)", 78);
    const pmAnalysis = await runProductManager(mainListing.title, complaintAnalysis, competitorAnalysis);

    await updateProgress(reportId, "Copywriter running... (Role 5 of 5)", 88);
    const copyAnalysis = await runCopywriter(
      mainListing.title,
      mainListing.title,
      mainListing.bulletPoints,
      customerAnalysis,
      complaintAnalysis,
      competitorAnalysis
    );

    await updateProgress(reportId, "Building your dashboard...", 95);

    await db.insert(analysisResultsTable).values({
      reportId,
      purchaseDrivers: JSON.stringify(customerAnalysis.topPurchaseDrivers),
      keyPhrases: JSON.stringify(customerAnalysis.keyPhrasesCustomersUse),
      buyerPersona: customerAnalysis.primaryBuyerPersona,
      emotionalTriggers: JSON.stringify(customerAnalysis.emotionalTriggers),
      topComplaints: JSON.stringify(complaintAnalysis.topComplaints),
      returnReasons: JSON.stringify(complaintAnalysis.returnReasons),
      unmetExpectations: JSON.stringify(complaintAnalysis.unmetExpectations),
      competitorAdvantages: JSON.stringify(competitorAnalysis.whatCompetitorsEmphasizeBetter),
      productWeaknesses: JSON.stringify(competitorAnalysis.mainProductWeaknesses),
      productStrengths: JSON.stringify(competitorAnalysis.mainProductStrengths),
      missedPositioning: JSON.stringify(competitorAnalysis.missedPositioningOpportunities),
      fixRightNow: JSON.stringify(pmAnalysis.fixRightNow),
      featureGaps: JSON.stringify(pmAnalysis.featureGaps),
      quickWins: JSON.stringify(pmAnalysis.quickWins),
      improvedTitle: copyAnalysis.improvedTitle,
      improvedBullets: JSON.stringify(copyAnalysis.improvedBullets),
      marketingAngles: JSON.stringify(copyAnalysis.marketingAngles),
      adHeadlines: JSON.stringify(copyAnalysis.suggestedAdHeadlines),
      toneAndVoiceNotes: copyAnalysis.toneAndVoiceNotes,
    });

    await db
      .update(reportsTable)
      .set({
        status: "COMPLETE",
        progressMessage: "Analysis complete!",
        percentComplete: 100,
        completedAt: new Date(),
      })
      .where(eq(reportsTable.id, reportId));

    logger.info({ reportId }, "Pipeline completed successfully");
  } catch (err) {
    logger.error({ err, reportId }, "Pipeline failed");
    await db
      .update(reportsTable)
      .set({
        status: "FAILED",
        progressMessage: "An unexpected error occurred. Please try again.",
      })
      .where(eq(reportsTable.id, reportId));
  }
}
