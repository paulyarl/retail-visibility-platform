"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

interface RecommendationCardProps {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  cta: string;
  ctaLink: string;
}

export default function RecommendationCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  description,
  cta,
  ctaLink,
}: RecommendationCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-lg ${iconBg} flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-sm">{title}</h4>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
          <Link
            href={ctaLink}
            className="inline-flex items-center text-xs text-blue-600 font-medium mt-2 hover:underline"
          >
            {cta} <ArrowRight className="w-3 h-3 ml-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
