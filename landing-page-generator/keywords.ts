import Anthropic from "@anthropic-ai/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Keyword {
  keyword: string;
  intent: "commercial" | "transactional" | "informational" | "navigational";
  reasoning: string;
}

export interface PerplexityResult {
  keyword: string;
  answer: string;
  citations: string[];
  error?: string;
}

export interface CitationAnalysis {
  keyword: string;
  contentFormat: "listicle" | "guide" | "FAQ" | "comparison" | "how-to" | "local" | "mixed";
  openingSentence: string;
  keyDataPoints: string[];
  contentGaps: string[];
  idealWordCount: number;
  idealStructure: string;
  citedDomains: string[];
}

export interface KeywordWithCitations extends Keyword {
  citationAnalysis?: CitationAnalysis;
}

export interface ResearchReport {
  seedTopic: string;
  generatedAt: string;
  allKeywords: string[];
  perplexityResults: PerplexityResult[];
  citationAnalyses: CitationAnalysis[];
  selectedKeywords: KeywordWithCitations[];
}

// ─── Step 1: Keyword Research ─────────────────────────────────────────────────

export async function generateKeywords(
  client: Anthropic,
  seedTopic: string
): Promise<string[]> {
  console.log(`\n  Generating keyword variations for: "${seedTopic}"...`);

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Generate 50-100 keyword variations for the seed topic: "${seedTopic}"

Include ALL of the following types:
1. Long-tail keywords (3-6 words)
2. Question-based keywords (how to, what is, when to, where to find, etc.)
3. Location-specific variations (if the topic has a location, vary it; if not, add common city/region modifiers)
4. Commercial intent keywords (best, top, affordable, cheap, near me, reviews, cost)
5. Transactional intent keywords (hire, book, get a quote, emergency, same day)
6. Informational keywords (how much does X cost, when to call X, X tips, X guide)
7. Comparison keywords (X vs Y, alternatives to X)

Return ONLY a JSON array of strings, no explanation, no markdown. Example:
["keyword one", "keyword two", "keyword three"]`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in keyword generation response");

  const keywords: string[] = JSON.parse(jsonMatch[0]);
  console.log(`  Generated ${keywords.length} keyword variations.`);
  return keywords;
}

// ─── Step 2: AI Citation Analysis ─────────────────────────────────────────────

async function callPerplexity(keyword: string, apiKey: string): Promise<PerplexityResult> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: keyword }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Perplexity API error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
    citations?: string[];
  };

  return {
    keyword,
    answer: data.choices[0]?.message?.content ?? "",
    citations: (data.citations ?? []).slice(0, 10),
  };
}

async function analyzeCitationPatterns(
  client: Anthropic,
  results: PerplexityResult[]
): Promise<CitationAnalysis[]> {
  if (results.length === 0) return [];

  // Trim answers to keep the Claude prompt manageable
  const summarized = results.map((r, i) => ({
    index: i + 1,
    keyword: r.keyword,
    answerSnippet: r.answer.substring(0, 500),
    citations: r.citations.slice(0, 6),
  }));

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Here are Perplexity AI search results and citations for ${results.length} keywords. Analyze the citation patterns.

${JSON.stringify(summarized, null, 2)}

For EACH keyword (in the same order), analyze and return:
1. What content format gets cited most (listicle, guide, FAQ, comparison, how-to, local, mixed)?
2. What should the opening sentence be to maximize chances of being cited by AI models?
3. What specific data points or claims appear in the cited answers?
4. What content gaps exist that no cited source covers?
5. What is the ideal word count and page structure?
6. What domains/site types are being cited?

Return ONLY a JSON array with one object per keyword, in the SAME ORDER as the input:
[
  {
    "keyword": "exact keyword string",
    "contentFormat": "FAQ",
    "openingSentence": "The ideal opening sentence that mirrors how cited sources answer this",
    "keyDataPoints": ["specific stat or claim 1", "specific claim 2"],
    "contentGaps": ["topic not covered by any cited source"],
    "idealWordCount": 800,
    "idealStructure": "Direct answer paragraph > numbered list > local context section > FAQ",
    "citedDomains": ["yelp.com", "angi.com"]
  }
]`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Claude");

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in citation analysis response");

  return JSON.parse(jsonMatch[0]) as CitationAnalysis[];
}

export async function runCitationAnalysis(
  client: Anthropic,
  keywords: string[],
  perplexityApiKey: string
): Promise<{ perplexityResults: PerplexityResult[]; citationAnalyses: CitationAnalysis[] }> {
  console.log(`\n  Querying Perplexity Sonar for ${keywords.length} keywords (1s delay between calls)...`);

  const perplexityResults: PerplexityResult[] = [];

  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    process.stdout.write(`  [${i + 1}/${keywords.length}] "${keyword}"...`);

    try {
      const result = await callPerplexity(keyword, perplexityApiKey);
      perplexityResults.push(result);
      process.stdout.write(` ${result.citations.length} citations\n`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      process.stdout.write(` FAILED (${error})\n`);
      perplexityResults.push({ keyword, answer: "", citations: [], error });
    }

    if (i < keywords.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const successful = perplexityResults.filter((r) => !r.error);
  console.log(`\n  Perplexity: ${successful.length}/${keywords.length} keywords analyzed.`);

  console.log("  Analyzing citation patterns with Claude...");
  const citationAnalyses = await analyzeCitationPatterns(client, successful);
  console.log(`  Citation pattern analysis complete for ${citationAnalyses.length} keywords.`);

  return { perplexityResults, citationAnalyses };
}

// ─── Step 3: Intelligent Keyword Selection ────────────────────────────────────

export async function selectKeywords(
  client: Anthropic,
  allKeywords: string[],
  count: number,
  seedTopic: string,
  citationAnalyses: CitationAnalysis[] = []
): Promise<KeywordWithCitations[]> {
  console.log(`\n  Selecting top ${count} keywords with AI${citationAnalyses.length > 0 ? " + citation" : ""} intelligence...`);

  const citationContext =
    citationAnalyses.length > 0
      ? `\nCitation Intelligence (what AI models actually cite for these keywords):\n${JSON.stringify(
          citationAnalyses.slice(0, 50),
          null,
          2
        )}\n`
      : "";

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are an expert SEO and AI Search Optimization strategist. From these ${allKeywords.length} keywords for the topic "${seedTopic}", select the top ${count} that have the best chance of:
1. Getting the landing page cited by AI models (ChatGPT, Perplexity, Google AI Overviews)
2. Ranking in traditional Google search
3. Having commercial intent (likely to convert visitors)
4. Being low competition long-tail keywords
${citationContext}
All keywords:
${allKeywords.map((k, i) => `${i + 1}. ${k}`).join("\n")}

For each selected keyword, explain WHY in one line. Ensure variety of intent — don't pick 5 near-identical variations.

Return ONLY a JSON array of exactly ${count} objects, no markdown:
[
  {
    "keyword": "exact keyword string",
    "intent": "commercial" | "transactional" | "informational" | "navigational",
    "reasoning": "one sentence explaining why this keyword was selected"
  }
]`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response from Claude");

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in keyword selection response");

  const selected = JSON.parse(jsonMatch[0]) as Keyword[];

  // Attach citation analysis to each selected keyword
  const citationMap = new Map(citationAnalyses.map((c) => [c.keyword, c]));
  return selected.slice(0, count).map((kw) => ({
    ...kw,
    citationAnalysis: citationMap.get(kw.keyword),
  }));
}
