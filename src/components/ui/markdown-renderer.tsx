'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { cn } from '@/lib/utils';

// Import highlight.js CSS for syntax highlighting
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        'markdown-content prose prose-invert max-w-none',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom styling for links
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target='_blank'
              rel='noopener noreferrer'
              className='text-blue-400 hover:text-blue-300 underline transition-colors break-words'
              {...props}
            >
              {children}
            </a>
          ),
          // Custom styling for headers
          h1: ({ children, ...props }) => (
            <h1
              className='text-xl sm:text-2xl font-bold text-white mb-2 mt-4 first:mt-0'
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2
              className='text-lg sm:text-xl font-bold text-white mb-2 mt-4 first:mt-0'
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              className='text-base sm:text-lg font-bold text-white mb-2 mt-4 first:mt-0'
              {...props}
            >
              {children}
            </h3>
          ),
          // Custom styling for code blocks
          code: ({ inline, children, ...props }: any) => {
            if (inline) {
              return (
                <code
                  className='bg-gray-700/60 text-gray-200 px-1.5 py-0.5 rounded text-sm font-mono border border-gray-600/30'
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className='block bg-gray-800/60 text-gray-200 p-3 rounded-lg text-sm font-mono border border-gray-600/30 overflow-x-auto'
                {...props}
              >
                {children}
              </code>
            );
          },
          // Custom styling for bold text
          strong: ({ children, ...props }) => (
            <strong className='font-bold text-white' {...props}>
              {children}
            </strong>
          ),
          // Custom styling for italic text
          em: ({ children, ...props }) => (
            <em className='italic text-gray-200' {...props}>
              {children}
            </em>
          ),
          // Custom styling for paragraphs
          p: ({ children, ...props }) => (
            <p className='text-gray-200 mb-2 last:mb-0' {...props}>
              {children}
            </p>
          ),
          // Custom styling for lists
          ul: ({ children, ...props }) => (
            <ul
              className='list-disc list-inside text-gray-200 mb-2 space-y-1'
              {...props}
            >
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol
              className='list-decimal list-inside text-gray-200 mb-2 space-y-1'
              {...props}
            >
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className='text-gray-200' {...props}>
              {children}
            </li>
          ),
          // Custom styling for blockquotes
          blockquote: ({ children, ...props }) => (
            <blockquote
              className='border-l-4 border-blue-400/50 pl-4 italic text-gray-300 bg-gray-800/30 py-2 rounded-r'
              {...props}
            >
              {children}
            </blockquote>
          ),
          // Remove default margins from pre elements
          pre: ({ children, ...props }) => (
            <pre
              className='bg-gray-800/60 p-3 rounded-lg overflow-x-auto border border-gray-600/30'
              {...props}
            >
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
