import type { ReactNode } from 'react'

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={key++}
          className="font-mono-ledger rounded px-1 py-0.5 text-[12px]"
          style={{ backgroundColor: 'var(--bg-subtle)' }}
        >
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)
      if (linkMatch) {
        parts.push(
          <a
            key={key++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: 'var(--accent)' }}
          >
            {linkMatch[1]}
          </a>,
        )
      } else {
        parts.push(token)
      }
    }
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

export function MarkdownText({ content }: { content: string }) {
  const lines = content.split(/\r?\n/)
  const elements: ReactNode[] = []
  let listItems: string[] = []
  let key = 0

  const flushList = () => {
    if (listItems.length === 0) return
    elements.push(
      <ul key={key++} className="my-1.5 list-disc space-y-1 pl-5 text-[13px]">
        {listItems.map((item, idx) => (
          <li key={idx}>{renderInline(item)}</li>
        ))}
      </ul>,
    )
    listItems = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^[-*]\s+/.test(line)) {
      listItems.push(line.replace(/^[-*]\s+/, ''))
      continue
    }
    flushList()
    if (!line.trim()) continue
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={key++} className="mt-2 text-[13px] font-semibold">
          {renderInline(line.slice(4))}
        </h4>,
      )
    } else if (line.startsWith('## ')) {
      elements.push(
        <h3 key={key++} className="mt-2 text-[14px] font-semibold">
          {renderInline(line.slice(3))}
        </h3>,
      )
    } else {
      elements.push(
        <p key={key++} className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
          {renderInline(line)}
        </p>,
      )
    }
  }
  flushList()

  if (elements.length === 0) {
    return (
      <p className="text-[13px] italic" style={{ color: 'var(--ink-muted)' }}>
        No notes recorded.
      </p>
    )
  }

  return <div className="space-y-1">{elements}</div>
}
