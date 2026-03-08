import Anthropic from "@anthropic-ai/sdk";
import { load } from "cheerio";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompetitorPage {
  url: string;
  title: string;
  wordCount: number;
  content: string;
}

export interface CompetitorAnalysis {
  keyword: string;
  pages: CompetitorPage[];
  commonTopics: string[];
  contentGaps: string[];
  averageWordCount: number;
  mostCommonFormat: string;
  commonH2s: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const EXCLUDED_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "reddit.com",
  "google.com",
  "google.co",
  "accounts.google",
  "support.google",
  "maps.google",
  "translate.google",
  "webcache.googleusercontent",
  "facebook.com",
  "twitter.com",
  "instagram.com",
  "linkedin.com",
  "pinterest.com",
  "tiktok.com",
];

// ─── Google Search ────────────────────────────────────────────────────────────

export async function searchGoogle(keyword: string): Promise<string[]> {
  const query = encodeURIComponent(keyword);
  const url = `https://www.google.com/search?q=${query}&num=10&hl=en&gl=us`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Cache-Control": "no-cache",
    },
  });

  if (!res.ok) throw new Error(`Google returned ${res.status}`);

  const html = await res.text();
  const $ = load(html);
  const urls: string[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    let finalUrl: string | null = null;

    if (href.startsWith("/url?")) {
      const match = href.match(/[?&]q=([^&]+)/);
      if (match) {
        try {
          finalUrl = decodeURIComponent(match[1]);
        } catch {
          // skip malformed
        }
      }
    } else if (href.startsWith("http://") || href.startsWith("https://")) {
      finalUrl = href;
    }

    if (!finalUrl) return;

    try {
      const hostname = new URL(finalUrl).hostname.replace(/^www\./, "");
      const excluded = EXCLUDED_DOMAINS.some(
        (d) => hostname === d || hostname.endsWith(`.${d}`)
      );
      if (!excluded && !urls.includes(finalUrl)) {
        urls.push(finalUrl);
      }
    } catch {
      // skip malformed URLs
    }
  });

  return urls.slice(0, 5);
}

// ─── Page Scraper ─────────────────────────────────────────────────────────────

export async function scrapePage(url: string): Promise<CompetitorPage | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;

    const html = await res.text();
    const $ = load(html);

    const title = $("title").first().text().trim() || new URL(url).hostname;

    // Strip noise
    $(
      "nav, footer, header, aside, script, style, noscript, " +
        ".nav, .navbar, .navigation, .menu, .sidebar, .side-bar, " +
        ".footer, .header, .ad, .ads, .advertisement, .cookie-banner, " +
        ".popup, .modal, .banner, .social-share, .share-buttons, " +
        ".comments, .comment-section, .related-posts, .author-bio, " +
        "[class*='sidebar'], [class*='widget'], [id*='sidebar'], [id*='widget'], " +
        "[class*='footer'], [id*='footer'], [class*='header'], [id*='header'], " +
        "[class*='nav-'], [id*='nav-'], [class*='-menu'], [id*='-menu']"
    ).remove();

    // Prefer semantic content containers
    const candidates = [
      $("article").first(),
      $("main").first(),
      $('[role="main"]').first(),
      $('[class*="content"]').first(),
      $('[class*="post-body"]').first(),
      $('[class*="article-body"]').first(),
      $('[class*="entry"]').first(),
    ];

    let text = "";
    for (const el of candidates) {
      const t = el.text().trim();
      if (t.length > 300) {
        text = t;
        break;
      }
    }
    if (!text) text = $("body").text();

    const cleanText = text.replace(/\s+/g, " ").trim();
    const words = cleanText.split(/\s+/).filter((w) => w.length > 0);

    if (words.length < 100) return null;

    return {
      url,
      title,
      wordCount: words.length,
      // Cap at 3000 words to keep Claude prompts manageable
      content: words.slice(0, 3000).join(" "),
    };
  } catch {
    return null;
  }
}

// ─── Claude Analysis ──────────────────────────────────────────────────────────

async function analyzeWithClaude(
  client: Anthropic,
  keyword: string,
  pages: CompetitorPage[]
): Promise<
  Pick<
    CompetitorAnalysis,
    "commonTopics" | "contentGaps" | "mostCommonFormat" | "commonH2s"
  >
> {
  const empty = {
    commonTopics: [] as string[],
    contentGaps: [] as string[],
    mostCommonFormat: "mixed",
    commonH2s: [] as string[],
  };

  if (pages.length === 0) return empty;

  const pagesContext = pages
    .map(
      (p, i) =>
        `--- Page ${i + 1}: ${p.title} (${p.wordCount} words)\nURL: ${p.url}\nContent:\n${p.content.substring(0, 1500)}`
    )
    .join("\n\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Analyze these ${pages.length} competitor pages currently ranking on Google for "${keyword}".

${pagesContext}

Identify:
1. What topics/sections do most of these pages cover? (commonTopics — list 4-6 items)
2. What content gaps exist — topics NOT covered that would add value? (contentGaps — list 3-4 items)
3. Most common content format: listicle, guide, how-to, comparison, FAQ, or mixed? (one word)
4. Most common H2-level section headings/topics used across pages? (commonH2s — list 4-6 items)

Return ONLY a JSON object, no markdown:
{
  "commonTopics": ["topic 1", "topic 2"],
  "contentGaps": ["gap 1", "gap 2"],
  "mostCommonFormat": "guide",
  "commonH2s": ["section 1", "section 2"]
}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") return empty;

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return empty;

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return empty;
  }
}

