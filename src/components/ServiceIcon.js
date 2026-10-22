"use client";

import { useState } from "react";

function hue(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export default function ServiceIcon({ src, name, size = 40, className = "" }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    const initials = name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const h = hue(name);
    return (
      <div
        className={`grid shrink-0 place-items-center rounded-[28%] font-semibold text-white ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.38,
          background: `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 42%))`,
        }}
        aria-hidden
      >
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain drop-shadow-sm ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
