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

const CALLOUT_TEXT_SIZES = {
  paragraph: 'text-base',
  h1: 'text-3xl font-semibold',
  h2: 'text-2xl font-semibold',
  h3: 'text-xl font-semibold',
};

const BUTTON_VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
  outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50',
  gradient: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600',
};

const PILL_VARIANTS = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800',
  gradient: 'bg-gradient-to-r from-green-400 to-blue-500 text-white',
};

function IconNode({ name, color }: { name?: string; color?: string }) {
  const Icon = getIcon(name ?? 'help');
  return <Icon className="inline-block h-5 w-5 align-middle" style={{ color: color || undefined }} />;
}

function StyledSpan({ node }: { node: any }) {
  const text = node.text ?? '';
  const style: React.CSSProperties = {};
  if (node.styles?.textColor) style.color = node.styles.textColor;
  if (node.styles?.backgroundColor) style.backgroundColor = node.styles.backgroundColor;
  let children: React.ReactNode = text;
  if (node.styles?.bold) children = <strong>{children}</strong>;
  if (node.styles?.italic) children = <em>{children}</em>;
  if (node.styles?.underline) children = <u>{children}</u>;
  if (node.styles?.strike) children = <s>{children}</s>;
  if (node.styles?.code) children = <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">{children}</code>;
  if (node.styles?.link) {
    children = (
      <a href={node.styles.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
        {children}
      </a>
    );
  }
  return <span style={style}>{children}</span>;
}

function RichInlineContent({ content }: { content?: unknown[] }) {
  return (
    <>
      {(content ?? []).map((node, i) => {
        if (typeof node === 'string') return <span key={i}>{node}</span>;
        const n = node as any;
        if (n?.type === 'icon') return <IconNode key={i} name={n.props?.name} color={n.props?.color} />;
        return <StyledSpan key={i} node={n} />;
      })}
    </>
  );
}

function RichText({ text }: { text: string }) {
  if (!text) return null;
  const nodes: React.ReactNode[] = [];
  const regex = /\{\{icon:([^:{}]+)(?::([^:{}]*))?\}\}/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    const Icon = getIcon(match[1]);
    nodes.push(<Icon key={key++} className="inline-block h-5 w-5 align-middle" style={{ color: match[2] || undefined }} />);
    last = regex.lastIndex;
  }
  if (last < text.length) nodes.push(<span key={key++}>{text.slice(last)}</span>);
  return <>{nodes}</>;
}

function Heading({
  level,
  className,
  children,
  style,
}: {
  level: number;
  className: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const props = { className, children, style };
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
      return <p className="mb-4 text-base leading-relaxed text-gray-900" style={{ textAlign: block.textAlign }}><RichText text={block.text} /></p>;

    case 'heading':
      return (
        <Heading level={block.level} className="mb-3 mt-6 font-semibold text-gray-900" style={{ textAlign: block.textAlign }}>
          <RichText text={block.text} />
        </Heading>
      );

    case 'bullet_list':
      return (
        <ul className="mb-4 list-disc space-y-1 pl-6 text-gray-900" style={{ textAlign: block.textAlign }}>
          {block.items.map((item, index) => (
            <li key={index}><RichText text={item} /></li>
          ))}
        </ul>
      );

    case 'numbered_list':
      return (
        <ol className="mb-4 list-decimal space-y-1 pl-6 text-gray-900" style={{ textAlign: block.textAlign }}>
          {block.items.map((item, index) => (
            <li key={index}><RichText text={item} /></li>
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

    case 'button': {
      const sizeClasses = {
        small: 'text-sm px-2 py-1',
        medium: 'text-base px-4 py-2',
        large: 'text-lg px-6 py-3',
      };
      return (
        <div style={{ textAlign: block.textAlign }}>
          <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-block rounded-md font-medium transition-colors', sizeClasses[block.size || 'medium'], BUTTON_VARIANTS[block.variant])}
            style={{ color: block.foregroundColor, backgroundColor: block.backgroundColor }}
          >
            {block.label}
          </a>
        </div>
      );
    }

    case 'icon_button': {
      const sizeClasses = {
        small: 'text-sm px-2 py-1',
        medium: 'text-base px-4 py-2',
        large: 'text-lg px-6 py-3',
      };
      const Icon = getIcon(block.icon);
      return (
        <div style={{ textAlign: block.textAlign }}>
          <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex items-center gap-2 rounded-md font-medium transition-colors', sizeClasses[block.size || 'medium'], BUTTON_VARIANTS[block.variant])}
            style={{ color: block.foregroundColor, backgroundColor: block.backgroundColor }}
          >
            <Icon className="h-4 w-4" />
            {block.label}
          </a>
        </div>
      );
    }

    case 'button_pill':
      return (
        <div style={{ textAlign: block.textAlign }}>
          <span
            className={cn('inline-flex rounded-full px-3 py-1 text-sm font-medium', PILL_VARIANTS[block.variant])}
            style={{ color: block.foregroundColor, backgroundColor: block.backgroundColor }}
          >
            {block.label}
          </span>
        </div>
      );

    case 'icon': {
      const Icon = getIcon(block.name);
      return <Icon className="inline-block h-5 w-5" style={{ color: block.color }} />;
    }

    case 'callout':
      return (
        <div
          className={cn('mb-4 rounded-lg border p-4', CALLOUT_STYLES[block.style], CALLOUT_TEXT_SIZES[block.textSize || 'paragraph'])}
          style={{ textAlign: block.textAlign, color: block.foregroundColor, backgroundColor: block.backgroundColor }}
        >
          <RichText text={block.text} />
        </div>
      );

    case 'side_by_side': {
      const image = <img src={block.imageSrc} alt={block.imageAlt} className="w-1/3 rounded-md object-cover" />;
      const text = (
        <div className="flex-1" style={{ textAlign: block.textAlign }}>
          {block.content ? <RichInlineContent content={block.content} /> : <RichText text={block.text || ''} />}
        </div>
      );
      return (
        <div className="mb-4 flex items-start gap-4">
          {block.imagePosition === 'left' ? (
            <>
              {image}
              {text}
            </>
          ) : (
            <>
              {text}
              {image}
            </>
          )}
        </div>
      );
    }

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
