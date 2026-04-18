import { APICallError } from "@ai-sdk/provider";
import { openai } from "@ai-sdk/openai";
import { StreamingTextResponse, streamText } from "ai";
import { NextResponse } from "next/server";

function chatRouteError(error: unknown): { message: string; status: number } {
  if (APICallError.isAPICallError(error)) {
    const data = error.data as
      | { error?: { code?: string | null; message?: string } }
      | undefined;
    const code = data?.error?.code ?? undefined;
    if (code === "insufficient_quota") {
      return {
        message:
          "OpenAI account has no usable quota. Add billing at https://platform.openai.com/account/billing (changing the model does not fix this).",
        status: 402,
      };
    }
    if (data?.error?.message) {
      return {
        message: data.error.message,
        status:
          error.statusCode != null &&
          error.statusCode >= 400 &&
          error.statusCode < 600
            ? error.statusCode
            : 502,
      };
    }
    if (typeof error.responseBody === "string") {
      try {
        const parsed = JSON.parse(error.responseBody) as {
          error?: { message?: string; code?: string | null };
        };
        if (parsed.error?.code === "insufficient_quota") {
          return {
            message:
              "OpenAI account has no usable quota. Add billing at https://platform.openai.com/account/billing (changing the model does not fix this).",
            status: 402,
          };
        }
        if (parsed.error?.message) {
          return {
            message: parsed.error.message,
            status:
              error.statusCode != null &&
              error.statusCode >= 400 &&
              error.statusCode < 600
                ? error.statusCode
                : 502,
          };
        }
      } catch {
        /* ignore JSON parse */
      }
    }
    return {
      message: error.message,
      status: error.statusCode ?? 500,
    };
  }

  if (error instanceof Error) {
    return { message: error.message, status: 500 };
  }
  return { message: "Chat request failed", status: 500 };
}

/** Plain body: `useChat` uses `new Error(await response.text())` on non-OK responses. */
function plainError(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return plainError(
        "Missing OPENAI_API_KEY. Add it to open-ai-chatbot/.env and restart the dev server.",
        500
      );
    }

    const modelId = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    const result = await streamText({
      model: openai(modelId),
      messages,
      maxRetries: 0,
    });
    return new StreamingTextResponse(result.toAIStream());
  } catch (error: unknown) {
    const { message, status } = chatRouteError(error);
    if (process.env.NODE_ENV === "development") {
      console.warn("[api/chat]", message);
    }
    return plainError(message, status);
  }
}
