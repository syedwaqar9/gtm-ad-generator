#!/usr/bin/env node
import "dotenv/config";
import { program } from "commander";
import inquirer from "inquirer";
import Anthropic from "@anthropic-ai/sdk";
import { parse } from "csv-parse/sync";
import { readFileSync, writeFileSync } from "fs";
import {
  generateKeywords,
  runCitationAnalysis,
  selectKeywords,
} from "./keywords.js";
import type {
  Keyword,
  KeywordWithCitations,
  PerplexityResult,
  CitationAnalysis,
  ResearchReport,
} from "./keywords.js";
import {
  fetchTemplate,
  createPage,
  generatePageContent,
  slugify,
} from "./strapi.js";
import type { StrapiTemplate, PageResult } from "./strapi.js";
import {
  runCompetitorAnalysis,
  printCompetitorCard,
  printCompetitorInsightsSummary,
} from "./competitor.js";
import type { CompetitorAnalysis } from "./competitor.js";

// ─── Table Printer ─────────────────────────────────────────────────────────────

function printTable(keywords: KeywordWithCitations[]): void {
  console.log("\n" + "─".repeat(110));
  console.log(
    "  #  " + "KEYWORD".padEnd(45) + "INTENT".padEnd(18) + "REASONING"
  );
  console.log("─".repeat(110));
  keywords.forEach((k, i) => {
    const num = String(i + 1).padStart(3);
    const kw = k.keyword.substring(0, 43).padEnd(45);
    const intent = k.intent.padEnd(18);
    const reason = k.reasoning.substring(0, 60);
    const cited = k.citationAnalysis ? " [cited]" : "";
    console.log(`  ${num}  ${kw}${intent}${reason}${cited}`);
  });
  console.log("─".repeat(110));
}

// ─── CSV Helpers ───────────────────────────────────────────────────────────────

function loadKeywordsFromCSV(csvPath: string): KeywordWithCitations[] {
  const raw = readFileSync(csvPath, "utf-8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true }) as Array<{
    keyword: string;
    intent?: string;
    reasoning?: string;
  }>;

  return rows.map((r) => ({
    keyword: r.keyword.trim(),
    intent: (r.intent?.trim() as Keyword["intent"]) || "commercial",
    reasoning: r.reasoning?.trim() || "Imported from CSV",
  }));
}

function saveKeywordsCSV(keywords: KeywordWithCitations[], outputPath: string): void {
  const header = "keyword,intent,reasoning";
  const rows = keywords.map(
    (k) => `"${k.keyword}","${k.intent}","${k.reasoning.replace(/"/g, "'")}"`
  );
  writeFileSync(outputPath, [header, ...rows].join("\n"), "utf-8");
  console.log(`\nSelected keywords saved to: ${outputPath}`);
}

// ─── Interactive Keyword Approval ──────────────────────────────────────────────

async function approveKeywords(
  client: Anthropic,
  keywords: KeywordWithCitations[],
  seedTopic: string,
  count: number,
  allKeywords: string[],
  citationAnalyses: CitationAnalysis[]
): Promise<KeywordWithCitations[]> {
  printTable(keywords);

  const { action } = await inquirer.prompt<{ action: string }>([
    {
      type: "list",
      name: "action",
      message: "What would you like to do with these keywords?",
      choices: [
        { name: "Approve all and proceed", value: "approve" },
        { name: "Remove specific keywords", value: "remove" },
        { name: "Regenerate selection", value: "regenerate" },
      ],
    },
  ]);

  if (action === "approve") {
    return keywords;
  }

  if (action === "remove") {
    const { toRemove } = await inquirer.prompt<{ toRemove: string[] }>([
      {
        type: "checkbox",
        name: "toRemove",
        message: "Select keywords to remove:",
        choices: keywords.map((k) => ({
          name: `${k.keyword} [${k.intent}]`,
          value: k.keyword,
        })),
      },
    ]);
    const filtered = keywords.filter((k) => !toRemove.includes(k.keyword));
    if (filtered.length === 0) {
      console.log("All keywords removed. Regenerating...");
      const fresh = await selectKeywords(client, allKeywords, count, seedTopic, citationAnalyses);
      return approveKeywords(client, fresh, seedTopic, count, allKeywords, citationAnalyses);
    }
    return filtered;
  }

  // regenerate
  console.log("\nRegenerating keyword selection...");
  const fresh = await selectKeywords(client, allKeywords, count, seedTopic, citationAnalyses);
  return approveKeywords(client, fresh, seedTopic, count, allKeywords, citationAnalyses);
}

// ─── Main Pipeline ─────────────────────────────────────────────────────────────

