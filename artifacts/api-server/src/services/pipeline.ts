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
  detectMarketplace,
  getAmazonDomain,
  getCurrencySymbol,
} from "./scraper";
import { runFullAnalysis } from "./groq";

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
    const marketplace = detectMarketplace(listingUrl);
    const domain = getAmazonDomain(marketplace);
    const currencySymbol = getCurrencySymbol(marketplace);

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
        marketplace,
        currencySymbol,
      })
      .where(eq(reportsTable.id, reportId));

    await updateProgress(reportId, "Discovering 9 competitors...", 10);

    let competitorAsins: string[] = [];
    try {
      competitorAsins = await scrapeCompetitorAsins(mainListing.title, mainListing.asin, marketplace);
    } catch (err) {
      logger.warn({ err }, "Failed to find competitor ASINs");
    }

    await updateProgress(reportId, "Collecting reviews from all listings...", 15);

    const allReviews: { rating: number; title: string; body: string }[] = [];

    // Scrape main product reviews
    try {
      const mainReviews = await scrapeReviews(mainListing.asin, 5, marketplace);
      allReviews.push(...mainReviews);
    } catch (err) {
      logger.warn({ err }, "Failed to scrape main product reviews");
    }

    // Scrape competitor listings and reviews — skip same-brand products
    const competitorListings: { title: string; bulletPoints: string; revenue: number; asin: string }[] = [];
    let totalMarketRevenue = mainRevenue;
    const mainBrand = (mainListing.brand || "").toLowerCase().trim();
    let competitorPosition = 1;

    for (let i = 0; i < competitorAsins.length && competitorListings.length < 9; i++) {
      const asin = competitorAsins[i];
      const url = `https://www.${domain}/dp/${asin}`;
      await updateProgress(
        reportId,
        `Collecting competitor data (${competitorListings.length + 1}/9)...`,
        15 + Math.round(((competitorListings.length + 1) / 9) * 25)
      );

      let listing;
      try {
        listing = await scrapeListing(url);
      } catch {
        logger.warn({ asin }, "Failed to scrape competitor listing, skipping");
        continue;
      }

      // Skip products from the same brand — we want true competitors
      const listingBrand = (listing.brand || "").toLowerCase().trim();
      if (mainBrand && listingBrand && listingBrand === mainBrand) {
        logger.info({ asin, brand: listing.brand }, "Skipping same-brand product");
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
        position: competitorPosition++,
      });

      try {
        const compReviews = await scrapeReviews(asin, 3, marketplace);
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

    await updateProgress(reportId, "Running AI analysis...", 50);
    const analysis = await runFullAnalysis(
      mainListing.title,
      mainListing.bulletPoints,
      allReviews,
      competitorListings
    );

    await updateProgress(reportId, "Building your dashboard...", 95);

    await db.insert(analysisResultsTable).values({
      reportId,
      purchaseDrivers: JSON.stringify(analysis.purchaseDrivers),
      keyPhrases: JSON.stringify(analysis.keyPhrases),
      buyerPersona: analysis.buyerPersona,
      emotionalTriggers: JSON.stringify(analysis.emotionalTriggers),
      topComplaints: JSON.stringify(analysis.topComplaints),
      returnReasons: JSON.stringify(analysis.returnReasons),
      unmetExpectations: JSON.stringify(analysis.unmetExpectations),
      competitorAdvantages: JSON.stringify(analysis.competitorAdvantages),
      productWeaknesses: JSON.stringify(analysis.productWeaknesses),
      productStrengths: JSON.stringify(analysis.productStrengths),
      missedPositioning: JSON.stringify(analysis.missedPositioning),
      fixRightNow: JSON.stringify(analysis.fixRightNow),
      featureGaps: JSON.stringify(analysis.featureGaps),
      quickWins: JSON.stringify(analysis.quickWins),
      improvedTitle: analysis.improvedTitle,
      improvedBullets: JSON.stringify(analysis.improvedBullets),
      marketingAngles: JSON.stringify(analysis.marketingAngles),
      adHeadlines: JSON.stringify(analysis.adHeadlines),
      toneAndVoiceNotes: analysis.toneAndVoiceNotes,
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
