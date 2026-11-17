import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/neuro/PageHeader";
import { Disclaimer } from "@/components/neuro/Disclaimer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_authenticated/learn")({
  head: () => ({
    meta: [
      { title: "Learn — NeuroSense" },
      { name: "description", content: "Plain-language articles about movement, voice and brain health. Educational only." },
      { property: "og:title", content: "Learn — NeuroSense" },
      { property: "og:description", content: "Plain-language articles about movement, voice and brain health. Educational only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Learn,
});

const articles = [
  {
    title: "Screening vs. diagnosis",
    body: "Screening looks for patterns that may be worth a closer look. A diagnosis is a clinical conclusion made by a qualified healthcare professional using history, examination and often several tests. NeuroSense only ever does the first of these, and its estimates should never be read as a conclusion about your health.",
  },
  {
    title: "What is Parkinson's disease?",
    body: "Parkinson's disease is a progressive condition affecting the parts of the brain that help coordinate movement. It is diagnosed by clinicians based on a combination of symptoms and examination — not by any single app, test or score.",
  },
  {
    title: "Motor symptoms in plain language",
    body: "Movement-related changes people sometimes notice include slower movement, stiffness, tremor at rest, or changes in balance and handwriting. Many everyday things — tiredness, stress, caffeine, medication — can affect movement too, which is one reason a single measurement means very little on its own.",
  },
  {
    title: "Why drawing patterns are studied",
    body: "Tasks like tracing a spiral require steady, coordinated fine motor control. Researchers study features of these tracings — smoothness, speed variation, pressure — because they can reflect subtle differences in motor control. Research interest is not the same as clinical proof.",
  },
  {
    title: "What voice changes can mean",
    body: "Speech relies on precise muscle control, so researchers study features such as volume steadiness, pitch variation and articulation. Voice also changes with colds, allergies, tiredness, microphones and rooms — context matters enormously.",
  },
  {
    title: "How AI screening works",
    body: "A model is shown many examples and learns statistical patterns that tend to separate groups. When you complete an activity, the model outputs a probability — a statement about pattern similarity, not about you. Confidence scores describe how sure the model is about its own output, not how correct it is.",
  },
  {
    title: "Limitations of AI screening",
    body: "Models reflect the data they were trained on and may perform differently across ages, languages, devices and backgrounds. They can be confidently wrong. They cannot see your medical history. Treat every score here as a conversation starter, never a verdict.",
  },
  {
    title: "When to talk to a doctor",
    body: "If you're worried about changes in movement, speech, balance or handwriting — or if something simply feels different to you — speak with a qualified healthcare professional. That's the right step regardless of what any screening app shows.",
  },
];

function Learn() {
  return (
    <main>
      <PageHeader
        eyebrow="Learn"
        title="Understand the basics 📚"
        subtitle="Short, plain-language explainers. No jargon, no scare stories."
      />

      <section className="mx-auto w-full max-w-2xl space-y-4 px-5">
        <Accordion type="single" collapsible className="surface-card px-5 py-1">
          {articles.map((article) => (
            <AccordionItem key={article.title} value={article.title}>
              <AccordionTrigger className="text-left font-display text-sm font-semibold">
                {article.title}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {article.body}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <Disclaimer text="Educational content only. Nothing here is medical advice or a diagnosis." />
      </section>
    </main>
  );
}
