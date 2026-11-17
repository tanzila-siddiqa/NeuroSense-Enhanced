import { supabase } from "@/integrations/supabase/client";

export type Modality = "drawing" | "voice";

export const ARCHITECTURES: Record<Modality, { value: string; label: string }[]> = {
  drawing: [
    { value: "cnn-small", label: "CNN (small)" },
    { value: "resnet18", label: "ResNet-18" },
    { value: "efficientnet-b0", label: "EfficientNet-B0" },
    { value: "vit-tiny", label: "ViT-Tiny" },
  ],
  voice: [
    { value: "mfcc-mlp", label: "MFCC + MLP" },
    { value: "cnn-spectrogram", label: "CNN on spectrograms" },
    { value: "crnn", label: "CRNN" },
    { value: "wav2vec2-finetune", label: "wav2vec2 fine-tune" },
  ],
};

export const BALANCING = [
  { value: "none", label: "None" },
  { value: "class_weights", label: "Class weights" },
  { value: "oversample", label: "Oversample minority" },
  { value: "undersample", label: "Undersample majority" },
];

export async function logAudit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from("admin_audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    details: details as never,
  });
}

export function statusTone(status: string) {
  switch (status) {
    case "ready":
    case "completed":
    case "active":
      return "bg-primary/12 text-primary";
    case "running":
    case "processing":
      return "bg-accent/15 text-accent";
    case "failed":
      return "bg-destructive/12 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function pct(value: number | null | undefined) {
  return value == null ? "—" : `${Math.round(value * 1000) / 10}%`;
}
