"use client";

import { BACKGROUNDS } from "@/lib/store";

export function backgroundCss(bg, upload) {
  if (bg.kind === "solid") return bg.color;
  if (bg.kind === "url" && bg.url) return `url("${bg.url.replace(/"/g, "%22")}") center / cover no-repeat, #0b0d12`;
  if (bg.kind === "upload" && upload) return `url("${upload}") center / cover no-repeat, #0b0d12`;
  return (BACKGROUNDS.find((b) => b.id === bg.preset) ?? BACKGROUNDS[0]).css;
}

export default function Background({ appearance, upload }) {
  const bg = appearance.background;
  const preset = bg.kind === "preset" ? BACKGROUNDS.find((b) => b.id === bg.preset) : null;
  const blur = appearance.bgBlur;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 transition-[background] duration-500"
        style={{
          background: backgroundCss(bg, upload),
          filter: blur ? `blur(${blur}px)` : undefined,
          transform: blur ? "scale(1.06)" : undefined,
        }}
      />
      {preset?.animated && (
        <>
          <div
            className="aurora-blob"
            style={{ width: "55vw", height: "55vw", left: "-10vw", top: "-15vw", background: "#2563eb" }}
          />
          <div
            className="aurora-blob"
            style={{
              width: "45vw",
              height: "45vw",
              right: "-8vw",
              top: "5vh",
              background: "#9333ea",
              animationDelay: "-8s",
              animationDuration: "32s",
            }}
          />
          <div
            className="aurora-blob"
            style={{
              width: "50vw",
              height: "40vw",
              left: "20vw",
              bottom: "-20vw",
              background: "#10b981",
              animationDelay: "-16s",
              animationDuration: "38s",
            }}
          />
        </>
      )}
      <div
        className="absolute inset-0 transition-colors duration-500"
        style={{ background: `rgb(var(--overlay) / ${appearance.bgDim / 100})` }}
      />
    </div>
  );
}
