export function generationError(error: unknown): { message: string; status: number; code: string } {
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (status === 401 || code === "invalid_api_key") {
    return { message: "OpenAI API key is invalid. Update OPENAI_API_KEY to create lessons.", status: 503, code: "invalid_api_key" };
  }
  if (code === "insufficient_quota" || code === "credit_balance_exhausted") {
    return { message: "OpenAI project has no available API quota. Check its billing and usage limits.", status: 503, code: "insufficient_quota" };
  }
  if (status === 429) {
    return { message: "AI service limit reached. Please try again later.", status: 503, code: String(code ?? "rate_limited") };
  }
  if (error instanceof Error && error.message.startsWith("This lesson has reached the context limit")) {
    return { message: error.message, status: 422, code: "context_limit" };
  }
  return { message: "Sentence generation failed. Please try again.", status: 502, code: String(code ?? "generation_failed") };
}
