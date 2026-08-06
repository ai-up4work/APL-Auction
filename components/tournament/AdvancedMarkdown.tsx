// /components/tournament/AdvancedMarkdown.tsx
'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import mermaid from 'mermaid';

interface AdvancedMarkdownProps {
  source: string;
  className?: string;
}

// ─────────────────────────────────────────────────────────────
// NORMALIZATION — some tournament descriptions get saved without
// real line breaks (seed scripts, JSON round-trips, copy/paste
// from sources that only use \r, etc). When that happens,
// ReactMarkdown sees one giant paragraph and prints '#', '**',
// '![]()', '|...|' etc. as literal characters instead of parsing
// them. This inserts blank-line separation before block-level
// markdown constructs that aren't already at the start of a line.
//
// Safe by design: if the source already has real paragraph breaks
// (a blank line anywhere), it's left completely untouched — this
// only kicks in for the flattened/broken case.
// ─────────────────────────────────────────────────────────────
function normalizeMarkdown(text: string): string {
  if (!text) return text;

  const hasBlankLines = /\n\s*\n/.test(text);
  if (hasBlankLines) return text;

  let out = text;

  out = out
    // ATX headings: # ## ### #### ##### ######
    .replace(/([^\n])\s+(#{1,6}\s)/g, '$1\n\n$2')
    // Images: ![alt](src)
    .replace(/([^\n])\s+(!\[)/g, '$1\n\n$2')
    // Table rows / separator rows: | a | b | and |---|---|
    .replace(/([^\n])\s+(\|[^\n]*\|)/g, '$1\n$2')
    // Numbered list items: "1. text", "2. text"
    .replace(/([^\n])\s+(\d+\.\s+)/g, '$1\n$2')
    // Bulleted list items: "- text" or "* text" followed by a space
    // (requires a space after the marker to avoid false positives
    // on stray hyphens/asterisks in normal prose)
    .replace(/([^\n])\s+([-*]\s+(?:\*\*|[A-Za-z]))/g, '$1\n$2')
    // Blockquotes: "> text"
    .replace(/([^\n])\s+(>\s)/g, '$1\n\n$2')
    // Horizontal rules
    .replace(/([^\n])\s+(---+)(\s|$)/g, '$1\n\n$2$3')
    // Fenced code blocks
    .replace(/([^\n])\s+(```)/g, '$1\n\n$2');

  // Collapse any triple-plus newlines introduced above
  out = out.replace(/\n{3,}/g, '\n\n');

  return out;
}

// ─────────────────────────────────────────────────────────────
// THEME — pulled from globals.css so this component matches the
// rest of the tournament page (gold accents, dark surfaces,
// font-cinzel headings) instead of an unconfigured third-party
// token set.
// ─────────────────────────────────────────────────────────────
const gold = 'var(--color-theme-orange)';       // #c9971f
const goldBright = '#E8C468';                    // matches .scoreboard-runs accent used elsewhere on the page
const goldSoft = 'rgba(201, 151, 31, 0.3)';
const surfaceDeep = 'var(--color-surface-container-lowest)';  // #07090d
const surfaceHigh = 'var(--color-surface-container-high)';    // #1f2433
const textStrong = 'var(--color-on-surface)';                 // #e3e6ef
const textMedium = 'var(--color-on-surface-variant)';         // #c2c6d4
const textWeak = 'var(--color-outline)';                      // #8c92a3
const borderSoft = 'var(--color-border-overlay)';             // rgba(255,255,255,0.1)
const borderOutline = 'var(--color-outline-variant)';         // #3c4256

// Mermaid diagram component — themed to match the gold/dark palette
function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#c9971f',
          primaryTextColor: '#e3e6ef',
          primaryBorderColor: '#e8c468',
          lineColor: '#c9971f',
          secondaryColor: '#8a6a1a',
          tertiaryColor: '#2e2200',
          background: '#0d1117',
          mainBkg: '#0d1117',
          secondBkg: '#181d29',
          tertiaryBkg: '#2e3445',
          textColor: '#e3e6ef',
          fontSize: '16px',
          fontFamily: 'var(--font-sans, system-ui, sans-serif)'
        },
        flowchart: {
          curve: 'basis',
          padding: 20
        }
      });

      const renderDiagram = async () => {
        try {
          const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
          const { svg } = await mermaid.render(id, chart);
          if (ref.current) {
            ref.current.innerHTML = svg;
          }
        } catch (error) {
          console.error('Mermaid rendering error:', error);
          if (ref.current) {
            ref.current.innerHTML = `<pre style="color: #f87171; padding: 1rem;">Error rendering diagram: ${error}</pre>`;
          }
        }
      };

      renderDiagram();
    }
  }, [chart]);

  return (
    <div style={{
      marginBottom: '2.5rem',
      marginTop: '1.5rem',
      borderRadius: '12px',
      overflow: 'hidden',
      border: `1px solid ${goldSoft}`,
      background: surfaceDeep,
      boxShadow: `0 4px 16px rgba(201, 151, 31, 0.12)`,
      padding: '2rem'
    }}>
      <div ref={ref} style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }} />
    </div>
  );
}

// Enhanced markdown components with comprehensive styling, matching
// the tournament page's own black/50 + border-gold/20 + font-cinzel look
const markdownComponents = {
  h1: (props: any) => (
    <h1
      style={{
        fontFamily: 'var(--font-cinzel, inherit)',
        fontSize: '2rem',
        fontWeight: 700,
        color: textStrong,
        marginTop: '2.5rem',
        marginBottom: '1.25rem',
        scrollMarginTop: '100px'
      }}
      {...props}
    />
  ),
  h2: (props: any) => (
    <h2
      style={{
        fontFamily: 'var(--font-cinzel, inherit)',
        fontSize: '1.5rem',
        fontWeight: 700,
        color: gold,
        marginTop: '3rem',
        marginBottom: '1rem',
        scrollMarginTop: '100px',
        borderBottom: `2px solid ${goldSoft}`,
        paddingBottom: '0.75rem'
      }}
      {...props}
    />
  ),
  h3: (props: any) => (
    <h3
      style={{
        fontFamily: 'var(--font-cinzel, inherit)',
        fontSize: '1.25rem',
        fontWeight: 700,
        color: gold,
        marginTop: '2rem',
        marginBottom: '0.875rem',
        scrollMarginTop: '100px'
      }}
      {...props}
    />
  ),
  h4: (props: any) => (
    <h4
      style={{
        fontFamily: 'var(--font-cinzel, inherit)',
        fontSize: '1.1rem',
        fontWeight: 700,
        color: goldBright,
        marginTop: '1.75rem',
        marginBottom: '0.75rem',
        scrollMarginTop: '100px'
      }}
      {...props}
    />
  ),
  h5: (props: any) => (
    <h5
      style={{
        fontFamily: 'var(--font-cinzel, inherit)',
        fontSize: '1rem',
        fontWeight: 700,
        color: textStrong,
        marginTop: '1.5rem',
        marginBottom: '0.625rem',
        scrollMarginTop: '100px'
      }}
      {...props}
    />
  ),
  h6: (props: any) => (
    <p
      style={{
        fontFamily: 'Geist Mono, monospace',
        fontSize: '0.75rem',
        fontWeight: 700,
        marginTop: '1.25rem',
        marginBottom: '0.5rem',
        display: 'block',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: textWeak,
        scrollMarginTop: '100px'
      }}
      {...props}
    />
  ),

  p: (props: any) => (
    <p
      style={{
        marginBottom: '1.25rem',
        lineHeight: '1.8',
        color: textMedium,
        fontSize: '0.95rem'
      }}
      {...props}
    />
  ),

  a: (props: any) => (
    <a
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: gold,
        textDecoration: 'none',
        borderBottom: `2px solid transparent`,
        transition: 'all 0.2s ease',
        fontWeight: 500,
        paddingBottom: '2px'
      }}
      onMouseEnter={(e: any) => {
        e.currentTarget.style.borderBottomColor = gold;
        e.currentTarget.style.color = goldBright;
      }}
      onMouseLeave={(e: any) => {
        e.currentTarget.style.borderBottomColor = 'transparent';
        e.currentTarget.style.color = gold;
      }}
      {...props}
    />
  ),

  ul: (props: any) => (
    <ul
      style={{
        marginLeft: '1.75rem',
        marginBottom: '1.25rem',
        listStyleType: 'disc',
        color: textMedium,
        lineHeight: '1.7'
      }}
      {...props}
    />
  ),

  ol: (props: any) => (
    <ol
      style={{
        marginLeft: '1.75rem',
        marginBottom: '1.25rem',
        listStyleType: 'decimal',
        color: textMedium,
        lineHeight: '1.7'
      }}
      {...props}
    />
  ),

  li: (props: any) => (
    <li
      style={{
        marginBottom: '0.625rem',
        lineHeight: '1.7',
        paddingLeft: '0.375rem'
      }}
      {...props}
    />
  ),

  strong: (props: any) => (
    <strong
      style={{
        fontWeight: 600,
        color: textStrong
      }}
      {...props}
    />
  ),

  em: (props: any) => (
    <em
      style={{
        fontStyle: 'italic',
        color: textMedium
      }}
      {...props}
    />
  ),

  code: (props: any) => {
    const { children, className, node, ...rest } = props;
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';

    if (language === 'mermaid') {
      return <MermaidDiagram chart={String(children).trim()} />;
    }

    if (match) {
      return (
        <div style={{
          position: 'relative',
          marginBottom: '2rem',
          borderRadius: '10px',
          overflow: 'hidden',
          border: `1px solid ${borderOutline}`,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)'
        }}>
          <div style={{
            background: surfaceHigh,
            padding: '0.5rem 1rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: goldBright,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontFamily: 'Geist Mono, monospace',
            borderBottom: `1px solid ${borderSoft}`
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: gold,
              boxShadow: `0 0 8px ${gold}`
            }} />
            {language}
          </div>
          <code
            style={{
              display: 'block',
              background: surfaceDeep,
              padding: '1.5rem',
              fontSize: '0.875em',
              fontFamily: 'var(--font-code, monospace)',
              overflowX: 'auto',
              lineHeight: '1.6',
              color: textStrong,
              whiteSpace: 'pre'
            }}
            {...rest}
          >
            {children}
          </code>
        </div>
      );
    }

    return (
      <code
        style={{
          background: 'rgba(201, 151, 31, 0.1)',
          padding: '0.2rem 0.5rem',
          borderRadius: '0.375rem',
          fontSize: '0.9em',
          fontFamily: 'var(--font-code, monospace)',
          border: `1px solid ${goldSoft}`,
          color: goldBright,
          fontWeight: 500
        }}
        {...rest}
      >
        {children}
      </code>
    );
  },

  pre: (props: any) => {
    const { children, node, ...rest } = props;
    const hasCodeChild = children?.props?.className?.startsWith('language-');

    if (!hasCodeChild && typeof children === 'object' && children?.props?.children) {
      return (
        <div style={{
          position: 'relative',
          marginBottom: '2rem',
          borderRadius: '10px',
          overflow: 'hidden',
          border: `1px solid ${borderOutline}`,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)'
        }}>
          <pre
            style={{
              display: 'block',
              background: surfaceDeep,
              padding: '1.5rem',
              fontSize: '0.875em',
              fontFamily: 'var(--font-code, monospace)',
              overflowX: 'auto',
              lineHeight: '1.6',
              color: textStrong,
              margin: 0
            }}
            {...rest}
          >
            {children}
          </pre>
        </div>
      );
    }

    return <>{children}</>;
  },

  blockquote: (props: any) => (
    <blockquote
      style={{
        borderLeft: `4px solid ${gold}`,
        paddingLeft: '1.5rem',
        marginLeft: '0',
        marginRight: '0',
        marginBottom: '2rem',
        fontStyle: 'italic',
        color: textMedium,
        background: 'linear-gradient(90deg, rgba(201, 151, 31, 0.06), transparent)',
        padding: '1.25rem 1.5rem',
        borderRadius: '0.5rem'
      }}
      {...props}
    />
  ),

  hr: (props: any) => (
    <hr
      style={{
        border: 'none',
        height: '1px',
        background: `linear-gradient(90deg, transparent, ${gold}, transparent)`,
        margin: '3rem 0'
      }}
      {...props}
    />
  ),

  table: (props: any) => (
    <div style={{
      overflowX: 'auto',
      marginBottom: '2rem',
      borderRadius: '10px',
      border: `1px solid ${borderSoft}`,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
    }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse'
        }}
        {...props}
      />
    </div>
  ),

  thead: (props: any) => (
    <thead
      style={{
        background: 'linear-gradient(135deg, rgba(201, 151, 31, 0.12), rgba(201, 151, 31, 0.03))'
      }}
      {...props}
    />
  ),

  th: (props: any) => (
    <th
      style={{
        padding: '1rem 1.25rem',
        textAlign: 'left',
        borderBottom: `2px solid ${gold}`,
        fontWeight: 600,
        fontSize: '0.8rem',
        color: goldBright,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontFamily: 'var(--font-cinzel, inherit)'
      }}
      {...props}
    />
  ),

  td: (props: any) => (
    <td
      style={{
        padding: '1rem 1.25rem',
        borderBottom: `1px solid ${borderSoft}`,
        fontSize: '0.875rem',
        color: textMedium
      }}
      {...props}
    />
  ),

  tbody: (props: any) => <tbody {...props} />,

  tr: (props: any) => (
    <tr
      style={{
        transition: 'background-color 0.15s ease'
      }}
      onMouseEnter={(e: any) => {
        e.currentTarget.style.backgroundColor = 'rgba(201, 151, 31, 0.05)';
      }}
      onMouseLeave={(e: any) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      {...props}
    />
  ),

  img: (props: any) => {
    const { node, ...imgProps } = props;
    return (
      <div style={{
        marginBottom: '2.5rem',
        marginTop: '1.5rem'
      }}>
        <div style={{
          position: 'relative',
          borderRadius: '12px',
          overflow: 'hidden',
          border: `1px solid ${goldSoft}`,
          boxShadow: '0 8px 24px rgba(201, 151, 31, 0.15)',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e: any) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 12px 32px rgba(201, 151, 31, 0.25)';
        }}
        onMouseLeave={(e: any) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(201, 151, 31, 0.15)';
        }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            style={{
              width: '100%',
              height: 'auto',
              display: 'block'
            }}
            {...imgProps}
            alt={imgProps.alt || ''}
          />
        </div>
        {imgProps.alt && (
          <p style={{
            marginTop: '1rem',
            fontSize: '0.85rem',
            color: textWeak,
            fontStyle: 'italic',
            textAlign: 'center'
          }}>
            {imgProps.alt}
          </p>
        )}
      </div>
    );
  },
};

export function AdvancedMarkdown({ source, className }: AdvancedMarkdownProps) {
  const normalizedSource = normalizeMarkdown(source);

  return (
    <div
      className={className}
      style={{
        maxWidth: '85vw',
        width: '100%',
        margin: '0 auto',
        padding: '2rem'
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={markdownComponents}
      >
        {normalizedSource}
      </ReactMarkdown>
    </div>
  );
}

export default AdvancedMarkdown;