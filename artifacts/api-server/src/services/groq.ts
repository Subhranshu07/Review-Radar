import axios from "axios";
import { logger } from "../lib/logger";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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

async function groqCall(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");

  const res = await axios.post(
    GROQ_URL,
    {
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    },
    {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    }
  );

  return (res.data as any).choices[0].message.content as string;
}

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(stripFences(raw)) as T;
  } catch (err) {
    logger.warn({ raw: raw.slice(0, 200), err }, "JSON parse failed, using fallback");
    return fallback;
  }
}

export interface CustomerAnalysis {
  topPurchaseDrivers: { driver: string; percentage: number; examplePhrase: string }[];
  keyPhrasesCustomersUse: string[];
  primaryBuyerPersona: string;
  emotionalTriggers: string[];
}

export interface ComplaintAnalysis {
  topComplaints: { complaint: string; severity: string; frequency: string; exampleQuote: string }[];
  returnReasons: string[];
  unmetExpectations: string[];
  qualityIssues: string[];
}

export interface CompetitorAnalysis {
  whatCompetitorsEmphasizeBetter: { point: string; howManyCompetitorsMention: number }[];
  mainProductWeaknesses: string[];
  mainProductStrengths: string[];
  missedPositioningOpportunities: string[];
}

export interface ProductManagerAnalysis {
  fixRightNow: { action: string; impact: string; effort: string; reasoning: string }[];
  featureGaps: string[];
  quickWins: string[];
}

export interface CopywriterAnalysis {
  improvedTitle: string;
  improvedBullets: string[];
  marketingAngles: { angle: string; targetAudience: string; hook: string }[];
  suggestedAdHeadlines: string[];
  toneAndVoiceNotes: string;
}

export interface ReviewText {
  rating: number;
  title: string;
  body: string;
}

export async function runCustomerAnalyst(
  productTitle: string,
  reviews: ReviewText[]
): Promise<CustomerAnalysis> {
  const reviewText = truncateToChars(
    reviews.map((r) => `[${r.rating}★] ${r.title}: ${r.body}`).join("\n"),
    6000
  );

  const raw = await groqCall(
    "You are a customer psychology expert specializing in e-commerce. Analyze product reviews to identify what drives purchase decisions. Respond in valid JSON only, no other text.",
    `Analyze these Amazon reviews for '${productTitle}':\n\n${reviewText}\n\nReturn this exact JSON structure:\n{\n  "topPurchaseDrivers": [\n    {"driver": string, "percentage": number, "examplePhrase": string}\n  ],\n  "keyPhrasesCustomersUse": [string, string, string, string, string],\n  "primaryBuyerPersona": string,\n  "emotionalTriggers": [string, string, string]\n}\ntopPurchaseDrivers should have exactly 5 items, ordered by frequency. percentage is your estimate of how many reviewers mentioned this.`
  );

  return safeParseJson<CustomerAnalysis>(raw, {
    topPurchaseDrivers: [],
    keyPhrasesCustomersUse: [],
    primaryBuyerPersona: "",
    emotionalTriggers: [],
  });
}

export async function runComplaintDetector(
  productTitle: string,
  reviews: ReviewText[]
): Promise<ComplaintAnalysis> {
  await sleep(500);
  const reviewText = truncateToChars(
    reviews.map((r) => `[${r.rating}★] ${r.title}: ${r.body}`).join("\n"),
    6000
  );

  const raw = await groqCall(
    "You are an expert at identifying product failures and customer frustrations from Amazon reviews. Respond in valid JSON only, no other text.",
    `Analyze complaints and negative patterns in these reviews for '${productTitle}':\n\n${reviewText}\n\nReturn this exact JSON:\n{\n  "topComplaints": [\n    {"complaint": string, "severity": "HIGH/MEDIUM/LOW", "frequency": string, "exampleQuote": string}\n  ],\n  "returnReasons": [string, string, string],\n  "unmetExpectations": [string, string, string],\n  "qualityIssues": [string, string]\n}\ntopComplaints should have exactly 5 items.`
  );

  return safeParseJson<ComplaintAnalysis>(raw, {
    topComplaints: [],
    returnReasons: [],
    unmetExpectations: [],
    qualityIssues: [],
  });
}

