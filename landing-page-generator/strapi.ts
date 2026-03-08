import Anthropic from "@anthropic-ai/sdk";
import type { CitationAnalysis } from "./keywords.js";
import type { CompetitorAnalysis } from "./competitor.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PageContent {
  h1: string;
  metaDescription: string;
  citationBait: string;
  bodyParagraph: string;
  faqs: Array<{ question: string; answer: string }>;
}

export interface StrapiTemplate {
  id: number;
  [key: string]: unknown;
}

export interface PageResult {
  keyword: string;
  status: "created" | "failed";
  slug?: string;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ─── Strapi Operations ────────────────────────────────────────────────────────

export async function fetchTemplate(
  strapiUrl: string,
  token: string,
  templateSlug: string
): Promise<StrapiTemplate> {
  const url = `${strapiUrl}/api/landing-pages?filters[slug][$eq]=${encodeURIComponent(templateSlug)}&populate=*`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Strapi responded ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { data: StrapiTemplate[] };
  if (!json.data || json.data.length === 0) {
    throw new Error(
      `Template "${templateSlug}" not found in Strapi. Check the slug and try again.`
    );
  }
  return json.data[0];
}

export async function createPage(
  strapiUrl: string,
  token: string,
  template: StrapiTemplate,
  keyword: string,
  content: PageContent
): Promise<string> {
  const slug = slugify(keyword);

  // Start from the template, strip Strapi meta fields, override content fields
  const base = { ...(template as Record<string, unknown>) };
  delete base.id;
  delete base.createdAt;
  delete base.updatedAt;
  delete base.publishedAt;

  // Serialize full page content into the `content` field as structured text
  // and also send individual fields so Strapi schemas with those columns benefit
  const faqBlock = content.faqs
    .map((f, i) => `Q${i + 1}: ${f.question}\nA: ${f.answer}`)
    .join("\n\n");

  const fullContent = [
    content.citationBait,
    "",
    content.bodyParagraph,
    "",
    "## Frequently Asked Questions",
    "",
    faqBlock,
  ].join("\n");

  const payload: Record<string, unknown> = {
    ...base,
    slug,
    title: keyword,
    h1: content.h1,
    metaDescription: content.metaDescription,
    content: fullContent,
    citationBait: content.citationBait,
    bodyParagraph: content.bodyParagraph,
    faqs: content.faqs,
    publishedAt: new Date().toISOString(),
  };

  const res = await fetch(`${strapiUrl}/api/landing-pages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data: payload }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Strapi ${res.status}: ${errText}`);
  }

  return slug;
}

// ─── Page Content Generation ──────────────────────────────────────────────────

export async function generatePageContent(
  client: Anthropic,
  keyword: string,
  seedTopic: string,
  citationAnalysis?: CitationAnalysis,
  competitorAnalysis?: CompetitorAnalysis
): Promise<PageContent> {
  const citationContext = citationAnalysis
    ? `
AI Citation Intelligence (reverse-engineered from what AI models actually cite for this keyword):
- Best content format: ${citationAnalysis.contentFormat}
- Ideal opening sentence style: ${citationAnalysis.openingSentence}
- Key data points to include: ${citationAnalysis.keyDataPoints.join("; ")}
- Citation content gaps (no current source covers these): ${citationAnalysis.contentGaps.join("; ")}
- Ideal page structure: ${citationAnalysis.idealStructure}
- Target word count: ~${citationAnalysis.idealWordCount} words
- Sites currently dominating AI citations: ${citationAnalysis.citedDomains.join(", ")}
`
    : "";

  const competitorContext =
    competitorAnalysis && competitorAnalysis.pages.length > 0
      ? `
Content Currently Ranking on Google for "${keyword}":
${competitorAnalysis.pages
  .map(
    (p, i) =>
      `Page ${i + 1}: "${p.title}" — ${p.wordCount.toLocaleString()} words\nURL: ${p.url}\nContent excerpt:\n${p.content.substring(0, 800)}`
  )
  .join("\n\n")}

Competitor Analysis:
- Average competitor word count: ${competitorAnalysis.averageWordCount.toLocaleString()} words
- Most common content format: ${competitorAnalysis.mostCommonFormat}
- Common topics all competitors cover: ${competitorAnalysis.commonTopics.join("; ")}
- Common H2 sections used: ${competitorAnalysis.commonH2s.join("; ")}
- Content gaps none of them fill: ${competitorAnalysis.contentGaps.join("; ")}
`
      : "";

  const targetWordCount = competitorAnalysis?.averageWordCount
    ? Math.round(competitorAnalysis.averageWordCount * 1.2)
    : citationAnalysis?.idealWordCount ?? 800;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `${competitorContext ? `Here is the content currently ranking on Google for "${keyword}", along with AI citation data from Perplexity. Write an original, comprehensive blog post that: covers everything these pages cover and more, fills the content gaps identified, is structured to get cited by AI models (direct answer opening, FAQ section), includes the keyword naturally, and is better, more detailed, and more useful than anything currently ranking.` : `Generate a complete SEO and AI-citation-optimized landing page for the keyword: "${keyword}"`}

Keyword: "${keyword}"
Topic: ${seedTopic}
${citationContext}${competitorContext}
Requirements:
- The "citationBait" must be a 2-3 sentence direct answer paragraph that AI models (ChatGPT, Perplexity, Google AI Overviews) would quote verbatim. Lead with a direct factual statement. Use the exact keyword in the first sentence.
- The "bodyParagraph" should be ~${targetWordCount} words of comprehensive supporting content. Cover ALL common topics competitors cover, PLUS fill the identified content gaps with additional depth. Use semantic keywords, specific details, and a soft call-to-action. Write in second person (you/your). This must be more detailed and useful than the competitor content above.
- The 5 FAQs must each have direct, quotable answers (3-4 sentences each). These trigger additional AI citations. Cover questions competitors don't answer well.
- Aim for at least ${targetWordCount} total words across all content fields to outperform competitors.

Return ONLY a JSON object, no markdown fences, no explanation:
{
  "h1": "SEO-optimized H1 heading using the exact keyword naturally",
  "metaDescription": "150-160 character meta description with the keyword near the start",
  "citationBait": "2-3 sentence direct answer that AI models would cite as a source. Factual, specific, keyword-in-sentence-1.",
  "bodyParagraph": "Comprehensive ~${targetWordCount} word body covering all competitor topics plus content gaps. Second person. Soft CTA at end.",
  "faqs": [
    { "question": "relevant question 1 about the keyword topic", "answer": "direct 3-4 sentence factual answer" },
    { "question": "relevant question 2", "answer": "direct 3-4 sentence answer" },
    { "question": "relevant question 3", "answer": "direct 3-4 sentence answer" },
    { "question": "relevant question 4", "answer": "direct 3-4 sentence answer" },
    { "question": "relevant question 5", "answer": "direct 3-4 sentence answer" }
  ]
}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Claude");

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON object found in page content response");

  return JSON.parse(jsonMatch[0]) as PageContent;
}
