const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type NaverNewsItem = {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
};

type NewsArticle = {
  title: string;
  summary: string;
  link: string;
  originallink: string;
  pubDate: string;
  thumbnail: string;
  publisher: string;
};

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function formatPubDate(pubDate: string): string {
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) return pubDate;
  return parsed.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getPublisherName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    return parts.length >= 2 ? parts[parts.length - 2] : host;
  } catch {
    return "뉴스";
  }
}

function getFaviconUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=256`;
  } catch {
    return "";
  }
}

function extractOgImage(html: string): string {
  const patterns = [
    /<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["'][^>]*>/i,
    /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

async function fetchArticleThumbnail(pageUrl: string): Promise<string> {
  const favicon = getFaviconUrl(pageUrl);
  if (!pageUrl) return favicon;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const response = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SeniorSafePortal/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) return favicon;

    const html = await response.text();
    const ogImage = extractOgImage(html);
    return ogImage || favicon;
  } catch {
    return favicon;
  }
}

async function fetchNaverNews(
  query: string,
  clientId: string,
  clientSecret: string,
  display = 5,
): Promise<NewsArticle[]> {
  const params = new URLSearchParams({
    query,
    display: String(display),
    start: "1",
    sort: "date",
  });

  const response = await fetch(`https://openapi.naver.com/v1/search/news.json?${params.toString()}`, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`네이버 뉴스 API 오류 (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { items?: NaverNewsItem[] };
  const items = data.items ?? [];

  const articles = await Promise.all(
    items.map(async (item) => {
      const originallink = item.originallink || item.link;
      const thumbnail = await fetchArticleThumbnail(originallink);

      return {
        title: stripHtml(item.title),
        summary: stripHtml(item.description),
        link: item.link,
        originallink,
        pubDate: formatPubDate(item.pubDate),
        thumbnail,
        publisher: getPublisherName(originallink),
      };
    }),
  );

  return articles;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("NAVER_CLIENT_ID");
    const clientSecret = Deno.env.get("NAVER_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      throw new Error("서버에 NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.");
    }

    const body = await req.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";

    if (!query) {
      throw new Error("검색어(query)가 필요합니다.");
    }

    const articles = await fetchNaverNews(query, clientId, clientSecret);

    return new Response(
      JSON.stringify({ articles, query }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "뉴스 검색 실패",
        message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
