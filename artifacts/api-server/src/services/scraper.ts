import axios from "axios";
import * as cheerio from "cheerio";
import { logger } from "../lib/logger";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay() {
  return sleep(1000 + Math.random() * 1000);
}

/** Returns "in" for amazon.in / amzn.in URLs, "com" for everything else */
export function detectMarketplace(url: string): "in" | "com" {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (
      hostname === "amazon.in" ||
      hostname === "www.amazon.in" ||
      hostname === "amzn.in"
    )
      return "in";
  } catch {}
  return "com";
}

export function getAmazonDomain(marketplace: "in" | "com"): string {
  return marketplace === "in" ? "amazon.in" : "amazon.com";
}

export function getCurrencySymbol(marketplace: "in" | "com"): string {
  return marketplace === "in" ? "₹" : "$";
}

async function fetchPage(url: string, attempt = 1): Promise<string> {
  try {
    await randomDelay();
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const body = res.data as string;
    if (
      body.toLowerCase().includes("robot") ||
      body.toLowerCase().includes("captcha")
    ) {
      throw new Error("bot-detected");
    }
    return body;
  } catch (err) {
    if (attempt === 1 && SCRAPERAPI_KEY) {
      logger.warn({ url }, "Direct scrape failed, falling back to ScraperAPI");
      const encodedUrl = encodeURIComponent(url);
      await sleep(1000);
      const res = await axios.get(
        `http://api.scraperapi.com?api_key=${SCRAPERAPI_KEY}&url=${encodedUrl}`,
        { timeout: 30000 }
      );
      return res.data as string;
    }
    throw err;
  }
}

export function extractAsinFromUrl(url: string): string | null {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/);
  return match ? match[1] : null;
}

/**
 * Accepts any Amazon URL format and returns a clean canonical URL:
 *   https://www.amazon.in/dp/{ASIN}  or  https://www.amazon.com/dp/{ASIN}
 *
 * Handles:
 *   - https://www.amazon.in/dp/B0DWMQDYSZ
 *   - https://amazon.com/dp/B0DWMQDYSZ/ref=...
 *   - https://amzn.in/d/02RJrT7Z   (follows HTTP redirect)
 *   - https://amzn.com/d/02RJrT7Z  (follows HTTP redirect)
 */
export async function resolveAmazonUrl(inputUrl: string): Promise<string> {
  let url = inputUrl.trim();
  if (!url.startsWith("http")) url = "https://" + url;

  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const isShortUrl = host === "amzn.in" || host === "amzn.com";

  if (isShortUrl) {
    // Infer marketplace from short-URL domain before following redirect
    const marketplace: "in" | "com" = host === "amzn.in" ? "in" : "com";
    const domain = getAmazonDomain(marketplace);

    try {
      const res = await axios.get(url, {
        headers: { "User-Agent": HEADERS["User-Agent"] },
        maxRedirects: 10,
        timeout: 12000,
      });
      // axios (via follow-redirects) exposes the final URL here
      const finalUrl: string =
        (res.request as { res?: { responseUrl?: string } })?.res?.responseUrl ||
        url;
      const asin = extractAsinFromUrl(finalUrl);
      if (!asin) throw new Error(`No ASIN found in resolved URL: ${finalUrl}`);
      return `https://www.${domain}/dp/${asin}`;
    } catch (err) {
      logger.warn({ url, err }, "Failed to resolve short Amazon URL");
      throw new Error("Could not resolve the short URL. Please use the full Amazon product URL.");
    }
  }

  // Full URL — just extract ASIN and rebuild a clean canonical URL
  const asin = extractAsinFromUrl(url);
  if (!asin) throw new Error(`No ASIN found in URL: ${url}`);
  const marketplace = detectMarketplace(url);
  const domain = getAmazonDomain(marketplace);
  return `https://www.${domain}/dp/${asin}`;
}

export interface ListingData {
  title: string;
  brand: string;
  price: number;
  rating: number;
  reviewCount: number;
  bsr: number;
  asin: string;
  bulletPoints: string;
}

export interface Review {
  rating: number;
  title: string;
  body: string;
}

export async function scrapeListing(url: string): Promise<ListingData> {
  const html = await fetchPage(url);
  const $ = cheerio.load(html);

  const title = $("#productTitle").text().trim() || $("h1.a-size-large").text().trim();

  const brand =
    $("#bylineInfo").text().replace(/^(Visit the|Brand:|by)/i, "").trim() ||
    $(".po-brand .a-span9 span").text().trim();

  const priceText =
    $(".a-price .a-offscreen").first().text() ||
    $("#priceblock_ourprice").text() ||
    $("#priceblock_dealprice").text();
  // Strip all non-numeric chars except decimal point — works for both $ and ₹
  const price = parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0;

  const ratingText = $(".a-icon-alt").first().text();
  const rating = parseFloat(ratingText) || 0;

  const reviewCountText = $("#acrCustomerReviewText").first().text();
  const reviewCount = parseInt(reviewCountText.replace(/[^0-9]/g, "")) || 0;

  let bsr = 0;
  $("#productDetails_detailBullets_sections1 tr, #detailBulletsWrapper_feature_div li").each(
    (_, el) => {
      const text = $(el).text();
      if (text.toLowerCase().includes("best seller")) {
        const match = text.match(/#([\d,]+)/);
        if (match) bsr = parseInt(match[1].replace(/,/g, ""));
      }
    }
  );

  const bullets: string[] = [];
  $("#feature-bullets ul li span.a-list-item").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 5) bullets.push(text);
  });

  const asin = extractAsinFromUrl(url) || "";

  return {
    title,
    brand,
    price,
    rating,
    reviewCount,
    bsr,
    asin,
    bulletPoints: bullets.slice(0, 5).join("\n"),
  };
}

