import React from 'react';
import { cn } from '@/lib/utils';
import { ContentBlock, ContentBlocks } from './content-blocks';
import { ProductVideoPlayer } from './ProductVideoPlayer';
import { getIcon } from './icon-map';

const CALLOUT_STYLES = {
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  success: 'bg-green-50 border-green-200 text-green-900',
  error: 'bg-red-50 border-red-200 text-red-900',
};

const BUTTON_VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
  outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50',
};

const PILL_VARIANTS = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800',
};

function Heading({
  level,
  className,
  children,
}: {
  level: number;
  className: string;
  children: React.ReactNode;
}) {
  const props = { className, children };
  switch (level) {
    case 1:
      return <h1 {...props} />;
    case 2:
      return <h2 {...props} />;
    case 3:
      return <h3 {...props} />;
    case 4:
      return <h4 {...props} />;
    case 5:
      return <h5 {...props} />;
    case 6:
      return <h6 {...props} />;
    default:
      return <h2 {...props} />;
  }
}

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'paragraph':
      return <p className="mb-4 text-base leading-relaxed text-gray-900">{block.text}</p>;

    case 'heading':
      return (
        <Heading level={block.level} className="mb-3 mt-6 font-semibold text-gray-900">
          {block.text}
        </Heading>
      );

    case 'bullet_list':
      return (
        <ul className="mb-4 list-disc space-y-1 pl-6 text-gray-900">
          {block.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );

    case 'numbered_list':
      return (
        <ol className="mb-4 list-decimal space-y-1 pl-6 text-gray-900">
          {block.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ol>
      );

    case 'image':
      return (
        <figure className="mb-4">
          <img src={block.src} alt={block.alt} className="max-w-full rounded-lg" />
          {block.caption && (
            <figcaption className="mt-1 text-sm text-gray-600">{block.caption}</figcaption>
          )}
        </figure>
      );

    case 'video_embed':
      return (
        <figure className="mb-4">
          <ProductVideoPlayer videoUrl={block.url} compact />
          {block.caption && (
            <figcaption className="mt-1 text-sm text-gray-600">{block.caption}</figcaption>
          )}
        </figure>
      );

    case 'button':
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('inline-block rounded-md px-4 py-2 font-medium transition-colors', BUTTON_VARIANTS[block.variant])}
        >
          {block.label}
        </a>
      );

    case 'button_pill':
      return (
        <span className={cn('inline-flex rounded-full px-3 py-1 text-sm font-medium', PILL_VARIANTS[block.variant])}>
          {block.label}
        </span>
      );

    case 'icon': {
      const Icon = getIcon(block.name);
      return <Icon className="inline-block h-5 w-5" style={{ color: block.color }} />;
    }

    case 'callout':
      return (
        <div className={cn('mb-4 rounded-lg border p-4', CALLOUT_STYLES[block.style])}>
          {block.text}
        </div>
      );

    default:
      return null;
  }
}

export function RichContentRenderer({ content }: { content: ContentBlocks }) {
  return (
    <div className="rich-content">
      {content.blocks.map((block, index) => (
        <Block key={`${block.type}-${index}`} block={block} />
      ))}
    </div>
  );
}
