export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing OpenAI API key on server" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { messages } = body ?? {};

    // bez streamowania: robimy jedno zapytanie i zwracamy całą odpowiedź jako JSON
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: Array.isArray(messages) ? messages : [],
        // max_tokens, temperature itp. dodaj według potrzeb
      }),
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text().catch(() => "<no body>");
      return new Response(
        JSON.stringify({ error: "OpenAI request failed", details: text }),
        { status: 502, headers: { "content-type": "application/json" } }
      );
    }

    const data = await openaiRes.json();
    // Bezpiecznie wyciągamy tekst odpowiedzi:
    const content =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      "";

    return new Response(JSON.stringify({ content, raw: data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Chat route failed", details: String(err) }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}