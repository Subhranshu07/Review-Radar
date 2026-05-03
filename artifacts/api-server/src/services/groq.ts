import axios from "axios";
import { logger } from "../lib/logger";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// llama-3.1-8b-instant has 131,072 TPM vs llama-3.3-70b-versatile's 12,000 TPM
// One call of ~4000 tokens leaves us room for 32 analyses/minute before hitting limits
const MODEL = "llama-3.1-8b-instant";

function truncateToChars(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

function stripFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(stripFences(raw)) as T;
  } catch (err) {
    logger.warn({ raw: raw.slice(0, 300), err }, "JSON parse failed, using fallback");
    return fallback;
  }
}

export interface ReviewText {
  rating: number;
  title: string;
  body: string;
}

export interface FullAnalysisResult {
  purchaseDrivers: { driver: string; percentage: number; examplePhrase: string }[];
  keyPhrases: string[];
  buyerPersona: string;
  emotionalTriggers: string[];
  topComplaints: { complaint: string; severity: string; frequency: string; exampleQuote: string }[];
  returnReasons: string[];
  unmetExpectations: string[];
  competitorAdvantages: { point: string; howManyCompetitorsMention: number }[];
  productWeaknesses: string[];
  productStrengths: string[];
  missedPositioning: string[];
  fixRightNow: { action: string; impact: string; effort: string; reasoning: string }[];
  featureGaps: string[];
  quickWins: string[];
  improvedTitle: string;
  improvedBullets: string[];
  marketingAngles: { angle: string; targetAudience: string; hook: string }[];
  adHeadlines: string[];
  toneAndVoiceNotes: string;
}

const FALLBACK: FullAnalysisResult = {
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

/** Sample reviews: interleave low-rated and high-rated for balanced signal */
function sampleReviews(reviews: ReviewText[], maxChars: number): string {
  const sorted = [...reviews].sort((a, b) => a.rating - b.rating);
  const sampled: ReviewText[] = [];
  let lo = 0;
  let hi = sorted.length - 1;
  let toggle = true;
  while (lo <= hi && sampled.length < 100) {
    if (toggle) sampled.push(sorted[lo++]);
    else sampled.push(sorted[hi--]);
    toggle = !toggle;
  }
  return truncateToChars(
    sampled.map((r) => `[${r.rating}★] ${r.title}: ${r.body}`).join("\n"),
    maxChars
  );
}

/**
 * Single Groq call that runs all 5 analysis roles at once.
 * Using llama-3.1-8b-instant (131,072 TPM) — one analysis uses ~4000 tokens,
 * so we have headroom for 30+ analyses per minute without hitting rate limits.
 */
export async function runFullAnalysis(
  productTitle: string,
  bulletPoints: string,
  reviews: ReviewText[],
  competitors: { title: string; bulletPoints: string }[]
): Promise<FullAnalysisResult> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");

  const reviewText = sampleReviews(reviews, 3000);
  const competitorText = truncateToChars(
    competitors
      .map((c, i) => `${i + 1}. ${c.title} — ${truncateToChars(c.bulletPoints, 200)}`)
      .join("\n"),
    1500
  );

  const systemPrompt = `You are an elite Amazon market intelligence system combining customer psychology, competitive analysis, product management, and copywriting expertise. You analyze reviews and competitor data to produce actionable insights for Amazon sellers. Always respond with valid JSON only — no extra text, no markdown fences.`;

  const userPrompt = `Perform a complete market intelligence analysis for this Amazon product.

PRODUCT: "${productTitle}"
CURRENT BULLETS: ${truncateToChars(bulletPoints, 400)}

REVIEWS (${reviews.length} total, sample shown):
${reviewText}

COMPETITORS:
${competitorText || "No competitor data available."}

Return this exact JSON (no other text):
{
  "purchaseDrivers": [
    {"driver": string, "percentage": number, "examplePhrase": string}
  ],
  "keyPhrases": [string, string, string, string, string],
  "buyerPersona": string,
  "emotionalTriggers": [string, string, string],
  "topComplaints": [
    {"complaint": string, "severity": "HIGH|MEDIUM|LOW", "frequency": string, "exampleQuote": string}
  ],
  "returnReasons": [string, string, string],
  "unmetExpectations": [string, string, string],
  "competitorAdvantages": [
    {"point": string, "howManyCompetitorsMention": number}
  ],
  "productWeaknesses": [string, string, string],
  "productStrengths": [string, string, string],
  "missedPositioning": [string, string, string],
  "fixRightNow": [
    {"action": string, "impact": "HIGH|MEDIUM", "effort": "EASY|MEDIUM|HARD", "reasoning": string}
  ],
  "featureGaps": [string, string, string],
  "quickWins": [string, string, string],
  "improvedTitle": string,
  "improvedBullets": [string, string, string, string, string],
  "marketingAngles": [
    {"angle": string, "targetAudience": string, "hook": string}
  ],
  "adHeadlines": [string, string, string],
  "toneAndVoiceNotes": string
}

Rules:
- purchaseDrivers: exactly 5 items ordered by frequency
- topComplaints: exactly 5 items ordered by severity
- fixRightNow: exactly 5 items ranked by impact — be very specific and actionable
- improvedTitle: under 200 chars, keyword-rich
- improvedBullets: each starts with a customer benefit, not a feature
- marketingAngles: exactly 3 items`;

  const res = await axios.post(
    GROQ_URL,
    {
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2500,
    },
    {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 90000,
    }
  );

  const raw = (res.data as any).choices[0].message.content as string;
  logger.info({ model: MODEL, tokens: (res.data as any).usage }, "Groq call complete");

  return safeParseJson<FullAnalysisResult>(raw, FALLBACK);
}
