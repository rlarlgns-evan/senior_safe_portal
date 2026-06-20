import { XMLParser } from "npm:fast-xml-parser@4.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BASE_URL = "http://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations";

type RegionCodes = {
  ctprvnCd: string;
  signguCd: string;
  ctprvnNm: string;
  signguNm: string;
};

type WelfareServiceSummary = {
  servId: string;
  servNm: string;
  department: string;
  region: string;
  city: string;
  summary: string;
  link: string;
};

type WelfareServiceDetail = WelfareServiceSummary & {
  target: string;
  criteria: string;
  benefit: string;
  applicationMethod: string;
  onlineAvailable: string;
  inquiry: string;
  source: "local";
};

type NationalWelfareService = {
  servId: string;
  servNm: string;
  summary: string;
  link: string;
  site: string;
  inquiry: string;
  department: string;
  organization: string;
  updatedAt: string;
  source: "national";
};

const ODCLOUD_BASE = "https://api.odcloud.kr/api";
const ODCLOUD_CENTRAL_PATH = "/15083323/v1/uddi:38fb5dfb-03d2-4472-95fd-9ebb9627aefc_201909111328";
const ODCLOUD_WELFARE_PATH = "/15083323/v1/uddi:3929b807-3420-44d7-a851-cc741fce65a1";

const SENIOR_KEYWORDS = [
  "노인", "어르신", "고령", "기초연금", "경로", "돌봄", "요양", "장기요양",
  "노년", "치매", "재가", "기초생활", "독거", "연금", "건강검진", "보호",
  "실버", "노후", "주거급여", "의료비",
];

const WELFARE_CATEGORY_KEYWORDS: Record<string, string[]> = {
  senior65: ["65세", "노인", "어르신", "고령", "경로", "기초연금", "노년", "실버"],
  middle: ["50대", "60대", "중장년", "장년", "퇴직", "노후"],
  care: ["돌봄", "요양", "장기요양", "재가", "치매", "보호", "독거", "케어", "간병"],
  pension: ["연금", "수당", "급여", "기초생활", "생계", "소득", "지원금"],
  health: ["건강", "의료", "검진", "치료", "재활", "병원", "약"],
  housing: ["주거", "주택", "생활", "임대", "수리", "난방", "에너지"],
};

const CTPRVN_CODES: Record<string, { code: string; name: string }> = {
  "서울": { code: "11", name: "서울특별시" },
  "서울특별시": { code: "11", name: "서울특별시" },
  "부산": { code: "26", name: "부산광역시" },
  "부산광역시": { code: "26", name: "부산광역시" },
  "대구": { code: "27", name: "대구광역시" },
  "대구광역시": { code: "27", name: "대구광역시" },
  "인천": { code: "28", name: "인천광역시" },
  "인천광역시": { code: "28", name: "인천광역시" },
  "광주": { code: "29", name: "광주광역시" },
  "광주광역시": { code: "29", name: "광주광역시" },
  "대전": { code: "30", name: "대전광역시" },
  "대전광역시": { code: "30", name: "대전광역시" },
  "울산": { code: "31", name: "울산광역시" },
  "울산광역시": { code: "31", name: "울산광역시" },
  "세종": { code: "36", name: "세종특별자치시" },
  "세종특별자치시": { code: "36", name: "세종특별자치시" },
  "경기": { code: "41", name: "경기도" },
  "경기도": { code: "41", name: "경기도" },
  "강원": { code: "42", name: "강원특별자치도" },
  "강원도": { code: "42", name: "강원특별자치도" },
  "강원특별자치도": { code: "42", name: "강원특별자치도" },
  "충북": { code: "43", name: "충청북도" },
  "충청북도": { code: "43", name: "충청북도" },
  "충남": { code: "44", name: "충청남도" },
  "충청남도": { code: "44", name: "충청남도" },
  "전북": { code: "45", name: "전북특별자치도" },
  "전라북도": { code: "45", name: "전북특별자치도" },
  "전북특별자치도": { code: "45", name: "전북특별자치도" },
  "전남": { code: "46", name: "전라남도" },
  "전라남도": { code: "46", name: "전라남도" },
  "경북": { code: "47", name: "경상북도" },
  "경상북도": { code: "47", name: "경상북도" },
  "경남": { code: "48", name: "경상남도" },
  "경상남도": { code: "48", name: "경상남도" },
  "제주": { code: "50", name: "제주특별자치도" },
  "제주특별자치도": { code: "50", name: "제주특별자치도" },
};

