"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight, Sparkles, Package, MapPin, Clock, Image, Tag, Link as LinkIcon,
  Store, ShoppingCart, Bot, Headset, Share2, CreditCard, Star, TrendingUp,
  Globe, Building2, BarChart3, AlertTriangle, Lock, ArrowUpCircle,
  PackageCheck, HelpCircle, Search, Code, ChevronRight, Archive,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  resolveGrowthTips,
  pickGrowthTip,
  type GrowthTip,
  type TipContext,
} from "@/lib/growth-tips/tipEngine";
import { growthTipService, type GrowthTipDTO } from "@/services/GrowthTipSingletonService";

// ─── Icon map ───
const ICONS: Record<string, LucideIcon> = {
  Sparkles, Package, MapPin, Clock, Image, Tag, Link: LinkIcon,
  Store, ShoppingCart, Bot, Headset, Share2, CreditCard, Star, TrendingUp,
  Globe, Building2, BarChart3, AlertTriangle, Lock, ArrowUpCircle,
  PackageCheck, HelpCircle, Search, Code, Archive,
};

// ─── Category badge config ───
const CATEGORY_LABELS: Record<string, string> = {
  onboarding: "Get Started",
  engagement: "Engage",
  upgrade: "Upgrade",
  optimization: "Optimize",
  retention: "Action Needed",
};

interface GrowthTipCardProps {
  tipContext: TipContext;
  /** Auto-rotate interval in ms (0 = no rotation) */
  rotateIntervalMs?: number;
}

function dtoToGrowthTip(dto: GrowthTipDTO): GrowthTip {
  return {
    id: dto.id,
    category: dto.category,
    priority: dto.priority,
    title: dto.title,
    body: dto.body,
    cta: dto.cta,
    ctaLink: dto.ctaLink,
    icon: dto.icon,
    gradient: dto.gradient,
  };
}

export default function GrowthTipCard({
  tipContext,
  rotateIntervalMs = 30000,
}: GrowthTipCardProps) {
  const localTips = useMemo(() => resolveGrowthTips(tipContext, 5), [tipContext]);
  const [backendTips, setBackendTips] = useState<GrowthTip[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    growthTipService.getGrowthTips(tipContext.tenantId, 5).then((tips) => {
      if (!cancelled && tips && tips.length > 0) {
        setBackendTips(tips.map(dtoToGrowthTip));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [tipContext.tenantId]);

  const tips = backendTips ?? localTips;

  // Reset index when tips change
  useEffect(() => {
    setCurrentIndex(0);
  }, [tips.length]);

  // Auto-rotate
  useEffect(() => {
    if (rotateIntervalMs <= 0 || tips.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tips.length);
    }, rotateIntervalMs);
    return () => clearInterval(interval);
  }, [rotateIntervalMs, tips.length]);

  const tip: GrowthTip = useMemo(() => {
    if (tips.length === 0) {
      return pickGrowthTip(tipContext, 0);
    }
    return tips[currentIndex % tips.length];
  }, [tips, currentIndex, tipContext]);

  const Icon = ICONS[tip.icon] ?? Sparkles;
  const categoryLabel = CATEGORY_LABELS[tip.category] ?? "Growth Tip";

  return (
    <div className={`bg-gradient-to-br ${tip.gradient} rounded-2xl p-5 text-white shadow-sm transition-all duration-500`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-white/90" />
          <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
            {categoryLabel}
          </span>
        </div>
        {tips.length > 1 && (
          <div className="flex items-center gap-1">
            {tips.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === currentIndex % tips.length
                    ? "bg-white w-4"
                    : "bg-white/40 hover:bg-white/60"
                }`}
                aria-label={`Tip ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <h3 className="font-semibold text-base mb-2 leading-snug">{tip.title}</h3>
      <p className="text-sm text-white/80 mb-4 leading-relaxed">{tip.body}</p>

      <div className="flex items-center justify-between">
        <Link
          href={tip.ctaLink}
          className="inline-flex items-center text-sm font-medium text-white hover:underline"
        >
          {tip.cta} <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Link>
        {tips.length > 1 && (
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % tips.length)}
            className="inline-flex items-center text-xs text-white/60 hover:text-white transition-colors"
          >
            Next tip <ChevronRight className="w-3 h-3 ml-0.5" />
          </button>
        )}
      </div>
    </div>
  );
}
