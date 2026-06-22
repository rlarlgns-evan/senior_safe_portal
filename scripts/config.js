/** @file App-wide constants */
export const SUPABASE_URL = "https://oweduuhfkiutlszfwukt.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93ZWR1dWhma2l1dGxzemZ3dWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjMyNzUsImV4cCI6MjA5NzUzOTI3NX0.n25pwv-WuWOBIGY7cwJCYj1TxILYpy2XA2nn7a6ySMY";
export const SEARCH_RESULTS_KEY = "sheriff-search-results";
export const SITE_ASSET_VERSION = "20260908";
export const MASCOT_SRC = "assets/mascot-sheriff.png";
export const MASCOT_POTATO_SRC = "assets/mascot-potato.png";

export const SITE_NAV_ITEMS = [
  { id: "home", page: "index", label: "홈" },
  { id: "youtube", page: "youtube", label: "유튜브" },
  { id: "news", page: "news", label: "뉴스" },
  { id: "welfare", page: "welfare", label: "복지" },
  { id: "board", page: "board", label: "자유게시판" },
  { id: "info", page: "information", label: "정보" },
];

export const YOUTUBE_CATEGORIES = [
  {
    id: "music",
    label: "음악",
    query: "트로트 명곡",
    queries: ["트로트 명곡 모음", "7080 추억의 가요", "국민가요 베스트", "트로트 인기곡"],
  },
  {
    id: "affairs",
    label: "시사",
    query: "시사 뉴스",
    queries: ["KBS 시사뉴스", "뉴스9 하이라이트", "오늘의 시사", "MBC 뉴스"],
  },
  {
    id: "entertainment",
    label: "예능",
    query: "예능",
    queries: ["유퀴즈 온더블럭", "놀면 뭐하니", "1박 2일", "한국 예능 하이라이트"],
  },
  {
    id: "documentary",
    label: "다큐",
    query: "다큐멘터리",
    queries: ["EBS 다큐프라임", "KBS 다큐멘터리", "역사 다큐", "자연 다큐"],
  },
  {
    id: "health",
    label: "건강",
    query: "시니어 건강",
    queries: ["어르신 건강체조", "국민건강체조", "노인 스트레칭", "시니어 운동"],
  },
];
export const YOUTUBE_CATEGORY_FALLBACK = {
  music: [
    { video_id: "7DIh3WaGcEU", title: "전유진 - 사랑만은 않겠어요 [불후의 명곡2]", channel: "KBS 레전드 케이팝", status: "안전" },
    { video_id: "b3NNDg-gYpw", title: "트로트파의 기운을 얻어 가는 전유진 [불후의 명곡2]", channel: "KBS 레전드 케이팝", status: "안전" },
    { video_id: "gMaDhkNja2I", title: "임영웅 - 무지개 [TV조선 트롯]", channel: "TV CHOSUN", status: "안전" },
  ],
  affairs: [
    { video_id: "B2lHwQBZx-A", title: "9시 뉴스", channel: "KBS News", status: "안전" },
    { video_id: "21X5lGlqIxs", title: "KBS 뉴스 9", channel: "KBS News", status: "안전" },
    { video_id: "Ap-EL2N2XgM", title: "MBC 뉴스데스크", channel: "MBCNEWS", status: "안전" },
  ],
  entertainment: [
    { video_id: "Nob6hMO60NE", title: "운동으로 꿈을 가르치는 지한구 선생님 [유퀴즈]", channel: "유 퀴즈 온 더 튜브", status: "안전" },
    { video_id: "lwycbWG8gJI", title: "유퀴즈 온더블럭 하이라이트", channel: "tvN D ENT", status: "안전" },
    { video_id: "kOYS9l8X8Hs", title: "놀면 뭐하니?", channel: "MBC Entertainment", status: "안전" },
    { video_id: "j4dMnAPZuGM", title: "유퀴즈 온 더 블럭 클립", channel: "tvN D ENT", status: "안전" },
    { video_id: "R82-N9mP6TU", title: "유퀴즈 온 더 블럭 베스트", channel: "tvN D ENT", status: "안전" },
  ],
  documentary: [
    { video_id: "cLVugRBot1c", title: "EBS 다큐프라임 - 공부의 배신 1부", channel: "EBS 다큐", status: "안전" },
    { video_id: "8jPQjjsBbIc", title: "EBS 다큐프라임", channel: "EBS Documentary", status: "안전" },
    { video_id: "ZXsQAXuYbo0", title: "KBS 다큐멘터리", channel: "KBS Documentary", status: "안전" },
  ],
  health: [
    { video_id: "oq0eugtuMas", title: "국민건강체조 (새천년건강체조)", channel: "국민체육진흥공단", status: "안전" },
    { video_id: "vKGj6kF8b8o", title: "하체 근력 운동 | 백세수업", channel: "서울아산병원", status: "안전" },
    { video_id: "WhanMCBWDH8", title: "6070 시니어 저강도 운동 1분", channel: "엄마의 생존운동", status: "안전" },
  ],
};
export const NEWS_CATEGORIES = [
  { id: "affairs", label: "시사", query: "국정 시사" },
  { id: "society", label: "사회", query: "사회 뉴스" },
  { id: "health", label: "건강", query: "어르신 건강" },
  { id: "welfare", label: "복지", query: "기초연금 노인 복지" },
  { id: "life", label: "생활", query: "생활 정보" },
];
export const WELFARE_CATEGORIES = [
  { id: "all", label: "전체", query: "all" },
  { id: "care", label: "돌봄·요양", query: "care" },
  { id: "pension", label: "연금·수당", query: "pension" },
  { id: "health", label: "건강·의료", query: "health" },
  { id: "housing", label: "주거·생활", query: "housing" },
];
export const WELFARE_CATEGORY_KEYWORDS = {
  care: ["돌봄", "요양", "장기요양", "재가", "치매", "보호", "독거", "케어", "간병"],
  pension: ["연금", "수당", "급여", "기초생활", "생계", "소득", "지원금"],
  health: ["건강", "의료", "검진", "치료", "재활", "병원", "약"],
  housing: ["주거", "주택", "생활", "임대", "수리", "난방", "에너지"],
};

export const HOME_YOUTUBE_PREVIEW = 5;
export const HOME_NEWS_PREVIEW = 5;
export const HOME_WELFARE_PREVIEW = 5;
export const BROWSE_YOUTUBE_LIMIT = 20;
export const BROWSE_NEWS_LIMIT = 20;
export const BROWSE_WELFARE_LIMIT = 10;
export const YOUTUBE_CACHE_TTL_MS = 30 * 60 * 1000;
export const YOUTUBE_QUOTA_STORAGE_KEY = "sheriff-youtube-quota-date";

export const DEFAULT_LOCATION = {
  latitude: 37.5665,
  longitude: 126.9780,
  label: "서울",
};

export const ENGLISH_TO_KOREAN_REGION = {
  gyeonggi: "경기도",
  seoul: "서울특별시",
  busan: "부산광역시",
  daegu: "대구광역시",
  incheon: "인천광역시",
  gwangju: "광주광역시",
  daejeon: "대전광역시",
  ulsan: "울산광역시",
  sejong: "세종특별자치시",
  gangwon: "강원특별자치도",
  chungbuk: "충청북도",
  chungnam: "충청남도",
  jeonbuk: "전북특별자치도",
  jeonnam: "전라남도",
  gyeongbuk: "경상북도",
  gyeongnam: "경상남도",
  jeju: "제주특별자치도",
};
export const ENGLISH_TO_KOREAN_CITY = {
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
};
