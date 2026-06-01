"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

interface GrowthTipCardProps {
  tip?: string;
  cta?: string;
  ctaLink?: string;
}

export default function GrowthTipCard({
  tip = "Businesses like yours that use automations see 28% more growth on average.",
  cta = "Learn More",
  ctaLink = "#",
}: GrowthTipCardProps) {
  return (
    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-yellow-300" />
        <h3 className="font-semibold">Growth Tip</h3>
      </div>
      <p className="text-sm text-blue-100 mb-4">{tip}</p>
      <Link
        href={ctaLink}
        className="inline-flex items-center text-sm font-medium text-white hover:underline"
      >
        {cta} <ArrowRight className="w-3.5 h-3.5 ml-1" />
      </Link>
    </div>
  );
}
