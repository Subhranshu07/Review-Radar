import { pgTable, text, serial, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  shareToken: text("share_token").notNull().unique(),
  mainListingUrl: text("main_listing_url").notNull(),
  mainProductTitle: text("main_product_title").notNull().default(""),
  mainProductAsin: text("main_product_asin").notNull().default(""),
  mainProductBrand: text("main_product_brand").notNull().default(""),
  mainProductPrice: real("main_product_price").notNull().default(0),
  mainProductRating: real("main_product_rating").notNull().default(0),
  mainProductReviewCount: integer("main_product_review_count").notNull().default(0),
  mainProductBsr: integer("main_product_bsr").notNull().default(0),
  mainProductBullets: text("main_product_bullets").notNull().default(""),
  estimatedMonthlyRevenue: real("estimated_monthly_revenue").notNull().default(0),
  marketTotalRevenue: real("market_total_revenue").notNull().default(0),
  totalReviewsAnalyzed: integer("total_reviews_analyzed").notNull().default(0),
  marketplace: text("marketplace").notNull().default("com"),
  currencySymbol: text("currency_symbol").notNull().default("$"),
  status: text("status").notNull().default("PENDING"),
  progressMessage: text("progress_message").notNull().default("Starting analysis..."),
  percentComplete: real("percent_complete").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertReportSchema = createInsertSchema(reportsTable).omit({ id: true, createdAt: true });
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reportsTable.$inferSelect;

export const analysisResultsTable = pgTable("analysis_results", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull().references(() => reportsTable.id),
  purchaseDrivers: text("purchase_drivers").notNull().default("[]"),
  keyPhrases: text("key_phrases").notNull().default("[]"),
  buyerPersona: text("buyer_persona").notNull().default(""),
  emotionalTriggers: text("emotional_triggers").notNull().default("[]"),
  topComplaints: text("top_complaints").notNull().default("[]"),
  returnReasons: text("return_reasons").notNull().default("[]"),
  unmetExpectations: text("unmet_expectations").notNull().default("[]"),
  competitorAdvantages: text("competitor_advantages").notNull().default("[]"),
  productWeaknesses: text("product_weaknesses").notNull().default("[]"),
  productStrengths: text("product_strengths").notNull().default("[]"),
  missedPositioning: text("missed_positioning").notNull().default("[]"),
  fixRightNow: text("fix_right_now").notNull().default("[]"),
  featureGaps: text("feature_gaps").notNull().default("[]"),
  quickWins: text("quick_wins").notNull().default("[]"),
  improvedTitle: text("improved_title").notNull().default(""),
  improvedBullets: text("improved_bullets").notNull().default("[]"),
  marketingAngles: text("marketing_angles").notNull().default("[]"),
  adHeadlines: text("ad_headlines").notNull().default("[]"),
  toneAndVoiceNotes: text("tone_and_voice_notes").notNull().default(""),
});

export const insertAnalysisResultSchema = createInsertSchema(analysisResultsTable).omit({ id: true });
export type InsertAnalysisResult = z.infer<typeof insertAnalysisResultSchema>;
export type AnalysisResult = typeof analysisResultsTable.$inferSelect;

export const competitorsTable = pgTable("competitors", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull().references(() => reportsTable.id),
  productTitle: text("product_title").notNull().default(""),
  asin: text("asin").notNull().default(""),
  brand: text("brand").notNull().default(""),
  price: real("price").notNull().default(0),
  rating: real("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  bsr: integer("bsr").notNull().default(0),
  estimatedMonthlyRevenue: real("estimated_monthly_revenue").notNull().default(0),
  bulletPoints: text("bullet_points").notNull().default(""),
  position: integer("position").notNull(),
});

export const insertCompetitorSchema = createInsertSchema(competitorsTable).omit({ id: true });
export type InsertCompetitor = z.infer<typeof insertCompetitorSchema>;
export type Competitor = typeof competitorsTable.$inferSelect;

export const ipRateLimitsTable = pgTable("ip_rate_limits", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull(),
  count: integer("count").notNull().default(1),
  windowStart: timestamp("window_start").notNull().defaultNow(),
});