const SIGNGU_CODES: Record<string, Record<string, string>> = {
  "11": {
    "종로": "11110", "중구": "11140", "용산": "11170", "성동": "11200", "광진": "11215",
    "동대문": "11230", "중랑": "11260", "성북": "11290", "강북": "11305", "도봉": "11320",
    "노원": "11350", "은평": "11380", "서대문": "11410", "마포": "11440", "양천": "11470",
    "강서": "11500", "구로": "11530", "금천": "11545", "영등포": "11560", "동작": "11590",
    "관악": "11620", "서초": "11650", "강남": "11680", "송파": "11710", "강동": "11740",
  },
  "26": {
    "중구": "26110", "서구": "26140", "동구": "26170", "영도": "26200", "부산진": "26230",
    "동래": "26260", "남구": "26290", "북구": "26320", "해운대": "26350", "사하": "26380",
    "금정": "26410", "강서": "26440", "연제": "26470", "수영": "26500", "사상": "26530",
    "기장": "26710",
  },
  "41": {
    "수원": "41110", "성남": "41130", "의정부": "41150", "안양": "41170", "부천": "41190",
    "광명": "41210", "평택": "41220", "동두천": "41250", "안산": "41270", "고양": "41280",
    "과천": "41290", "구리": "41310", "남양주": "41360", "오산": "41370", "시흥": "41390",
    "군포": "41410", "의왕": "41430", "하남": "41450", "용인": "41460", "파주": "41480",
    "이천": "41500", "안성": "41550", "김포": "41570", "화성": "41590", "광주": "41610",
    "양주": "41630", "포천": "41650", "여주": "41670",
  },
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  parseTagValue: false,
});

function normalizeAreaName(value: string): string {
  return value
    .replace(/\s+/g, "")
    .replace(/(특별자치시|특별자치도|광역시|특별시|자치시|자치도|시|도|구|군)$/u, "")
    .toLowerCase();
}

const ENGLISH_REGION_ALIASES: Record<string, string> = {
  seoul: "서울특별시",
  busan: "부산광역시",
  daegu: "대구광역시",
  incheon: "인천광역시",
  gwangju: "광주광역시",
  daejeon: "대전광역시",
  ulsan: "울산광역시",
  sejong: "세종특별자치시",
  gyeonggi: "경기도",
  gangwon: "강원특별자치도",
  chungbuk: "충청북도",
  chungcheongbuk: "충청북도",
  chungnam: "충청남도",
  chungcheongnam: "충청남도",
  jeonbuk: "전북특별자치도",
  jeonnam: "전라남도",
  gyeongbuk: "경상북도",
  gyeongsangbuk: "경상북도",
  gyeongnam: "경상남도",
  gyeongsangnam: "경상남도",
  jeju: "제주특별자치도",
};

/** 영문·로마자 시군구 → 한글 (경기도 등) */
const ENGLISH_CITY_ALIASES: Record<string, string> = {
  suwon: "수원",
  seongnam: "성남",
  yongin: "용인",
  goyang: "고양",
  bucheon: "부천",
  anyang: "안양",
  namyangju: "남양주",
  hwaseong: "화성",
  pyeongtaek: "평택",
  siheung: "시흥",
  uijeongbu: "의정부",
  ansan: "안산",
  gimpo: "김포",
  paju: "파주",
  gwangmyeong: "광명",
  gunpo: "군포",
  osan: "오산",
  hanam: "하남",
  icheon: "이천",
  anseong: "안성",
  yangju: "양주",
  pocheon: "포천",
  yeoju: "여주",
  dongducheon: "동두천",
  gwacheon: "과천",
  uiwang: "의왕",
};

/** 경기도 OO구 → 상위 시 (복지 API는 시 단위 코드) */
const GYEONGGI_GU_TO_CITY: Record<string, string> = {
  분당: "성남",
  수정: "성남",
  중원: "성남",
  기흥: "용인",
  수지: "용인",
  처인: "용인",
  만안: "안양",
  동안: "안양",
  상록: "안산",
  단원: "안산",
  덕양: "고양",
  일산: "고양",
};

