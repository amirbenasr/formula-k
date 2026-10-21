import React from 'react'

/**
 * A deliberately small Markdown renderer for assistant replies.
 *
 * The assistant is told to answer with compact tables, bullet lists and the odd
 * code span. Pulling in a full Markdown parser (and an HTML sanitiser) for that
 * subset would add weight to the admin bundle and a second trust boundary, so
 * this renders React elements directly — there is no `dangerouslySetInnerHTML`
 * anywhere, and links are limited to http(s) and site-relative URLs.
 *
 * Supported: fenced code, headings, tables, ordered/unordered lists,
 * blockquotes, horizontal rules, bold, italic, inline code and links.
 */

// Deliberately no lookbehind: this runs in the admin bundle, and Safari only
// gained regex lookbehind in 16.4. Bold is listed before italic so `**x**` is
// consumed as bold rather than two italics.
const INLINE_TOKEN =
  /`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]+\]\([^)\s]+\)/g

const UNORDERED = /^\s*[-*+]\s+(.*)$/
const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/
const HEADING = /^(#{1,6})\s+(.*)$/
const FENCE = /^\s*```/
const RULE = /^\s*([-*_])\1{2,}\s*$/
const TABLE_ROW = /^\s*\|/
const TABLE_DIVIDER = /^\s*\|?[\s:|-]+\|?\s*$/

function isBlockStart(line: string): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    UNORDERED.test(line) ||
    ORDERED.test(line) ||
    /^\s*>/.test(line) ||
    TABLE_ROW.test(line)
  )
}

function renderInline(text: string, prefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: null | RegExpExecArray = null
  let index = 0

  INLINE_TOKEN.lastIndex = 0

  while ((match = INLINE_TOKEN.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))

    const token = match[0]
    const key = `${prefix}-${index}`

    if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
      const href = link?.[2] ?? ''
      const safe = /^(https?:\/\/|\/)/.test(href)
      const external = /^https?:\/\//.test(href)

      if (link && safe) {
        nodes.push(
          <a
            href={href}
            key={key}
            rel={external ? 'noopener noreferrer' : undefined}
            target={external ? '_blank' : undefined}
          >
            {link[1]}
          </a>,
        )
      } else {
        nodes.push(token)
      }
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>)
    }

    index += 1
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))

  return nodes
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function renderTable(rows: string[], key: string): React.ReactNode {
  const header = tableCells(rows[0] ?? '')
  const body = rows.slice(1).filter((row) => !TABLE_DIVIDER.test(row)).map(tableCells)

  return (
    <div className="ai-assistant__table-wrap" key={key}>
      <table>
        <thead>
          <tr>
            {header.map((cell, index) => (
              <th key={index}>{renderInline(cell, `${key}-h-${index}`)}</th>
            ))}
          </tr>
        </thead>
        {body.length > 0 && (
          <tbody>
            {body.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {header.map((_, cellIndex) => (
                  <td key={cellIndex}>
                    {renderInline(row[cellIndex] ?? '', `${key}-${rowIndex}-${cellIndex}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  )
}

function parseBlocks(source: string): React.ReactNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let index = 0
  let blockIndex = 0

  const nextKey = () => `md-${blockIndex++}`

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    const fence = FENCE.exec(line)
    if (fence) {
      const language = line.trim().replace(/^```/, '').trim()
      index += 1
      const code: string[] = []

      while (index < lines.length && !FENCE.test(lines[index])) {
        code.push(lines[index])
        index += 1
      }
      // Skip the closing fence when there is one.
      if (index < lines.length) index += 1

      blocks.push(
        <pre key={nextKey()}>
          <code className={language ? `language-${language}` : undefined}>{code.join('\n')}</code>
        </pre>,
      )
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      const level = heading[1].length
      const Tag = level <= 1 ? 'h2' : level === 2 ? 'h3' : 'h4'

      blocks.push(<Tag key={nextKey()}>{renderInline(heading[2], `h-${index}`)}</Tag>)
      index += 1
      continue
    }

    if (RULE.test(line)) {
      blocks.push(<hr key={nextKey()} />)
      index += 1
      continue
    }

    if (TABLE_ROW.test(line) && TABLE_DIVIDER.test(lines[index + 1] ?? '')) {
      const rows: string[] = []

      while (index < lines.length && TABLE_ROW.test(lines[index])) {
        rows.push(lines[index])
        index += 1
      }

      blocks.push(renderTable(rows, nextKey()))
      continue
    }

    if (UNORDERED.test(line)) {
      const items: string[] = []

      while (index < lines.length) {
        const item = UNORDERED.exec(lines[index])
        if (!item) break
        items.push(item[1])
        index += 1
      }

      blocks.push(
        <ul key={nextKey()}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `ul-${index}-${itemIndex}`)}</li>
          ))}
        </ul>,
      )
      continue
    }

    const ordered = ORDERED.exec(line)
    if (ordered) {
      const items: string[] = []
      let start = Number(ordered[1]) || 1

      while (index < lines.length) {
        const item = ORDERED.exec(lines[index])
        if (!item) break
        start = Math.min(start, Number(item[1]) || start)
        items.push(item[2])
        index += 1
      }

      blocks.push(
        <ol key={nextKey()} start={start === 1 ? undefined : start}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, `ol-${index}-${itemIndex}`)}</li>
          ))}
        </ol>,
      )
      continue
    }

    if (/^\s*>/.test(line)) {
      const quoted: string[] = []

      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quoted.push(lines[index].replace(/^\s*>\s?/, ''))
        index += 1
      }

      blocks.push(
        <blockquote key={nextKey()}>{renderInline(quoted.join(' '), `q-${index}`)}</blockquote>,
      )
      continue
    }

    const paragraph: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !(paragraph.length > 0 && isBlockStart(lines[index]))
    ) {
      paragraph.push(lines[index].trim())
      index += 1
    }

    blocks.push(<p key={nextKey()}>{renderInline(paragraph.join(' '), `p-${index}`)}</p>)
  }

  return blocks
}

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={['ai-assistant__markdown', className].filter(Boolean).join(' ')}>
      {parseBlocks(children)}
    </div>
  )
}
