import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bot, SendHorizonal, User as UserIcon } from "lucide-react";
import { PageHeader } from "@/components/neuro/PageHeader";
import { Disclaimer } from "@/components/neuro/Disclaimer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { askCompanion } from "@/lib/companion.functions";
import {
  SUGGESTED_QUESTIONS,
  type CompanionMessage,
} from "@/lib/companion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/_authenticated/companion")({
  head: () => ({
    meta: [
      { title: "NeuroSense Companion — ask about screening" },
      {
        name: "description",
        content:
          "Chat with the NeuroSense Companion for plain-language answers about drawing and voice screening. Education only, never a diagnosis.",
      },
      { property: "og:title", content: "NeuroSense Companion" },
      {
        property: "og:description",
        content:
          "Calm, plain-language answers about AI screening — never a medical diagnosis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Companion,
});

const GREETING =
  "Hi 👋 I'm the NeuroSense Companion. Ask me anything about the drawing and voice activities, or how AI screening works. I explain things — I never diagnose.";

function Companion() {
  const { user } = useAuth();
  const ask = useServerFn(askCompanion);

  const [messages, setMessages] = useState<CompanionMessage[]>([
    { role: "assistant", content: GREETING },
  ]);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionId = useRef<string | null>(null);
  const scrollAnchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollAnchor.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, sending]);

  const persist = async (
    role: "user" | "assistant",
    content: string,
  ) => {
    if (!user) return;

    try {
      if (!sessionId.current) {
        const { data } = await supabase
          .from("chat_sessions")
          .insert({
            user_id: user.id,
            title: content.slice(0, 60),
          })
          .select("id")
          .single();

        sessionId.current = data?.id ?? null;
      }

      if (!sessionId.current) return;

      await supabase.from("chat_messages").insert({
        user_id: user.id,
        chat_session_id: sessionId.current,
        role,
        content,
      });
    } catch {
      // Conversation history is a convenience — never block the chat on it.
    }
  };

  const send = async (text: string) => {
    const question = text.trim();

    if (!question || sending) return;

    setError(null);
    setInput("");

    const next: CompanionMessage[] = [
      ...messages,
      {
        role: "user",
        content: question,
      },
    ];

    setMessages(next);
    setSending(true);

    void persist("user", question);

    try {
      const result = await ask({
        data: {
          messages: next
            .filter((m, i) => i > 0 || m.role === "user")
            .slice(-12),
        },
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
        },
      ]);

      void persist("assistant", result.reply);
    } catch (err) {
      const rateLimited =
        err instanceof Error &&
        err.message.includes("rate_limited");

      setError(
        rateLimited
          ? "The Companion is a little busy right now. Please try again in a moment."
          : "Something went wrong while answering. Please try again in a moment.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <main>
      <PageHeader
        eyebrow="Companion"
        title="NeuroSense Companion 🤖"
        subtitle="A calm place to ask questions about screening, drawing and voice activities."
      />

      <section className="mx-auto w-full max-w-2xl space-y-4 px-5">
        <div className="surface-card flex flex-col p-4">
          <div
            className="flex max-h-[52vh] min-h-[240px] flex-col gap-3 overflow-y-auto pr-1"
            role="log"
            aria-live="polite"
            aria-label="Conversation with the NeuroSense Companion"
          >
            {messages.map((message, index) => (
              <div
                key={`${index}-${message.content.slice(0, 12)}`}
                className={
                  message.role === "user"
                    ? "flex items-start justify-end gap-2"
                    : "flex items-start gap-2"
                }
              >
                {message.role === "assistant" && (
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-2xl bg-lavender/12 text-lavender">
                    <Bot aria-hidden="true" className="size-4" />
                  </span>
                )}

                {message.role === "assistant" ? (
                  <div
                    className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted/70 px-3.5 py-2.5 text-sm leading-relaxed"
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => (
                          <h1 className="mb-2 text-base font-bold">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="mb-2 text-base font-bold">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="mb-1.5 text-sm font-bold">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="mb-2 last:mb-0">
                            {children}
                          </p>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold">
                            {children}
                          </strong>
                        ),
                        ul: ({ children }) => (
                          <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="pl-1">
                            {children}
                          </li>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="my-2 border-l-2 border-muted-foreground/30 pl-3 italic">
                            {children}
                          </blockquote>
                        ),
                        code: ({ children }) => (
                          <code className="rounded bg-background/70 px-1 py-0.5 text-xs">
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground">
                    {message.content}
                  </p>
                )}

                {message.role === "user" && (
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <UserIcon
                      aria-hidden="true"
                      className="size-4"
                    />
                  </span>
                )}
              </div>
            ))}

            {sending && (
              <div
                className="flex items-center gap-2"
                aria-label="Companion is typing"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-2xl bg-lavender/12 text-lavender">
                  <Bot aria-hidden="true" className="size-4" />
                </span>

                <span className="flex gap-1 rounded-2xl bg-muted/70 px-3.5 py-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 motion-reduce:animate-none"
                      style={{
                        animationDelay: `${i * 120}ms`,
                      }}
                    />
                  ))}
                </span>
              </div>
            )}

            <div ref={scrollAnchor} />
          </div>

          {error && (
            <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <label
              className="sr-only"
              htmlFor="companion-input"
            >
              Ask the Companion a question
            </label>

            <Input
              id="companion-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask a question…"
              autoComplete="off"
              className="h-11 rounded-xl"
              disabled={sending}
            />

            <Button
              type="submit"
              className="h-11 w-11 shrink-0 rounded-xl p-0"
              disabled={sending || !input.trim()}
              aria-label="Send message"
            >
              <SendHorizonal
                aria-hidden="true"
                className="size-4"
              />
            </Button>
          </form>
        </div>

        <div className="surface-card p-5">
          <h2 className="font-display text-sm font-semibold">
            Suggested questions
          </h2>

          <ul className="mt-3 flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((question) => (
              <li key={question}>
                <button
                  type="button"
                  onClick={() => void send(question)}
                  disabled={sending}
                  className="rounded-full bg-muted/70 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  {question}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <Disclaimer text="The Companion offers general education only. It never diagnoses, and it is not a substitute for a qualified healthcare professional." />
      </section>
    </main>
  );
}