// ─── Main: Run Competitor Analysis ────────────────────────────────────────────

export async function runCompetitorAnalysis(
  client: Anthropic,
  keywords: string[]
): Promise<CompetitorAnalysis[]> {
  console.log(
    `\n  Searching Google and scraping top pages for ${keywords.length} keywords (2s delay between searches)...`
  );

  const analyses: CompetitorAnalysis[] = [];

  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    process.stdout.write(`  [${i + 1}/${keywords.length}] "${keyword}"`);

    let urls: string[] = [];
    try {
      urls = await searchGoogle(keyword);
      process.stdout.write(` — ${urls.length} URLs found`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(` — search failed (${msg}), skipping\n`);
      analyses.push({
        keyword,
        pages: [],
        commonTopics: [],
        contentGaps: [],
        averageWordCount: 0,
        mostCommonFormat: "unknown",
        commonH2s: [],
      });
      if (i < keywords.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
      continue;
    }

    // Scrape pages (skip failures silently)
    const pages: CompetitorPage[] = [];
    for (const url of urls) {
      const page = await scrapePage(url);
      if (page) {
        pages.push(page);
        process.stdout.write(".");
      }
    }

    // Analyze with Claude
    let claudeResult = {
      commonTopics: [] as string[],
      contentGaps: [] as string[],
      mostCommonFormat: "mixed",
      commonH2s: [] as string[],
    };
    if (pages.length > 0) {
      try {
        claudeResult = await analyzeWithClaude(client, keyword, pages);
      } catch {
        // non-fatal — proceed with empty analysis
      }
    }

    const averageWordCount =
      pages.length > 0
        ? Math.round(
            pages.reduce((sum, p) => sum + p.wordCount, 0) / pages.length
          )
        : 0;

    analyses.push({
      keyword,
      pages,
      commonTopics: claudeResult.commonTopics,
      contentGaps: claudeResult.contentGaps,
      averageWordCount,
      mostCommonFormat: claudeResult.mostCommonFormat,
      commonH2s: claudeResult.commonH2s,
    });

    process.stdout.write(
      ` — scraped ${pages.length} pages, avg ${averageWordCount.toLocaleString()} words\n`
    );

    if (i < keywords.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return analyses;
}

// ─── Display Helpers ──────────────────────────────────────────────────────────

export function printCompetitorCard(analysis: CompetitorAnalysis): void {
  console.log(`\n  ┌─ "${analysis.keyword}"`);

  if (analysis.pages.length === 0) {
    console.log("  │  No competitor pages found.");
    console.log("  └─");
    return;
  }

  console.log("  │  Top ranking pages:");
  analysis.pages.forEach((p, i) => {
    console.log(`  │    ${i + 1}. ${p.title}`);
    console.log(`  │       ${p.url}`);
    console.log(`  │       Content length: ${p.wordCount.toLocaleString()} words`);
  });

  console.log(
    `  │\n  │  Avg competitor word count: ${analysis.averageWordCount.toLocaleString()} words`
  );
  console.log(`  │  Most common format: ${analysis.mostCommonFormat}`);

  if (analysis.commonTopics.length > 0) {
    console.log("  │\n  │  Common topics covered:");
    analysis.commonTopics.forEach((t) => console.log(`  │    • ${t}`));
  }

  if (analysis.contentGaps.length > 0) {
    console.log("  │\n  │  Content gaps (your opportunities):");
    analysis.contentGaps.forEach((g) => console.log(`  │    ▶ ${g}`));
  }

  console.log("  └─");
}

export function printCompetitorInsightsSummary(
  analyses: CompetitorAnalysis[]
): void {
  const withPages = analyses.filter((a) => a.pages.length > 0);
  if (withPages.length === 0) return;

  console.log("\n" + "═".repeat(70));
  console.log("COMPETITOR INSIGHTS SUMMARY");
  console.log("═".repeat(70));

  // Average word count
  const totalAvg = Math.round(
    withPages.reduce((sum, a) => sum + a.averageWordCount, 0) / withPages.length
  );
  console.log(
    `Avg competitor word count:  ${totalAvg.toLocaleString()} words`
  );
  console.log(
    `Target (20% more):          ${Math.round(totalAvg * 1.2).toLocaleString()} words`
  );

  // Most common format
  const formatCounts: Record<string, number> = {};
  withPages.forEach((a) => {
    formatCounts[a.mostCommonFormat] =
      (formatCounts[a.mostCommonFormat] || 0) + 1;
  });
  const topFormat = Object.entries(formatCounts).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0];
  if (topFormat) console.log(`Most common content format: ${topFormat}`);

  // Most common H2s across all keywords
  const h2Counts: Record<string, number> = {};
  withPages.forEach((a) =>
    a.commonH2s.forEach((h) => {
      h2Counts[h] = (h2Counts[h] || 0) + 1;
    })
  );
  const topH2s = Object.entries(h2Counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([h]) => h);
  if (topH2s.length > 0) {
    console.log("\nMost common H2 topics across all competitors:");
    topH2s.forEach((h) => console.log(`  • ${h}`));
  }

  console.log("═".repeat(70));
}
