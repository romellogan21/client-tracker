import { callClaude } from "./_lib/claude.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { clientName, trends } = req.body || {};
  if (!clientName || !trends) {
    res.status(400).json({ error: "clientName and trends are required" });
    return;
  }

  const prompt = `You run content strategy for an event space client called ${clientName} in the event-venue niche. Based on these current trend notes, generate 6 specific, ready-to-shoot content ideas (Reels/posts) tailored to an event space. Format as a tight numbered list, one line each, no preamble.\n\nTRENDS:\n${trends}`;

  try {
    const text = await callClaude(prompt);
    res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Failed to generate content ideas." });
  }
}
