export async function getInvokeErrorMessage(error, data) {
  if (data?.message) return data.message;
  if (typeof data?.error === "string") return data.error;

  const response = error?.context;
  if (response && typeof response.json === "function") {
    try {
      const body = await response.clone().json();
      if (body?.message) return body.message;
    } catch {
      // ignore
    }
  }

  return error?.message || "링크 분석 요청에 실패했습니다.";
}

