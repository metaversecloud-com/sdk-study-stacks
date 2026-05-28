import { useState } from "react";

const RISO_INKS = ["#ff3b6a", "#ffc93c", "#1fb8a9", "#1b3dcd", "#e0492b", "#fbf8f2"];

export const Confetti = () => {
  const [pieces] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.4 + Math.random() * 0.8,
      color: RISO_INKS[i % RISO_INKS.length],
      rotation: Math.random() * 360,
      size: 8 + Math.random() * 8,
      drift: (Math.random() - 0.5) * 80,
      shape: Math.random() > 0.5 ? "bar" : "dot",
    })),
  );

  return (
    <>
      <style>{`
        @keyframes tr-confetti-fall {
          0% { transform: translateY(-30px) translateX(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(260px) translateX(var(--drift)) rotate(720deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tr-confetti-piece { animation: none !important; opacity: 0 !important; }
        }
      `}</style>
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10" aria-hidden="true">
        {pieces.map((p) => (
          <div
            key={p.id}
            className="tr-confetti-piece"
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: 0,
              width: p.shape === "bar" ? p.size : p.size * 0.7,
              height: p.shape === "bar" ? p.size * 0.35 : p.size * 0.7,
              backgroundColor: p.color,
              border: "1.5px solid #0e1116",
              borderRadius: p.shape === "dot" ? "50%" : 2,
              transform: `rotate(${p.rotation}deg)`,
              animation: `tr-confetti-fall ${p.duration}s cubic-bezier(0.16, 1, 0.3, 1) ${p.delay}s forwards`,
              ["--drift" as string]: `${p.drift}px`,
            }}
          />
        ))}
      </div>
    </>
  );
};

export default Confetti;
