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

  return (data.items ?? []).map((item) => ({
    title: stripHtml(item.title),
    summary: stripHtml(item.description),
    link: item.link,
    originallink: item.originallink,
    pubDate: formatPubDate(item.pubDate),
  }));
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
