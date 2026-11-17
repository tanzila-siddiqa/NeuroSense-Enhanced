import { createServerFn } from "@tanstack/react-start";
import { GoogleGenAI } from "@google/genai";

type CompanionMessage = {
  role: "user" | "assistant";
  content: string;
};

type CompanionRequest = {
  messages: CompanionMessage[];
};

export const askCompanion = createServerFn({
  method: "POST",
})
  .validator((data: CompanionRequest) => data)
  .handler(async ({ data }): Promise<{ reply: string }> => {
    const apiKey = process.env["GEMINI_API_KEY"];

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const messages = data.messages ?? [];

    const ai = new GoogleGenAI({
      apiKey,
    });

    const systemInstruction = `
You are NeuroSense Companion, a helpful AI assistant.

You can answer general questions on any topic the user asks.

For NeuroSense-related questions:
- NeuroSense is an AI-powered Parkinson's screening support application.
- It is NOT a medical diagnosis.
- Never claim that NeuroSense can definitively diagnose Parkinson's disease.
- Explain medical topics clearly and responsibly.

For general questions:
- Answer normally and helpfully.
- Do not restrict yourself to Parkinson's-related topics.
- If the user asks about programming, studies, technology, mathematics, careers, general knowledge, writing, or any other topic, answer that question directly.
- If you are unsure about something, say so rather than inventing facts.

For health-related questions:
- Provide general educational information.
- Do not diagnose the user.
- Do not claim certainty about a disease.
- If the user describes personal symptoms or asks for medical advice, recommend speaking with a qualified healthcare professional.

Style:
- Be friendly, natural, and conversational.
- Answer the user's actual question directly.
- Keep answers reasonably concise unless the user asks for more detail.
- Use Markdown when useful.
- Do not force NeuroSense into unrelated answers.
`;

    const conversation = messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [
        {
          text: message.content,
        },
      ],
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: conversation,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply =
      response.text?.trim() ||
      "Sorry, I couldn't generate a response right now.";

    return { reply };
  });
