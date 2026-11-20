export type EmbeddingInputType = "document" | "query";

export async function embedTexts(
  texts: string[],
  inputType: EmbeddingInputType = "document"
): Promise<number[][]> {
  const provider = process.env.EMBEDDING_PROVIDER || "voyage";

  if (provider === "voyage") {
    const apiKey = process.env.VOYAGE_API_KEY;
    const model = process.env.VOYAGE_EMBEDDING_MODEL || "voyage-3";
    if (!apiKey) {
      throw new Error("Missing VOYAGE_API_KEY in environment.");
    }
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model,
        input_type: inputType,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Voyage embeddings error (${response.status}): ${errText}`);
    }
    const json = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return json.data.map((d) => d.embedding);
  }

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
    const dimensions = Number(process.env.EMBEDDING_DIMENSION || 1024);
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY in environment.");
    }
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model,
        dimensions,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI embeddings error (${response.status}): ${errText}`);
    }
    const json = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return json.data.map((d) => d.embedding);
  }

  throw new Error(`Unsupported EMBEDDING_PROVIDER: ${provider}`);
}