async function main() {
  program
    .name("generate")
    .description("SEO + AI citation landing page generator")
    .option("--topic <topic>", "Seed topic for keyword research (auto mode)")
    .option("--count <number>", "Number of keywords to select", "20")
    .option("--csv <path>", "Path to CSV file with keywords (manual mode)")
    .option("--strapi <url>", "Strapi base URL", "http://localhost:1337")
    .option("--template <slug>", "Slug of the template landing page in Strapi")
    .option("--strapi-token <token>", "Strapi API token (overrides STRAPI_API_TOKEN env)")
    .option("--research-only", "Run keyword research + citation analysis only, skip page generation")
    .option("--output <path>", "Path to save the research report JSON (use with --research-only)")
    .option("--output-csv <path>", "Path to save selected keywords CSV", "selected-keywords.csv")
    .parse(process.argv);

  const opts = program.opts<{
    topic?: string;
    count: string;
    csv?: string;
    strapi: string;
    template?: string;
    strapiToken?: string;
    researchOnly?: boolean;
    output?: string;
    outputCsv: string;
  }>();

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!opts.topic && !opts.csv) {
    console.error("Error: Provide either --topic (auto mode) or --csv (manual mode).");
    process.exit(1);
  }
  if (opts.researchOnly && !opts.topic) {
    console.error("Error: --research-only requires --topic.");
    process.exit(1);
  }
  if (opts.researchOnly && !opts.output) {
    console.error("Error: --research-only requires --output <path> to save the JSON report.");
    process.exit(1);
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.error("Error: ANTHROPIC_API_KEY is not set. Add it to your .env file.");
    process.exit(1);
  }

  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (opts.topic && !perplexityKey) {
    console.warn(
      "Warning: PERPLEXITY_API_KEY not set. Skipping AI citation analysis (Step 2).\n" +
        "         Set PERPLEXITY_API_KEY in .env for full citation-optimized generation."
    );
  }

  const strapiToken = opts.strapiToken || process.env.STRAPI_API_TOKEN;
  if (!opts.researchOnly) {
    if (!strapiToken) {
      console.error(
        "Error: STRAPI_API_TOKEN is required for page generation.\n" +
          "       Use --research-only to run keyword research without publishing pages."
      );
      process.exit(1);
    }
    if (!opts.template) {
      console.error(
        "Error: --template <slug> is required for page generation.\n" +
          "       Use --research-only to skip page generation."
      );
      process.exit(1);
    }
  }

  const count = parseInt(opts.count, 10);
  const client = new Anthropic({ apiKey: anthropicKey });

  console.log("\n=== SEO + AI Citation Landing Page Generator ===");

  // ── Pipeline state ──────────────────────────────────────────────────────────
  let selectedKeywords: KeywordWithCitations[] = [];
  let allKeywords: string[] = [];
  let perplexityResults: PerplexityResult[] = [];
  let citationAnalyses: CitationAnalysis[] = [];
  let competitorAnalyses: CompetitorAnalysis[] = [];
  const seedTopic = opts.topic || opts.csv!;

  // ── CSV Mode ────────────────────────────────────────────────────────────────
  if (opts.csv) {
    console.log(`\n[Mode] Manual keywords from CSV: ${opts.csv}`);
    const csvKeywords = loadKeywordsFromCSV(opts.csv);
    console.log(`  Loaded ${csvKeywords.length} keywords.`);
    printTable(csvKeywords);

    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      {
        type: "confirm",
        name: "confirmed",
        message: `Proceed with these ${csvKeywords.length} keywords?`,
        default: true,
      },
    ]);
    if (!confirmed) {
      console.log("Aborted.");
      process.exit(0);
    }

    selectedKeywords = csvKeywords;
  } else {
    // ── Auto Mode: Full 4-step pipeline ───────────────────────────────────────

    // Step 1: Keyword Research
    console.log("\n[Step 1] Keyword Research");
    allKeywords = await generateKeywords(client, opts.topic!);

    // Step 2: AI Citation Analysis
    console.log("\n[Step 2] AI Citation Analysis");
    if (perplexityKey) {
      const result = await runCitationAnalysis(client, allKeywords, perplexityKey);
      perplexityResults = result.perplexityResults;
      citationAnalyses = result.citationAnalyses;
    } else {
      console.log("  Skipped (PERPLEXITY_API_KEY not set).");
    }

    // Step 3: Competitor Analysis
    console.log("\n[Step 3] Competitor Analysis");
    competitorAnalyses = await runCompetitorAnalysis(client, allKeywords);
    console.log("\n  Competitor cards:");
    competitorAnalyses.forEach((a) => printCompetitorCard(a));
    printCompetitorInsightsSummary(competitorAnalyses);

    // Step 4: Intelligent Keyword Selection
    console.log("\n[Step 4] Intelligent Keyword Selection");
    const aiSelected = await selectKeywords(
      client,
      allKeywords,
      count,
      opts.topic!,
      citationAnalyses
    );
    selectedKeywords = await approveKeywords(
      client,
      aiSelected,
      opts.topic!,
      count,
      allKeywords,
      citationAnalyses
    );
  }

  saveKeywordsCSV(selectedKeywords, opts.outputCsv);

  // ── Research-Only Mode: Save report and exit ─────────────────────────────────
  if (opts.researchOnly) {
    const report: ResearchReport & { competitorAnalyses: CompetitorAnalysis[] } = {
      seedTopic: opts.topic!,
      generatedAt: new Date().toISOString(),
      allKeywords,
      perplexityResults,
      citationAnalyses,
      competitorAnalyses,
      selectedKeywords,
    };

    writeFileSync(opts.output!, JSON.stringify(report, null, 2), "utf-8");

    const competitorWithPages = competitorAnalyses.filter((a) => a.pages.length > 0);
    printCompetitorInsightsSummary(competitorAnalyses);

    console.log("\n" + "=".repeat(60));
    console.log("RESEARCH SUMMARY");
    console.log("=".repeat(60));
    console.log(`Seed topic:          ${opts.topic}`);
    console.log(`Keywords generated:  ${allKeywords.length}`);
    console.log(`Citations analyzed:  ${perplexityResults.filter((r) => !r.error).length}`);
    console.log(`Competitors scraped: ${competitorWithPages.length} keywords with data`);
    console.log(`Keywords selected:   ${selectedKeywords.length}`);
    console.log(`Report saved to:     ${opts.output}`);
    console.log(`Keywords CSV:        ${opts.outputCsv}`);
    console.log("=".repeat(60));
    return;
  }

  // ── Step 5: Landing Page Generation ─────────────────────────────────────────
  console.log(`\n[Step 5] Landing Page Generation`);
  console.log(`\nFetching template "${opts.template}" from Strapi...`);
  const template: StrapiTemplate = await fetchTemplate(
    opts.strapi,
    strapiToken!,
    opts.template!
  );
  console.log(`  Template found (ID: ${template.id})`);

  console.log(`\nGenerating and publishing ${selectedKeywords.length} pages...\n`);

  // Build competitor analysis lookup by keyword
  const competitorMap = new Map(competitorAnalyses.map((a) => [a.keyword, a]));

  const results: PageResult[] = [];
  let created = 0;
  let failed = 0;

  for (let i = 0; i < selectedKeywords.length; i++) {
    const kw = selectedKeywords[i];
    const progress = `[${i + 1}/${selectedKeywords.length}]`;
    process.stdout.write(`${progress} "${kw.keyword}" — generating content...`);

    const competitorData = competitorMap.get(kw.keyword);

    try {
      const pageContent = await generatePageContent(
        client,
        kw.keyword,
        seedTopic,
        kw.citationAnalysis,
        competitorData
      );
      process.stdout.write(" publishing to Strapi...");
      const slug = await createPage(opts.strapi, strapiToken!, template, kw.keyword, pageContent);
      process.stdout.write(` done (/${slug})\n`);
      results.push({ keyword: kw.keyword, status: "created", slug });
      created++;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      process.stdout.write(` FAILED\n`);
      console.error(`  Error: ${error}`);
      results.push({ keyword: kw.keyword, status: "failed", error });
      failed++;
    }
  }

  // ── Pipeline Summary ─────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("PIPELINE SUMMARY");
  console.log("=".repeat(60));

  if (opts.topic) {
    console.log(`Seed topic:          ${opts.topic}`);
    console.log(`Keywords researched: ${allKeywords.length}`);
    console.log(`Citations analyzed:  ${perplexityResults.filter((r) => !r.error).length}`);
    const competitorWithPages = competitorAnalyses.filter((a) => a.pages.length > 0);
    if (competitorWithPages.length > 0) {
      console.log(`Competitors scraped: ${competitorWithPages.length} keywords with data`);
    }
  } else {
    console.log(`CSV source:          ${opts.csv}`);
  }

  console.log(`Keywords selected:   ${selectedKeywords.length}`);
  console.log(`Pages created:       ${created}`);

  if (failed > 0) {
    console.log(`Pages failed:        ${failed}`);
    console.log("\nFailed keywords:");
    results
      .filter((r) => r.status === "failed")
      .forEach((r) => console.log(`  - ${r.keyword}: ${r.error}`));
  }

  console.log(`Keywords CSV:        ${opts.outputCsv}`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("\nFatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
