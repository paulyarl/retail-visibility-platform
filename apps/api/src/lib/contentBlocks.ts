import { z } from 'zod';

export const paragraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const headingBlockSchema = z.object({
  type: z.literal('heading'),
  level: z.number().int().min(1).max(6),
  text: z.string(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const bulletListBlockSchema = z.object({
  type: z.literal('bullet_list'),
  items: z.array(z.string()),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const numberedListBlockSchema = z.object({
  type: z.literal('numbered_list'),
  items: z.array(z.string()),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
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
  variant: z.enum(['primary', 'secondary', 'outline', 'gradient']).default('primary'),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
  foregroundColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const buttonPillBlockSchema = z.object({
  type: z.literal('button_pill'),
  label: z.string().min(1),
  variant: z.enum(['success', 'warning', 'info', 'neutral', 'gradient']).default('info'),
  foregroundColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const iconButtonBlockSchema = z.object({
  type: z.literal('icon_button'),
  icon: z.string().min(1),
  label: z.string().min(1),
  url: z.string().min(1),
  variant: z.enum(['primary', 'secondary', 'outline', 'gradient']).default('primary'),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
  foregroundColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
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
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  foregroundColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textSize: z.enum(['paragraph', 'h1', 'h2', 'h3']).optional(),
});

export const sideBySideBlockSchema = z.object({
  type: z.literal('side_by_side'),
  imagePosition: z.enum(['left', 'right']).default('left'),
  imageSrc: z.string(),
  imageAlt: z.string().optional(),
  text: z.string().optional(),
  content: z.array(z.unknown()).optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
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
  iconButtonBlockSchema,
  iconBlockSchema,
  calloutBlockSchema,
  sideBySideBlockSchema,
]);

export const contentBlocksSchema = z.object({
  version: z.literal('1'),
  blocks: z.array(contentBlockSchema).max(50),
});

export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type ContentBlocks = z.infer<typeof contentBlocksSchema>;

export function validateContentBlocks(value: unknown): ContentBlocks | null {
  const parsed = contentBlocksSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function collectTextFromValue(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectTextFromValue);
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectTextFromValue);
  }
  return [];
}

export function contentBlocksToPlainText(content: ContentBlocks): string {
  const parts = content.blocks.flatMap(block => collectTextFromValue(block));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
