import { z } from 'zod';

export const paragraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string(),
});

export const headingBlockSchema = z.object({
  type: z.literal('heading'),
  level: z.number().int().min(1).max(6),
  text: z.string(),
});

export const bulletListBlockSchema = z.object({
  type: z.literal('bullet_list'),
  items: z.array(z.string()),
});

export const numberedListBlockSchema = z.object({
  type: z.literal('numbered_list'),
  items: z.array(z.string()),
});

export const imageBlockSchema = z.object({
  type: z.literal('image'),
  src: z.string().min(1),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export const videoEmbedBlockSchema = z.object({
  type: z.literal('video_embed'),
  url: z.string().min(1),
  caption: z.string().optional(),
});

export const buttonBlockSchema = z.object({
  type: z.literal('button'),
  label: z.string().min(1),
  url: z.string().min(1),
  variant: z.enum(['primary', 'secondary', 'outline']).default('primary'),
});

export const buttonPillBlockSchema = z.object({
  type: z.literal('button_pill'),
  label: z.string().min(1),
  variant: z.enum(['success', 'warning', 'info', 'neutral']).default('info'),
});

export const iconBlockSchema = z.object({
  type: z.literal('icon'),
  name: z.string().min(1),
  color: z.string().optional(),
});

export const calloutBlockSchema = z.object({
  type: z.literal('callout'),
  style: z.enum(['info', 'warning', 'success', 'error']).default('info'),
  text: z.string().min(1),
});

export const contentBlockSchema = z.union([
  paragraphBlockSchema,
  headingBlockSchema,
  bulletListBlockSchema,
  numberedListBlockSchema,
  imageBlockSchema,
  videoEmbedBlockSchema,
  buttonBlockSchema,
  buttonPillBlockSchema,
  iconBlockSchema,
  calloutBlockSchema,
]);

export const contentBlocksSchema = z.object({
  version: z.literal('1'),
  blocks: z.array(contentBlockSchema).max(50),
});

export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type ContentBlocks = z.infer<typeof contentBlocksSchema>;

export const DEFAULT_CONTENT_BLOCKS: ContentBlocks = {
  version: '1',
  blocks: [],
};

export const SAMPLE_CONTENT_BLOCKS: ContentBlocks = {
  version: '1',
  blocks: [
    { type: 'paragraph', text: 'An introduction to this digital product.' },
    { type: 'heading', level: 2, text: 'What you get' },
    { type: 'bullet_list', items: ['Instant download', 'Lifetime updates', 'Community access'] },
    { type: 'numbered_list', items: ['Purchase', 'Download', 'Enjoy'] },
    { type: 'image', src: 'https://placehold.co/800x400', alt: 'Product preview', caption: 'Preview image' },
    { type: 'video_embed', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', caption: 'Watch the trailer' },
    { type: 'button', label: 'Buy now', url: 'https://example.com/checkout', variant: 'primary' },
    { type: 'button_pill', label: 'Best seller', variant: 'success' },
    { type: 'icon', name: 'check', color: '#22c55e' },
    { type: 'callout', style: 'info', text: 'Includes 30-day money-back guarantee.' },
  ],
};
