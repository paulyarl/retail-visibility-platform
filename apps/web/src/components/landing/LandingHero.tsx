"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShelfShader } from "./ShelfShader";

const CAPABILITIES = [
  "sync products to Google Shopping",
  "build a storefront that sells",
  "list products in our retail directory",
  "let an AI chatbot sell your products",
  "track product sales with real-time analytics",
  "make every product compete with the giants",
  "turn your shelves into a digital storefront",
];

const BASE_TEXT = "Make every product visible —";

export function LandingHero() {
  const [animatedSuffix, setAnimatedSuffix] = useState<string>("");
  const typingStateRef = useRef({
    suggestionIndex: 0,
    charIndex: 0,
    deleting: false,
    running: true,
  });
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    typingStateRef.current.running = true;
    const typeSpeed = 70;
    const deleteSpeed = 40;
    const pauseAtEnd = 1400;
    const pauseBetween = 500;

    function schedule(fn: () => void, delay: number) {
      const id = window.setTimeout(fn, delay);
      timersRef.current.push(id);
    }

    function clearTimers() {
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
    }

    function step() {
      if (!typingStateRef.current.running) return;

      const state = typingStateRef.current;
      const current = CAPABILITIES[state.suggestionIndex % CAPABILITIES.length] || "";

      if (!state.deleting) {
        const nextIndex = state.charIndex + 1;
        const next = current.slice(0, nextIndex);
        setAnimatedSuffix(next);
        state.charIndex = nextIndex;
        if (nextIndex >= current.length) {
          schedule(() => {
            state.deleting = true;
            step();
          }, pauseAtEnd);
        } else {
          schedule(step, typeSpeed);
        }
      } else {
        const nextIndex = Math.max(0, state.charIndex - 1);
        const next = current.slice(0, nextIndex);
        setAnimatedSuffix(next);
        state.charIndex = nextIndex;
        if (nextIndex <= 0) {
          state.deleting = false;
          state.suggestionIndex = (state.suggestionIndex + 1) % CAPABILITIES.length;
          schedule(step, pauseBetween);
        } else {
          schedule(step, deleteSpeed);
        }
      }
    }

    clearTimers();
    schedule(step, 600);
    return () => {
      typingStateRef.current.running = false;
      clearTimers();
    };
  }, []);

  const scrollToContent = () => {
    const el = document.getElementById("landing-content");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section
      className="relative w-full"
      style={{ height: "100vh", minHeight: "600px", background: "#0a0a0f" }}
      aria-label="VisibleShelf landing hero"
    >
      {/* Shader background */}
      <ShelfShader
        className="absolute inset-0"
        style={{ zIndex: 1 }}
      />

      {/* Dark overlay gradient for text readability */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 2,
          background:
            "radial-gradient(ellipse at center, rgba(10,10,15,0.2) 0%, rgba(10,10,15,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Rounded transparent navbar */}
      <nav
        className="absolute top-4 left-1/2 -translate-x-1/2 z-20"
        style={{ width: "calc(100% - 2rem)", maxWidth: "900px" }}
      >
        <div
          className="flex items-center justify-between rounded-2xl border border-white/10 shadow-lg"
          style={{
            background: "rgba(15,15,20,0.45)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            padding: "0.5rem 1rem",
          }}
        >
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-white font-bold text-base sm:text-lg tracking-tight">
              VisibleShelf
            </span>
          </Link>

          {/* Nav links - hidden on mobile */}
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={scrollToContent}
              className="text-white/70 hover:text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              Welcome
            </button>
            <Link
              href="/features"
              className="text-white/70 hover:text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              Features
            </Link>
            <Link
              href="/directory"
              className="text-white/70 hover:text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              Directory
            </Link>
            <Link
              href="/support"
              className="text-white/70 hover:text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              Support
            </Link>
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/auth/login"
              className="text-white text-sm font-medium px-4 py-2 rounded-xl border border-white/15 hover:border-white/30 transition-colors"
              style={{ background: "rgba(15,15,20,0.6)" }}
            >
              Login
            </Link>
            <Link
              href="/auth/signup"
              className="text-black text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors"
              style={{ background: "rgba(255,255,255,0.95)" }}
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* Content overlay */}
      <div
        className="absolute inset-0 z-10 flex items-center justify-center"
        style={{ pointerEvents: "none", padding: "24px" }}
      >
        <div className="max-w-3xl w-full text-center" style={{ pointerEvents: "auto" }}>
          <h1 className="text-white text-3xl sm:text-5xl md:text-6xl font-semibold tracking-tight drop-shadow-[0_1px_8px_rgba(31,61,188,0.25)]">
            {BASE_TEXT}
          </h1>
          <div className="mt-2 sm:mt-3 text-lg sm:text-2xl md:text-3xl font-medium text-white/80 min-h-[1.5em]">
            {animatedSuffix}
            <span className="inline-block w-[3px] h-[0.9em] ml-1 align-middle bg-white/70 animate-pulse" />
          </div>
          <p className="text-gray-300/90 mt-4 sm:mt-6 text-sm sm:text-base md:text-lg max-w-xl mx-auto">
            The platform that puts your products in front of every shopper — inventory sync,
            storefronts, AI chatbots, and a retail directory, all working to make your products visible.
          </p>

          {/* CTA buttons */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={scrollToContent}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-white font-semibold border border-white/20 hover:border-white/40 transition-colors"
              style={{ background: "rgba(15,15,20,0.5)", backdropFilter: "blur(8px)" }}
            >
              Explore the platform
            </button>
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-black font-semibold hover:bg-gray-100 transition-colors"
              style={{ background: "rgba(255,255,255,0.95)" }}
            >
              Get started free →
            </Link>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        onClick={scrollToContent}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-white/50 hover:text-white/80 transition-colors"
        style={{ pointerEvents: "auto" }}
        aria-label="Scroll to content"
      >
        <svg
          className="w-6 h-6 animate-bounce"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>
    </section>
  );
}
