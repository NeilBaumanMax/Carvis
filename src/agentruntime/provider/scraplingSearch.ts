import { spawn } from "node:child_process";
import { join } from "node:path";

export interface ScraplingSearchOptions {
  commandText: string;
  timeoutMs?: number;
  maxResults?: number;
  env?: NodeJS.ProcessEnv;
}

export interface ScraplingSearchResult {
  ok: boolean;
  evidenceText: string;
}

export async function runScraplingSearch(options: ScraplingSearchOptions): Promise<ScraplingSearchResult> {
  const env = options.env ?? process.env;

  if (env.CARVIS_SCRAPLING_SEARCH === "0") {
    return {
      ok: false,
      evidenceText: "SCRAPLING_SEARCH_DISABLED: CARVIS_SCRAPLING_SEARCH=0",
    };
  }

  const python = env.CARVIS_SCRAPLING_PYTHON ?? join(process.cwd(), ".venv-scrapling", "bin", "python");
  const input = JSON.stringify({
    query: createSearchQuery(options.commandText),
    commandText: options.commandText,
    maxResults: options.maxResults ?? Number(env.CARVIS_SCRAPLING_MAX_RESULTS ?? 6),
  });

  return new Promise((resolve) => {
    const child = spawn(python, ["-c", PYTHON_SEARCH_SCRIPT], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
        LD_LIBRARY_PATH: env.CARVIS_SCRAPLING_LD_LIBRARY_PATH ?? env.LD_LIBRARY_PATH,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        ok: false,
        evidenceText: "SCRAPLING_SEARCH_ERROR: timeout",
      });
    }, options.timeoutMs ?? Number(env.CARVIS_SCRAPLING_TIMEOUT_MS ?? 45_000));
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      resolve({
        ok: false,
        evidenceText: `SCRAPLING_SEARCH_ERROR: ${error.message}`,
      });
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      const output = Buffer.concat(stdout).toString("utf8").trim();
      const errorOutput = Buffer.concat(stderr).toString("utf8").trim();

      if (code !== 0 || output.length === 0) {
        resolve({
          ok: false,
          evidenceText: `SCRAPLING_SEARCH_ERROR: exit=${String(code)} ${errorOutput.slice(0, 800)}`,
        });
        return;
      }

      resolve({
        ok: output.startsWith("SCRAPLING_WEB_EVIDENCE"),
        evidenceText: output.slice(0, 12_000),
      });
    });
    child.stdin.end(input);
  });
}

function createSearchQuery(commandText: string): string {
  const compact = commandText.replace(/\s+/g, " ").trim();

  if (/B站|b站|Bilibili|bilibili|哔哩哔哩/i.test(compact) && !/site:/.test(compact)) {
    return `${compact} site:bilibili.com`;
  }

  return compact;
}

const PYTHON_SEARCH_SCRIPT = String.raw`
import json
import re
import sys
from html import unescape
from urllib.parse import quote_plus, urlparse, parse_qs, unquote

try:
    from scrapling import Fetcher, Selector
except Exception as exc:
    print(f"SCRAPLING_IMPORT_ERROR: {exc}")
    sys.exit(0)

payload = json.loads(sys.stdin.read() or "{}")
query = payload.get("query", "")
max_results = int(payload.get("maxResults", 6))

def clean(text):
    return re.sub(r"\s+", " ", unescape(text or "")).strip()

def normalize_href(href):
    if not href:
        return ""
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/l/?"):
        qs = parse_qs(urlparse(href).query)
        return qs.get("uddg", [href])[0]
    if href.startswith("http"):
        return href
    return href

def fetch(url):
    page = Fetcher.get(
        url,
        timeout=20,
        stealthy_headers=True,
        follow_redirects=True,
    )
    return page

def parse_duckduckgo(page):
    results = []
    selectors = [
        ".result",
        "article",
        ".web-result",
    ]
    for selector in selectors:
        for node in page.css(selector):
            title = clean(node.css("a::text").get() or node.css("h2::text").get())
            href = normalize_href(node.css("a::attr(href)").get())
            snippet = clean(" ".join(node.css(".result__snippet *::text").getall()) or " ".join(node.css("::text").getall()))
            if title and href and "duckduckgo.com" not in href:
                results.append({"title": title[:180], "url": href, "snippet": snippet[:500]})
            if len(results) >= max_results:
                return results
    return results

def parse_fallback_links(page):
    results = []
    seen = set()
    for link in page.css("a"):
        title = clean(" ".join(link.css("::text").getall()))
        href = normalize_href(link.attrib.get("href", ""))
        if not title or not href.startswith("http"):
            continue
        if href in seen or any(blocked in href for blocked in ["duckduckgo.com", "bing.com/search", "google.com/search"]):
            continue
        seen.add(href)
        results.append({"title": title[:180], "url": href, "snippet": ""})
        if len(results) >= max_results:
            break
    return results

def fetch_page_summary(url):
    try:
        page = fetch(url)
        title = clean(page.css("title::text").get())
        description = clean(page.css("meta[name='description']::attr(content)").get() or page.css("meta[property='og:description']::attr(content)").get())
        headings = [clean(item) for item in page.css("h1::text, h2::text").getall()]
        headings = [item for item in headings if item][:5]
        return {
            "title": title[:180],
            "description": description[:500],
            "headings": headings,
        }
    except Exception as exc:
        return {"error": str(exc)[:240]}

try:
    results = []
    if re.search(r"B站|b站|Bilibili|bilibili|哔哩哔哩", payload.get("commandText", "")):
        bilibili_url = "https://search.bilibili.com/all?keyword=" + quote_plus(payload.get("commandText", ""))
        bilibili_page = fetch(bilibili_url)
        search_title = clean(bilibili_page.css("title::text").get())
        search_text = clean(" ".join(bilibili_page.css("a::text").getall()))
        results = [{
            "title": search_title or "Bilibili search page",
            "url": bilibili_url,
            "snippet": search_text[:500] or "Bilibili search page fetched, but no static result text was visible.",
        }]
    if not results:
        search_url = "https://duckduckgo.com/html/?q=" + quote_plus(query)
        page = fetch(search_url)
        results = parse_duckduckgo(page) or parse_fallback_links(page)
    if not results:
        print("SCRAPLING_SEARCH_NO_RESULTS")
        sys.exit(0)
    lines = [
        "SCRAPLING_WEB_EVIDENCE",
        f"query: {query}",
        "rule: only cite URLs listed below; if data is missing, say not found instead of inventing it.",
    ]
    for index, result in enumerate(results[:max_results], start=1):
        summary = fetch_page_summary(result["url"])
        lines.append(f"[{index}] title: {result['title']}")
        lines.append(f"[{index}] url: {result['url']}")
        if result.get("snippet"):
            lines.append(f"[{index}] snippet: {result['snippet']}")
        if "error" in summary:
            lines.append(f"[{index}] fetch_error: {summary['error']}")
        else:
            if summary.get("title"):
                lines.append(f"[{index}] page_title: {summary['title']}")
            if summary.get("description"):
                lines.append(f"[{index}] description: {summary['description']}")
            if summary.get("headings"):
                lines.append(f"[{index}] headings: {' | '.join(summary['headings'])}")
    print("\n".join(lines))
except Exception as exc:
    print(f"SCRAPLING_SEARCH_ERROR: {exc}")
`;
