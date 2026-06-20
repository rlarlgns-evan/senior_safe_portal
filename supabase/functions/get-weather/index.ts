const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ReverseGeocode = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
};

type WeatherPayload = {
  region: string;
  city: string;
  label: string;
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  condition: string;
  latitude: number;
  longitude: number;
};

function weatherCodeToLabel(code: number): string {
  if (code === 0) return "맑음";
  if (code <= 3) return "구름 조금";
  if (code <= 48) return "안개";
  if (code <= 57) return "이슬비";
  if (code <= 67) return "비";
  if (code <= 77) return "눈";
  if (code <= 82) return "소나기";
  if (code <= 86) return "눈";
  if (code <= 99) return "뇌우";
  return "알 수 없음";
}

async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocode> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    localityLanguage: "ko",
  });

  const response = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`역지오코딩 오류 (${response.status})`);
  }

  return await response.json() as ReverseGeocode;
}

async function fetchWeather(lat: number, lng: number) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: "temperature_2m,apparent_temperature,weather_code",
    timezone: "Asia/Seoul",
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`날씨 API 오류 (${response.status})`);
  }

  const data = await response.json() as {
    current?: {
      temperature_2m?: number;
      apparent_temperature?: number;
      weather_code?: number;
    };
  };

  const current = data.current;
  if (!current || typeof current.temperature_2m !== "number") {
    throw new Error("날씨 정보를 받지 못했습니다.");
  }

  const weatherCode = typeof current.weather_code === "number" ? current.weather_code : 0;

  return {
    temperature: Math.round(current.temperature_2m),
    apparentTemperature: Math.round(current.apparent_temperature ?? current.temperature_2m),
    weatherCode,
    condition: weatherCodeToLabel(weatherCode),
  };
}

function buildLocationLabel(geo: ReverseGeocode): { region: string; city: string; label: string } {
  const region = geo.principalSubdivision || geo.countryName || "대한민국";
  const city = geo.city || geo.locality || region;
  const label = geo.locality && geo.locality !== city
    ? `${city} ${geo.locality}`
    : city;

  return { region, city, label };
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

    const body = await req.json();
    const lat = Number(body?.latitude);
    const lng = Number(body?.longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new Error("위도(latitude)와 경도(longitude)가 필요합니다.");
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error("올바른 위도·경도 값이 아닙니다.");
    }

    const [geo, weather] = await Promise.all([
      reverseGeocode(lat, lng),
      fetchWeather(lat, lng),
    ]);

    const location = buildLocationLabel(geo);

    const payload: WeatherPayload = {
      ...location,
      ...weather,
      latitude: lat,
      longitude: lng,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "날씨 조회 실패",
        message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
