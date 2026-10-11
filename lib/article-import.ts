import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import ipaddr from "ipaddr.js";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { MAX_ARTICLE_PARAGRAPHS, MAX_PARAGRAPH_LENGTH } from "@/lib/article-paragraphs";

const MAX_HTML_BYTES = 1_500_000;
const MAX_ARTICLE_CHARACTERS = 10_000;
const MAX_REDIRECTS = 3;

export type ImportedArticle = { url: string; title: string; paragraphs: string[] };

export function parsePublicArticleUrl(value: string): URL {
  if (value.length > 2048) throw new Error("Article link is too long");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid article link"); }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password || url.port ||
    url.hostname === "localhost" || /\.(?:localhost|local|internal|test|invalid)$/i.test(url.hostname) ||
    ipaddr.isValid(url.hostname.replace(/^\[|\]$/g, ""))) {
    throw new Error("Enter a public article link");
  }
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  }
  return url;
}

async function fetchPublicHtml(url: URL, redirects = 0): Promise<{ url: URL; html: string }> {
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => ipaddr.parse(address).range() !== "unicast")) {
    throw new Error("Article link is not public");
  }
  const response = await new Promise<{ status: number; location?: string; html?: string }>((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      headers: { Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity", "User-Agent": "Mozilla/5.0 (compatible; UhuraReader/1.0)" },
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      },
      signal: AbortSignal.timeout(12_000),
    }, (incoming) => {
      const status = incoming.statusCode ?? 0;
      if (status >= 300 && status < 400 && incoming.headers.location) {
        incoming.resume();
        resolve({ status, location: incoming.headers.location });
        return;
      }
      if (status !== 200 || !/^(?:text\/html|application\/xhtml\+xml)\b/i.test(String(incoming.headers["content-type"] ?? ""))) {
        incoming.resume();
        reject(new Error("Article page is unavailable"));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      incoming.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_HTML_BYTES) request.destroy(new Error("Article page is too large"));
        else chunks.push(chunk);
      });
      incoming.on("end", () => resolve({ status, html: Buffer.concat(chunks).toString("utf8") }));
      incoming.on("error", reject);
    });
    request.on("error", reject);
    request.end();
  });
  if (response.location) {
    if (redirects >= MAX_REDIRECTS) throw new Error("Article link redirects too many times");
    return fetchPublicHtml(parsePublicArticleUrl(new URL(response.location, url).href), redirects + 1);
  }
  return { url, html: response.html ?? "" };
}

export function extractArticle(html: string, url: string, targetLanguage: string): ImportedArticle {
  const { document } = parseHTML(html);
  const pageLanguage = document.documentElement?.getAttribute("lang")?.split(/[-_]/)[0]?.toLowerCase();
  if (pageLanguage && pageLanguage !== targetLanguage) {
    throw new Error("This article is in a different language from the course");
  }
  const readable = new Readability(document, { charThreshold: 200 }).parse();
  if (!readable?.title || !readable.content) throw new Error("Could not read the article");
  const { document: content } = parseHTML(readable.content);
  const paragraphs = [...content.querySelectorAll("p")]
    .map((element) => element.textContent.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const title = readable.title.replace(/\s+/g, " ").trim();
  if (!title || title.length > 160 || paragraphs.length < 2 || paragraphs.length > MAX_ARTICLE_PARAGRAPHS ||
    paragraphs.some((paragraph) => paragraph.length > MAX_PARAGRAPH_LENGTH) ||
    paragraphs.join("\n").length > MAX_ARTICLE_CHARACTERS) {
    throw new Error("This article is too long or could not be read fully");
  }
  return { url, title, paragraphs };
}

export async function importArticleFromUrl(value: string, targetLanguage: string): Promise<ImportedArticle> {
  const { url, html } = await fetchPublicHtml(parsePublicArticleUrl(value));
  return extractArticle(html, url.href, targetLanguage);
}
