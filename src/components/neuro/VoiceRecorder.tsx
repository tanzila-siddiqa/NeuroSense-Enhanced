import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveGraph } from "@/components/neuro/LiveGraph";
import { formatDuration, pickMimeType, type VoiceMetrics } from "@/lib/voice";

const MAX_POINTS = 120;

export function VoiceRecorder({
  onAnalyze,
  busy = false,
}: {
  onAnalyze: (metrics: VoiceMetrics, blob: Blob) => void;
  busy?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [wave, setWave] = useState<number[]>(new Array(48).fill(0));
  const [blob, setBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const rmsSumRef = useRef(0);
  const rmsCountRef = useRef(0);
  const sampleRateRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);
  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i += 1) sum += buffer[i]! * buffer[i]!;
    const rms = Math.sqrt(sum / buffer.length);
    rmsSumRef.current += rms;
    rmsCountRef.current += 1;

    const pct = Math.min(100, Math.round(rms * 320));
    setLevel(pct);
    setElapsed(performance.now() - startedAtRef.current);
    setLevels((prev) => [...prev, pct].slice(-MAX_POINTS));

    const bars = 48;
    const step = Math.floor(buffer.length / bars);
    const next: number[] = [];
    for (let b = 0; b < bars; b += 1) {
      let peak = 0;
      for (let i = b * step; i < (b + 1) * step; i += 1) peak = Math.max(peak, Math.abs(buffer[i]!));
      next.push(Math.min(1, peak * 3.2));
    }
    setWave(next);

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      sampleRateRef.current = ctx.sampleRate;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setBlob(recorded);
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(recorded);
        });
      };
      recorder.start(200);
      recorderRef.current = recorder;

      rmsSumRef.current = 0;
      rmsCountRef.current = 0;
      startedAtRef.current = performance.now();
      setLevels([]);
      setElapsed(0);
      setBlob(null);
      setRecording(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("We couldn't reach your microphone. Please allow microphone access and try again.");
    }
  };

  const stop = () => {
  const recorder = recorderRef.current;

  if (!recorder || recorder.state === "inactive") return;

  recorder.onstop = () => {
    const recorded = new Blob(chunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    });

    console.log("[VOICE] recorded:", {
      type: recorded.type,
      size: recorded.size,
      chunks: chunksRef.current.length,
    });

    setBlob(recorded);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(recorded);
    });

    recorderRef.current = null;
    setRecording(false);
    setLevel(0);
    setWave(new Array(48).fill(0));

    cleanup();
  };

  recorder.stop();
};

  const reset = () => {
    setBlob(null);
    setLevels([]);
    setElapsed(0);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const analyze = () => {
  if (!blob || blob.size === 0) {
    setError("No valid recording is available. Please record again.");
    return;
  }

  const avgRms =
    rmsCountRef.current > 0
      ? rmsSumRef.current / rmsCountRef.current
      : 0;

  console.log(
    "[VOICE] sending:",
    blob.type,
    blob.size,
    "bytes"
  );

  onAnalyze(
    {
      durationMs: Math.round(elapsed),
      sampleRate: sampleRateRef.current,
      amplitudeRms: Math.round(avgRms * 10000) / 10000,
    },
    blob,
  );
};

  return (
    <div className="space-y-3">
      <div className="surface-card flex flex-col items-center gap-4 p-6">
        <span
          className={`grid size-20 place-items-center rounded-full transition-colors ${
            recording ? "bg-primary/15 text-primary animate-breathe motion-reduce:animate-none" : "bg-muted text-muted-foreground"
          }`}
        >
          <Mic aria-hidden="true" className="size-8" />
        </span>
        <p className="font-display text-2xl font-semibold tabular-nums" aria-live="polite">
          {formatDuration(elapsed)}
        </p>

        <div className="flex h-16 w-full items-center justify-center gap-[3px]" aria-hidden="true">
          {wave.map((v, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-primary/70 transition-[height] duration-75 motion-reduce:transition-none"
              style={{ height: `${Math.max(3, v * 60)}px` }}
            />
          ))}
        </div>

        <div className="w-full">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Input level</span>
            <span className="tabular-nums">{level}%</span>
          </div>
          <div
            className="mt-1 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Microphone input level"
            aria-valuenow={level}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-100 motion-reduce:transition-none"
              style={{ width: `${level}%` }}
            />
          </div>
        </div>
      </div>

      <LiveGraph
        values={levels}
        max={100}
        label="Live voice level graph"
        unit="%"
        accent="lavender"
      />

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {audioUrl && !recording && (
        <div className="surface-card p-4">
          <p className="text-sm font-semibold text-primary">Recording complete ✓</p>
          <audio controls src={audioUrl} className="mt-3 w-full" aria-label="Replay your recording" />
        </div>
      )}

      {!recording && !blob && (
        <Button className="h-12 w-full rounded-xl" onClick={() => void start()} disabled={busy}>
          <Mic aria-hidden="true" className="size-4" /> Start recording
        </Button>
      )}

      {recording && (
        <Button variant="outline" className="h-12 w-full rounded-xl" onClick={stop}>
          <Square aria-hidden="true" className="size-4" /> Stop recording
        </Button>
      )}

      {!recording && blob && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12 rounded-xl" onClick={reset} disabled={busy}>
            <RotateCcw aria-hidden="true" className="size-4" /> Record again
          </Button>
          <Button className="h-12 rounded-xl" onClick={analyze} disabled={busy}>
            <Sparkles aria-hidden="true" className="size-4" /> Analyze voice
          </Button>
        </div>
      )}
    </div>
  );
}
