import { callClaude } from "./_lib/claude.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { clientName, clientData, inspiration } = req.body || {};
  if (!clientName || !clientData) {
    res.status(400).json({ error: "clientName and clientData are required" });
    return;
  }

  const prompt = `You are a social media analyst for an event space marketing agency called EVA. Compare this client's current week performance against a set of top-performing event-space posts pulled from the niche for inspiration. Write a concise, direct report (under 250 words) covering: 1) where the client is under/over-performing vs the niche benchmarks, 2) the biggest gap, 3) one concrete recommendation. No fluff, no headers, plain prose.\n\nCLIENT (${clientName}) CURRENT WEEK:\n${clientData}\n\nNICHE INSPIRATION POSTS:\n${inspiration || "None provided yet."}`;

  try {
    const text = await callClaude(prompt);
    res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Failed to generate the report." });
  }
}
