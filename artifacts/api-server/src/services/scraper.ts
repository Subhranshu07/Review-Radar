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

export async function scrapeCompetitorAsins(
  productTitle: string,
  ownAsin: string
): Promise<string[]> {
  const keywords = productTitle
    .split(" ")
    .slice(0, 5)
    .join("+")
    .replace(/[^a-zA-Z0-9+]/g, "");
  const searchUrl = `https://www.amazon.com/s?k=${keywords}`;

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

  return asins.slice(0, 9);
}

export async function scrapeReviews(asin: string, maxPages = 5): Promise<Review[]> {
  const reviews: Review[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = `https://www.amazon.com/product-reviews/${asin}?pageNumber=${page}&sortBy=recent`;
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
  let dailyUnits = 0;
  if (bsr <= 100) dailyUnits = 150;
  else if (bsr <= 500) dailyUnits = 80;
  else if (bsr <= 1000) dailyUnits = 50;
  else if (bsr <= 5000) dailyUnits = 25;
  else if (bsr <= 10000) dailyUnits = 12;
  else if (bsr <= 50000) dailyUnits = 5;
  else if (bsr <= 100000) dailyUnits = 2;
  else dailyUnits = 0.5;
  return dailyUnits * 30 * price;
}