export async function runCompetitorStrategist(
  mainProductTitle: string,
  mainBulletPoints: string,
  complaintsFromRole2: ComplaintAnalysis,
  competitors: { title: string; bulletPoints: string }[]
): Promise<CompetitorAnalysis> {
  await sleep(500);
  const competitorList = competitors
    .map((c, i) => `${i + 1}. ${c.title}\nBullets: ${c.bulletPoints}`)
    .join("\n\n");

  const raw = await groqCall(
    "You are a competitive intelligence analyst for Amazon e-commerce. Respond in valid JSON only.",
    `Compare the main product against its competitors.\n\nMain product: '${mainProductTitle}'\nMain product bullet points: ${mainBulletPoints}\nMain product top complaints: ${JSON.stringify(complaintsFromRole2.topComplaints)}\n\nCompetitor listings:\n${competitorList}\n\nReturn this exact JSON:\n{\n  "whatCompetitorsEmphasizeBetter": [\n    {"point": string, "howManyCompetitorsMention": number}\n  ],\n  "mainProductWeaknesses": [string, string, string],\n  "mainProductStrengths": [string, string, string],\n  "missedPositioningOpportunities": [string, string, string]\n}\nwhatCompetitorsEmphasizeBetter should have 4-5 items.`
  );

  return safeParseJson<CompetitorAnalysis>(raw, {
    whatCompetitorsEmphasizeBetter: [],
    mainProductWeaknesses: [],
    mainProductStrengths: [],
    missedPositioningOpportunities: [],
  });
}

export async function runProductManager(
  productTitle: string,
  complaints: ComplaintAnalysis,
  competitorData: CompetitorAnalysis
): Promise<ProductManagerAnalysis> {
  await sleep(500);

  const raw = await groqCall(
    "You are a senior product manager for an e-commerce brand. Your job is to prioritize improvements based on customer evidence. Respond in valid JSON only.",
    `Based on this analysis for '${productTitle}':\n\nCustomer top complaints: ${JSON.stringify(complaints.topComplaints)}\nCompetitor advantages: ${JSON.stringify(competitorData.whatCompetitorsEmphasizeBetter)}\nUnmet expectations: ${JSON.stringify(complaints.unmetExpectations)}\n\nReturn this exact JSON:\n{\n  "fixRightNow": [\n    {"action": string, "impact": "HIGH/MEDIUM", "effort": "EASY/MEDIUM/HARD", "reasoning": string}\n  ],\n  "featureGaps": [string, string, string],\n  "quickWins": [string, string, string]\n}\nfixRightNow should have exactly 5 items, ranked by impact. This is the most important output — be very specific and actionable.`
  );

  return safeParseJson<ProductManagerAnalysis>(raw, {
    fixRightNow: [],
    featureGaps: [],
    quickWins: [],
  });
}

export async function runCopywriter(
  productTitle: string,
  currentTitle: string,
  currentBullets: string,
  drivers: CustomerAnalysis,
  complaints: ComplaintAnalysis,
  competitor: CompetitorAnalysis
): Promise<CopywriterAnalysis> {
  await sleep(500);

  const raw = await groqCall(
    "You are an expert Amazon listing copywriter. You write conversion-optimized copy based on real customer language and psychology. Respond in valid JSON only.",
    `Rewrite the listing for '${productTitle}' based on this research:\n\nCurrent title: ${currentTitle}\nCurrent bullet points: ${currentBullets}\nTop purchase drivers: ${JSON.stringify(drivers.topPurchaseDrivers)}\nKey customer phrases: ${JSON.stringify(drivers.keyPhrasesCustomersUse)}\nTop complaints to address: ${JSON.stringify(complaints.topComplaints)}\nMissed positioning: ${JSON.stringify(competitor.missedPositioningOpportunities)}\n\nReturn this exact JSON:\n{\n  "improvedTitle": string,\n  "improvedBullets": [string, string, string, string, string],\n  "marketingAngles": [\n    {"angle": string, "targetAudience": string, "hook": string}\n  ],\n  "suggestedAdHeadlines": [string, string, string],\n  "toneAndVoiceNotes": string\n}\nimprovedTitle must be under 200 characters. Each bullet must start with a benefit, not a feature. marketingAngles should have 3 items.`
  );

  return safeParseJson<CopywriterAnalysis>(raw, {
    improvedTitle: "",
    improvedBullets: [],
    marketingAngles: [],
    suggestedAdHeadlines: [],
    toneAndVoiceNotes: "",
  });
}
