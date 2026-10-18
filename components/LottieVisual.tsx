"use client";

import { Lottie } from "lottie-react";
import { useEffect, useState, type CSSProperties } from "react";

const DEFAULT_ANIMATION_URL = "/animations/health-network.json";

type AnimationData = Record<string, unknown>;

export interface LottieVisualProps {
  /** Public URL for the Lottie JSON file. */
  src?: string;
  /** Optional styles applied to both the animation and its fallback. */
  style?: CSSProperties;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  /** Accessible name used when the animation is available. */
  ariaLabel?: string;
}

const containerStyle: CSSProperties = {
  display: "grid",
  minHeight: 240,
  placeItems: "center",
  width: "100%",
};

const fallbackStyle: CSSProperties = {
  ...containerStyle,
  border: "1px solid #dce7ec",
  borderRadius: 16,
  background: "linear-gradient(135deg, #f7fbfc 0%, #e8f5f2 100%)",
  color: "#6b7d8f",
  fontSize: 13,
  padding: 24,
  textAlign: "center",
};

export default function LottieVisual({
  src = DEFAULT_ANIMATION_URL,
  style,
  className,
  loop = true,
  autoplay = true,
  ariaLabel = "Health network animation",
}: LottieVisualProps) {
  const [animationData, setAnimationData] = useState<AnimationData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();

    setAnimationData(null);
    setStatus("loading");

    fetch(src, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Animation request failed with status ${response.status}`);
        }

        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("Animation data is not a JSON object");
        }

        setAnimationData(data as AnimationData);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus("error");
        }
      });

    return () => controller.abort();
  }, [src]);

  if (!animationData) {
    return (
      <div
        aria-live="polite"
        className={className}
        role="status"
        style={{ ...fallbackStyle, ...style }}
      >
        {status === "loading" ? "Loading animation…" : "Animation unavailable"}
      </div>
    );
  }

  return (
    <div
      aria-label={ariaLabel}
      className={className}
      role="img"
      style={{ ...containerStyle, ...style }}
    >
      <Lottie
        autoplay={autoplay}
        loop={loop}
        src={animationData}
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}
