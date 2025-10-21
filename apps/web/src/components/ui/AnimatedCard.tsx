"use client";

import React from 'react';
import { motion } from 'framer-motion';

export interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
  onClick?: () => void;
}

export function AnimatedCard({
  children,
  className = '',
  delay = 0,
  hover = true,
  onClick,
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={hover ? { y: -4, transition: { duration: 0.2 } } : undefined}
      onClick={onClick}
      className={`bg-white rounded-lg border border-neutral-200 ${hover ? 'hover:shadow-lg transition-shadow' : ''} ${className}`}
    >
      {children}
    </motion.div>
  );
}