const CTPRVN_KEYS_BY_LENGTH = Object.keys(CTPRVN_CODES).sort((a, b) => b.length - a.length);

function normalizeRegionInput(region: string): string {
  let value = region.trim();
  const lower = value.toLowerCase().replace(/[\s_-]+/g, "");
  for (const [english, korean] of Object.entries(ENGLISH_REGION_ALIASES)) {
    if (lower.includes(english.replace(/[\s_-]+/g, ""))) {
      return korean;
    }
  }
  return value;
}

function findProvinceInText(text: string): { code: string; name: string } | null {
  const raw = text.replace(/\s+/g, "");
  const normalized = normalizeRegionInput(text);

  for (const key of CTPRVN_KEYS_BY_LENGTH) {
    const entry = CTPRVN_CODES[key];
    if (raw.includes(key) || normalized.includes(key)) return entry;

    const keyNorm = normalizeAreaName(key);
    const textNorm = normalizeAreaName(normalized);
    if (keyNorm.length >= 2 && (textNorm.includes(keyNorm) || keyNorm.includes(textNorm))) {
      return entry;
    }
  }

  return null;
}

function normalizeCityForLookup(city: string, ctprvnCd: string): string {
  let value = city.trim();
  if (!value) return "";

  const lower = value.toLowerCase().replace(/[^a-z0-9\uAC00-\uD7A3]/g, "");
  for (const [english, korean] of Object.entries(ENGLISH_CITY_ALIASES)) {
    if (lower.includes(english)) return korean;
  }

  if (ctprvnCd === "41") {
    for (const [gu, parentCity] of Object.entries(GYEONGGI_GU_TO_CITY)) {
      if (value.includes(gu)) return parentCity;
    }
  }

  const siMatch = value.match(/([\uAC00-\uD7A3]{2,})(?:특별자치시|특별자치도|광역시|특별시|시|군)/u);
  if (siMatch?.[1]) return siMatch[1];

  return value.replace(/(특별자치시|특별자치도|광역시|특별시|시|군|구)$/u, "");
}

function resolveRegionCodes(region: string, city: string): RegionCodes {
  const regionInput = normalizeRegionInput(region);
  const cityInput = city.trim();
  const combined = `${regionInput} ${cityInput}`.trim();

  let ctprvn = findProvinceInText(regionInput) ?? findProvinceInText(combined);

  if (!ctprvn) {
    ctprvn = CTPRVN_CODES["서울특별시"];
  }

  const cityLookup = normalizeCityForLookup(cityInput, ctprvn.code);
  const signguMap = SIGNGU_CODES[ctprvn.code] ?? {};
  const signguKeys = Object.keys(signguMap).sort((a, b) => b.length - a.length);

  let signguCd = "";
  let signguNm = cityLookup || ctprvn.name;

  for (const key of signguKeys) {
    const keyNorm = normalizeAreaName(key);
    const candidates = [cityInput, cityLookup, combined];
    const matched = candidates.some((candidate) => {
      const candidateNorm = normalizeAreaName(candidate);
      return (
        candidate.includes(key) ||
        candidateNorm.includes(keyNorm) ||
        (keyNorm.length >= 2 && keyNorm.includes(candidateNorm))
      );
    });

    if (matched) {
      signguCd = signguMap[key];
      signguNm = key;
      break;
    }
  }

  return {
    ctprvnCd: ctprvn.code,
    signguCd,
    ctprvnNm: ctprvn.name,
    signguNm,
  };
}

function serviceMatchesRegion(
  service: WelfareServiceSummary | WelfareServiceDetail,
  codes: RegionCodes,
): boolean {
  if (!service.region?.trim()) return false;

  const serviceRegionNorm = normalizeAreaName(service.region);
  const targetRegionNorm = normalizeAreaName(codes.ctprvnNm);
  if (!serviceRegionNorm || !targetRegionNorm) return false;

  const targetShort = targetRegionNorm.slice(0, 2);
  return (
    serviceRegionNorm.includes(targetShort) ||
    targetRegionNorm.includes(serviceRegionNorm.slice(0, 2))
  );
}

