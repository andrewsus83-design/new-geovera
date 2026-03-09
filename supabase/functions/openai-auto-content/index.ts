
/**
 * ⚠️  DEPRECATED — openai-auto-content
 *
 * This function has been retired.
 * The pipeline has been replaced by:
 *
 *   generate-daily-insights (72H cycle)
 *     └── generate-article (OpenAI GPT-4o for article/SEO/GEO/Social + Claude Sonnet for image/video prompts)
 *
 * All callers should switch to the generate-article function.
 */

Deno.serve((_req: Request) => {
  return new Response(
    JSON.stringify({
      error:      "DEPRECATED",
      message:    "openai-auto-content has been retired. Use generate-article instead.",
      migration:  {
        new_function: "generate-article",
        trigger:      "generate-daily-insights (72H cycle, auto_draft mode)",
        docs:         "POST /functions/v1/generate-article with brand_id, topic, mode='auto_draft'",
      },
    }),
    {
      status: 410, // 410 Gone
      headers: { "Content-Type": "application/json" },
    }
  );
});
