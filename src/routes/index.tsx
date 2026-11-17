import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NeuroSense — AI-Powered Parkinson’s Screening" },
      {
        name: "description",
        content:
          "NeuroSense is an AI-powered screening support tool using drawing and voice analysis. Not a medical diagnosis.",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/neurosense-icon.png",
        type: "image/png",
      },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const startedRef = useRef(false);
  const [started, setStarted] = useState(false);

  const startVideo = async () => {
    // Prevent the video from restarting after it has already started
    if (startedRef.current) return;

    const video = videoRef.current;
    if (!video) return;

    try {
      video.currentTime = 0;
      video.muted = false;
      video.volume = 1;

      await video.play();

      startedRef.current = true;
      setStarted(true);
    } catch (error) {
      console.error("Could not start welcome video:", error);
    }
  };

  // Desktop: Space key starts the video
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        startVideo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // When video finishes, go to Login/Signup
  const handleVideoEnd = () => {
    navigate({ to: "/auth" });
  };

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-black"
      onClick={startVideo}
    >
      {/* Welcome video */}
      <video
        ref={videoRef}
        src="/welcome-video.mp4"
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        preload="auto"
        controls={false}
        muted={false}
        onEnded={handleVideoEnd}
      />

      {/* NeuroSense logo */}
      <div className="absolute left-6 top-6 z-20 sm:left-10 sm:top-10">
        <img
          src="/neurosense-icon.png"
          alt="NeuroSense"
          className="h-24 w-24 object-contain drop-shadow-xl sm:h-28 sm:w-28"
        />
      </div>

      {/* Screening disclaimer */}
      <div className="absolute bottom-5 left-1/2 z-20 w-[90%] -translate-x-1/2 text-center text-[11px] text-white/80 drop-shadow">
        Screening support only — not a medical diagnosis.
      </div>
    </main>
  );
}