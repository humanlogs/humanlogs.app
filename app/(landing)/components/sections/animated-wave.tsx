"use client";

import { useEffect, useRef } from "react";

const SPEAKER_COLORS = [
  "#10b981", // green - Speaker 1
  "#ec4899", // pink - Speaker 2
  "#3b82f6", // blue - Speaker 3
];

// Define speaker segments with silence gaps (4x more segments for variety)
const SPEAKER_SEGMENTS = [
  { start: 0, end: 0.02, color: "#d1d5db" }, // silence
  { start: 0.02, end: 0.08, color: SPEAKER_COLORS[0] }, // green activity
  { start: 0.08, end: 0.095, color: "#d1d5db" }, // silence
  { start: 0.095, end: 0.15, color: SPEAKER_COLORS[0] }, // green continues
  { start: 0.15, end: 0.17, color: "#d1d5db" }, // silence
  { start: 0.17, end: 0.24, color: SPEAKER_COLORS[1] }, // pink activity
  { start: 0.24, end: 0.255, color: "#d1d5db" }, // silence
  { start: 0.255, end: 0.29, color: SPEAKER_COLORS[1] }, // pink continues
  { start: 0.29, end: 0.31, color: "#d1d5db" }, // silence
  { start: 0.31, end: 0.36, color: SPEAKER_COLORS[0] }, // green activity
  { start: 0.36, end: 0.375, color: "#d1d5db" }, // silence
  { start: 0.375, end: 0.44, color: SPEAKER_COLORS[0] }, // green continues
  { start: 0.44, end: 0.46, color: "#d1d5db" }, // silence
  { start: 0.46, end: 0.52, color: SPEAKER_COLORS[2] }, // blue activity
  { start: 0.52, end: 0.535, color: "#d1d5db" }, // silence
  { start: 0.535, end: 0.59, color: SPEAKER_COLORS[1] }, // pink activity
  { start: 0.59, end: 0.61, color: "#d1d5db" }, // silence
  { start: 0.61, end: 0.67, color: SPEAKER_COLORS[1] }, // pink continues
  { start: 0.67, end: 0.685, color: "#d1d5db" }, // silence
  { start: 0.685, end: 0.73, color: SPEAKER_COLORS[0] }, // green activity
  { start: 0.73, end: 0.745, color: "#d1d5db" }, // silence
  { start: 0.745, end: 0.79, color: SPEAKER_COLORS[2] }, // blue activity
  { start: 0.79, end: 0.805, color: "#d1d5db" }, // silence
  { start: 0.805, end: 0.85, color: SPEAKER_COLORS[2] }, // blue continues
  { start: 0.85, end: 0.87, color: "#d1d5db" }, // silence
  { start: 0.87, end: 0.91, color: SPEAKER_COLORS[0] }, // green activity
  { start: 0.91, end: 0.925, color: "#d1d5db" }, // silence
  { start: 0.925, end: 0.96, color: SPEAKER_COLORS[1] }, // pink activity
  { start: 0.96, end: 0.97, color: "#d1d5db" }, // silence
  { start: 0.97, end: 0.99, color: SPEAKER_COLORS[0] }, // green activity
  { start: 0.99, end: 1, color: "#d1d5db" }, // silence
];

export const AnimatedWave = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const width = canvas.width;
    const height = canvas.height;
    const barWidth = 3;
    const barGap = 1;
    const step = barWidth + barGap;
    const numBars = Math.floor(width / step);

    // Generate bars with multiple frequency components for natural look
    const bars = Array.from({ length: numBars }, (_, i) => {
      const position = i / numBars;

      // Find which speaker segment this bar belongs to
      let segment = SPEAKER_SEGMENTS[0];
      for (const seg of SPEAKER_SEGMENTS) {
        if (position >= seg.start && position < seg.end) {
          segment = seg;
          break;
        }
      }

      const isSilence = segment.color === "#d1d5db";

      return {
        baseHeight: isSilence ? 0.05 : Math.random() * 0.25 + 0.15,
        color: segment.color,
        // Multiple frequency components for natural movement
        freq1: 0.015 + Math.random() * 0.02,
        freq2: 0.03 + Math.random() * 0.04,
        freq3: 0.005 + Math.random() * 0.01,
        phase1: Math.random() * Math.PI * 2,
        phase2: Math.random() * Math.PI * 2,
        phase3: Math.random() * Math.PI * 2,
        noise: Math.random() * 0.1,
        isSilence,
      };
    });

    let time = 0;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      const halfHeight = height / 2;

      bars.forEach((bar, i) => {
        const x = i * step;

        // Combine multiple frequencies for natural movement
        const osc1 = Math.sin(time * bar.freq1 + bar.phase1);
        const osc2 = Math.sin(time * bar.freq2 + bar.phase2) * 0.5;
        const osc3 = Math.sin(time * bar.freq3 + bar.phase3) * 0.3;

        // Add some noise for irregularity
        const noiseValue = (Math.random() - 0.5) * bar.noise;

        const oscillation = (osc1 + osc2 + osc3) / 1.8 + noiseValue;
        const amplitude = bar.baseHeight * halfHeight;
        const barHeight = amplitude * (0.6 + oscillation * 0.4);

        ctx.fillStyle = bar.color;
        ctx.beginPath();
        ctx.roundRect(
          x - barWidth / 2,
          halfHeight - barHeight,
          barWidth,
          barHeight * 2,
          4,
        );
        ctx.fill();
      });

      time += 1;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  return (
    <div className="w-full h-10 rounded-full bg-gray-200/50 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};