function filterLocalServicesByRegion<T extends WelfareServiceSummary>(
  services: T[],
  codes: RegionCodes,
): T[] {
  return services.filter((service) => serviceMatchesRegion(service, codes));
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function pickText(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function extractListRoot(parsed: Record<string, unknown>) {
  return parsed.wantedLcgvList
    ?? parsed.wantedList
    ?? parsed.response
    ?? parsed;
}

function extractDetailRoot(parsed: Record<string, unknown>) {
  return parsed.wantedLcgvDtl
    ?? parsed.wantedDtl
    ?? parsed.response
    ?? parsed;
}

function assertApiSuccess(root: Record<string, unknown>, label: string) {
  const resultCode = String(root.resultCode ?? root.resultCd ?? "0");
  const resultMessage = String(root.resultMessage ?? root.resultMsg ?? "");

  if (resultCode !== "0" && resultCode !== "00") {
    throw new Error(`${label} API 오류: ${resultMessage || resultCode}`);
  }
}

async function callWelfareApi(
  endpoint: "LcgvWelfarelist" | "LcgvWelfaredetailed",
  serviceKey: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const encodedKey = /%[0-9A-F]{2}/i.test(serviceKey)
    ? serviceKey
    : encodeURIComponent(serviceKey);
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.search = `serviceKey=${encodedKey}`;

  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${endpoint} HTTP 오류 (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const rawText = await response.text();
  const parsed = xmlParser.parse(rawText) as Record<string, unknown>;
  return parsed;
}

function mapSummary(item: Record<string, unknown>): WelfareServiceSummary {
  const servId = pickText(item, ["servId", "SERV_ID"]);
  const servNm = pickText(item, ["servNm", "SERV_NM"]);
  const department = pickText(item, ["bizChrDeptNm", "bizChrDeptNmNm"]);
  const region = pickText(item, ["ctpvNm", "ctprvnNm", "CTPV_NM"]);
  const city = pickText(item, ["sgngNm", "signguNm", "SGNG_NM"]);
  const summary = pickText(item, ["servDgst", "servDtlCn", "servDtlCnNm"]);

  return {
    servId,
    servNm,
    department,
    region,
    city,
    summary,
    link: servId ? `https://www.bokjiro.go.kr/welfareInfo/detail.do?servId=${encodeURIComponent(servId)}` : "https://www.bokjiro.go.kr/",
  };
}

function mapOdcloudItem(item: Record<string, unknown>): NationalWelfareService | null {
  const servId = String(item["서비스아이디"] ?? item["서비스 ID"] ?? "").trim();
  const servNm = String(item["서비스명"] ?? "").trim();
  const summary = String(item["서비스요약"] ?? "").trim();
  const link = String(item["서비스URL"] ?? item["서비스(URL)"] ?? "").trim();
  const site = String(item["사이트"] ?? "").trim();
  const inquiry = String(item["대표문의"] ?? "").trim();
  const department = String(item["소관부처명"] ?? "").trim();
  const organization = String(item["소관조직명"] ?? "").trim();
  const updatedAt = String(item["최종수정일"] ?? "").trim();

  if (!servNm) return null;

  return {
    servId: servId || servNm,
    servNm,
    summary,
    link: link || site || "https://www.bokjiro.go.kr/",
    site,
    inquiry,
    department,
    organization,
    updatedAt,
    source: "national",
  };
}

function isSeniorRelated(text: string): boolean {
  const normalized = text.toLowerCase();
  return SENIOR_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function matchesWelfareCategory(
  service: { servNm?: string; summary?: string; target?: string; benefit?: string; criteria?: string; department?: string },
  category: string,
): boolean {
  if (!category || category === "all") return true;

  const keywords = WELFARE_CATEGORY_KEYWORDS[category];
  if (!keywords?.length) return true;

  const haystack = [
    service.servNm,
    service.summary,
    service.target,
    service.benefit,
    service.criteria,
    service.department,
  ].filter(Boolean).join(" ");

  return keywords.some((keyword) => haystack.includes(keyword));
}

async function fetchOdcloudPage(
  serviceKey: string,
  path: string,
  page: number,
  perPage: number,
): Promise<{ items: Record<string, unknown>[]; totalCount: number }> {
  const url = new URL(`${ODCLOUD_BASE}${path}`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("perPage", String(perPage));
  url.searchParams.set("returnType", "JSON");
  url.searchParams.set("serviceKey", serviceKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`복지서비스정보 API HTTP 오류 (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const data = await response.json() as {
    data?: Record<string, unknown>[] | Record<string, unknown>;
    totalCount?: number;
  };

  return {
    items: asArray(data.data),
    totalCount: Number(data.totalCount ?? 0),
  };
}

async function fetchNationalWelfareServices(
  serviceKey: string,
  limit = 4,
): Promise<NationalWelfareService[]> {
  const collected = new Map<string, NationalWelfareService>();
  const paths = [ODCLOUD_CENTRAL_PATH, ODCLOUD_WELFARE_PATH];

  for (const path of paths) {
    for (let page = 1; page <= 5 && collected.size < limit * 3; page += 1) {
      const { items, totalCount } = await fetchOdcloudPage(serviceKey, path, page, 100);
      if (items.length === 0) break;

      for (const item of items) {
        const mapped = mapOdcloudItem(item);
        if (!mapped) continue;

        const haystack = `${mapped.servNm} ${mapped.summary} ${mapped.department}`;
        if (!isSeniorRelated(haystack)) continue;

        if (!collected.has(mapped.servId)) {
          collected.set(mapped.servId, mapped);
        }
      }

      if (page * 100 >= totalCount) break;
    }
  }

  return Array.from(collected.values()).slice(0, limit);
}

function mapDetail(item: Record<string, unknown>, summary: WelfareServiceSummary): WelfareServiceDetail {
  return {
    ...summary,
    target: pickText(item, ["tgtrDtlCn", "sprtTrgtCn", "sprtTrgtDtlCn"]),
    criteria: pickText(item, ["slctCritCn", "slctCrtrCn"]),
    benefit: pickText(item, ["alwSvcCn", "wlfareSvcCn"]),
    applicationMethod: pickText(item, ["applMetCn", "aplyMtdCn"]),
    onlineAvailable: pickText(item, ["onapPsbltYn", "onlineAplyYn"]),
    inquiry: pickText(item, ["inqplCtadrList", "inqplCtadr"]),
    source: "local",
  };
}

async function fetchWelfareList(
  serviceKey: string,
  codes: RegionCodes,
  numOfRows = 8,
): Promise<WelfareServiceSummary[]> {
  const params: Record<string, string> = {
    callTp: "L",
    pageNo: "1",
    numOfRows: String(numOfRows),
    srchKeyCode: "003",
    ctprvnCd: codes.ctprvnCd,
    lifeArray: "006",
    intrsThemaArray: "120",
  };

  if (codes.signguCd) {
    params.signguCd = codes.signguCd;
  }

  const parsed = await callWelfareApi("LcgvWelfarelist", serviceKey, params);
  let root = extractListRoot(parsed) as Record<string, unknown>;
  assertApiSuccess(root, "지자체복지서비스 목록");

  let servList = asArray(root.servList as Record<string, unknown> | Record<string, unknown>[]);

  if (servList.length === 0 && codes.signguCd) {
    const fallbackParams = { ...params };
    delete fallbackParams.signguCd;
    const fallbackParsed = await callWelfareApi("LcgvWelfarelist", serviceKey, fallbackParams);
    root = extractListRoot(fallbackParsed) as Record<string, unknown>;
    assertApiSuccess(root, "지자체복지서비스 목록");
    servList = asArray(root.servList as Record<string, unknown> | Record<string, unknown>[]);
  }

  return servList
    .map((item) => mapSummary(item))
    .filter((item) => item.servId && item.servNm)
    .filter((item) => serviceMatchesRegion(item, codes));
}

async function fetchWelfareDetail(
  serviceKey: string,
  summary: WelfareServiceSummary,
): Promise<WelfareServiceDetail> {
  const parsed = await callWelfareApi("LcgvWelfaredetailed", serviceKey, {
    callTp: "D",
    servId: summary.servId,
  });

  const root = extractDetailRoot(parsed) as Record<string, unknown>;
  assertApiSuccess(root, "지자체복지서비스 상세");

  const detailItem = (root.servDtl ?? root.servList ?? root) as Record<string, unknown>;
  return mapDetail(detailItem, summary);
}

type GeoPayload = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
  localityInfo?: {
    administrative?: Array<{ name?: string; adminLevel?: number }>;
  };
};

async function reverseGeocodeFromCoords(lat: number, lng: number): Promise<{ region: string; city: string }> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    localityLanguage: "ko",
  });

  const response = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("좌표로 위치를 확인하지 못했습니다.");
  }

  const geo = await response.json() as GeoPayload;
  const admin = geo.localityInfo?.administrative;
  let region = geo.principalSubdivision || geo.countryName || "";
  let city = geo.city || geo.locality || region;

  if (Array.isArray(admin)) {
    const findAdmin = (level: number) => admin.find((item) => item.adminLevel === level)?.name;
    const province = findAdmin(4) || findAdmin(3);
    const district = findAdmin(6) || findAdmin(8) || findAdmin(5);
    if (province) region = province;
    if (district) city = district;
  }

  return { region, city };
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

    const serviceKey = Deno.env.get("DATA_GO_KR_SERVICE_KEY");
    if (!serviceKey) {
      throw new Error("서버에 DATA_GO_KR_SERVICE_KEY(공공데이터포털 인증키)가 설정되지 않았습니다.");
    }

    const body = await req.json();
    let region = typeof body?.region === "string" ? body.region.trim() : "";
    let city = typeof body?.city === "string" ? body.city.trim() : region;
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      try {
        const fromCoords = await reverseGeocodeFromCoords(latitude, longitude);
        if (fromCoords.region) region = fromCoords.region;
        if (fromCoords.city) city = fromCoords.city;
      } catch {
        // 문자열 region/city 로 계속 진행
      }
    }

    const servId = typeof body?.servId === "string" ? body.servId.trim() : "";
    const category = typeof body?.category === "string" ? body.category.trim() : "all";
    const limitParam = Number(body?.limit);
    const serviceLimit = Number.isFinite(limitParam)
      ? Math.min(Math.max(Math.floor(limitParam), 1), 12)
      : 4;

    if (servId) {
      const detail = await fetchWelfareDetail(serviceKey, {
        servId,
        servNm: "",
        department: "",
        region,
        city,
        summary: "",
        link: "",
      });

      return new Response(JSON.stringify({ service: detail }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!region) {
      throw new Error("지역명(region)이 필요합니다.");
    }

    const codes = resolveRegionCodes(region, city);
    const listSize = category === "all" ? Math.max(serviceLimit * 3, 8) : Math.max(serviceLimit * 4, 24);
    const summaries = await fetchWelfareList(serviceKey, codes, listSize);

    const detailTargets = summaries.slice(0, category === "all" ? serviceLimit * 2 : serviceLimit * 3);
    const servicesRaw = await Promise.all(
      detailTargets.map(async (summary) => {
        try {
          return await fetchWelfareDetail(serviceKey, summary);
        } catch {
          return {
            ...summary,
            target: "",
            criteria: "",
            benefit: summary.summary,
            applicationMethod: "",
            onlineAvailable: "",
            inquiry: "",
            source: "local",
          } satisfies WelfareServiceDetail;
        }
      }),
    );

    const services = filterLocalServicesByRegion(
      servicesRaw.filter((service) => matchesWelfareCategory(service, category)),
      codes,
    ).slice(0, serviceLimit);

    const nationalRaw = await fetchNationalWelfareServices(serviceKey, category === "all" ? serviceLimit : serviceLimit * 2);
    const nationalServices = nationalRaw
      .filter((service) => matchesWelfareCategory(service, category))
      .slice(0, serviceLimit);

    return new Response(
      JSON.stringify({
        region: codes.ctprvnNm,
        city: codes.signguNm,
        ctprvnCd: codes.ctprvnCd,
        signguCd: codes.signguCd,
        category,
        totalCount: summaries.length,
        services,
        nationalServices,
        links: [
          {
            title: "복지로 — 맞춤형 복지서비스 찾기",
            url: "https://www.bokjiro.go.kr/",
            description: "중앙정부·지자체 복지 혜택을 한곳에서 확인",
          },
        ],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "복지 정보 조회 실패",
        message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
