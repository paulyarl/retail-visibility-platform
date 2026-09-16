"use client";

import { MessageCircle } from "lucide-react";

interface WhatsAppCtaButtonProps {
  /** Verified WhatsApp number — E.164 digits without '+'. Never the NAP phone. */
  number: string;
  label?: string;
}

export default function WhatsAppCtaButton({ number, label = "Chat on WhatsApp" }: WhatsAppCtaButtonProps) {
  const digits = number.replace(/[^\d]/g, "");
  if (!digits) return null;

  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
    >
      <MessageCircle className="w-4 h-4" />
      {label}
    </a>
  );
}