/**
 * Extracts a tight, category-focused search query from a product title.
 *
 * Strategy:
 *  1. Strip parenthetical content  e.g. "(2024 Model, White)"
 *  2. Remove the brand name        e.g. "LG", "Samsung"
 *  3. Remove model-number tokens   e.g. "B0DWMQDYSZ", "KS-Q18YNZA"
 *  4. Remove marketing noise words e.g. "New", "Best", "Latest"
 *  5. Keep the first 6 meaningful words — those describe the core product
 *
 * Examples:
 *  "LG 1.5 Ton 5 Star AI DUAL Inverter Split AC (2024, White)" + brand "LG"
 *    → "1.5+Ton+5+Star+Inverter+Split+AC"
 *
 *  "Apple iPhone 15 Pro Max 256GB Natural Titanium" + brand "Apple"
 *    → "iPhone+15+Pro+Max"
 */
const NOISE_WORDS = new Set([
  "the", "and", "for", "with", "in", "of", "a", "an", "at", "by", "from",
  "new", "latest", "updated", "best", "top", "premium", "original", "genuine",
  "official", "certified", "authorized", "imported",
  "black", "white", "silver", "gold", "blue", "red", "green", "grey", "gray",
  "colour", "color", "pack", "set", "combo", "kit", "bundle",
  "edition", "version", "series", "style", "design", "type",
]);

/** True if a word looks like a model/part number: 5+ chars, contains a digit */
function isModelNumber(word: string): boolean {
  return word.length >= 5 && /\d/.test(word) && /^[A-Za-z0-9\-_]+$/.test(word);
}

export function extractSearchKeywords(title: string, brand = ""): string {
  // 1. Remove parenthetical content
  let text = title.replace(/\(.*?\)/g, " ");

  // 2. Remove brand name (case-insensitive, whole word)
  if (brand.trim()) {
    const escaped = brand.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  }

  // 3. Tokenise and filter
  const kept = text
    .split(/\s+/)
    .filter((word) => {
      const w = word.replace(/[^A-Za-z0-9.]/g, ""); // strip punctuation
      if (!w || w.length < 2) return false;
      if (isModelNumber(w)) return false;
      if (NOISE_WORDS.has(w.toLowerCase())) return false;
      return true;
    })
    .slice(0, 7);

  return kept.join("+").replace(/[^A-Za-z0-9+.]/g, "");
}

export async function scrapeCompetitorAsins(
  productTitle: string,
  ownAsin: string,
  marketplace: "in" | "com" = "com",
  brand = ""
): Promise<string[]> {
  const domain = getAmazonDomain(marketplace);
  const keywords = extractSearchKeywords(productTitle, brand);
  logger.info({ keywords }, "Competitor search query");
  const searchUrl = `https://www.${domain}/s?k=${encodeURIComponent(keywords.replace(/\+/g, " "))}`;

  let html: string;
  try {
    html = await fetchPage(searchUrl);
  } catch {
    return [];
  }

  const $ = cheerio.load(html);
  const asins: string[] = [];

  $("[data-asin]").each((_, el) => {
    const asin = $(el).attr("data-asin");
    if (asin && asin.length === 10 && asin !== ownAsin && !asins.includes(asin)) {
      asins.push(asin);
    }
  });

  // Return more candidates than needed so the pipeline can filter same-brand
  // and out-of-price-range products and still end up with up to 9 true competitors
  return asins.slice(0, 30);
}

export async function scrapeReviews(
  asin: string,
  maxPages = 5,
  marketplace: "in" | "com" = "com"
): Promise<Review[]> {
  const domain = getAmazonDomain(marketplace);
  const reviews: Review[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = `https://www.${domain}/product-reviews/${asin}?pageNumber=${page}&sortBy=recent`;
    let html: string;
    try {
      html = await fetchPage(url);
    } catch {
      break;
    }

    const $ = cheerio.load(html);
    let found = 0;

    $("[data-hook='review']").each((_, el) => {
      const ratingText = $(el)
        .find("[data-hook='review-star-rating'] .a-icon-alt")
        .text();
      const rating = parseFloat(ratingText) || 0;
      const title = $(el).find("[data-hook='review-title'] span").last().text().trim();
      const body = $(el).find("[data-hook='review-body'] span").text().trim();
      if (body) {
        reviews.push({ rating, title, body });
        found++;
      }
    });

    if (found === 0) break;
  }

  return reviews;
}

export function estimateMonthlyRevenue(bsr: number, price: number): number {
  // Calibrated for Indian market — US multipliers overestimate by ~5x.
  // Max capped at 30 units/day for BSR ≤ 100, scaling down from there.
  let dailyUnits = 0;
  if (bsr <= 100) dailyUnits = 30;
  else if (bsr <= 500) dailyUnits = 16;
  else if (bsr <= 1000) dailyUnits = 10;
  else if (bsr <= 5000) dailyUnits = 5;
  else if (bsr <= 10000) dailyUnits = 2;
  else if (bsr <= 50000) dailyUnits = 1;
  else if (bsr <= 100000) dailyUnits = 0.4;
  else dailyUnits = 0.1;
  return Math.round(dailyUnits * 30 * price);
}
