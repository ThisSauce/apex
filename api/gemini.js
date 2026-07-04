export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    // Frontend sends { prompt, maxTokens, temperature } — translate that
    // into Gemini's generateContent request shape.
    const { prompt, maxTokens = 2000, temperature = 0.3 } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing 'prompt' in request body" });

    const model = "gemini-flash-latest";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
    });

    const data = await response.json();

    // Simplify the response for the frontend: pull out the plain text if
    // present, but also pass through the raw Gemini payload in case it's
    // ever needed (e.g. for debugging finishReason/safety blocks).
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || "Gemini request failed" });
    }

    res.status(200).json({ text, raw: data });
  } catch (err) {
    res.status(500).json({ error: "Gemini proxy error", detail: err.message });
  }
}
