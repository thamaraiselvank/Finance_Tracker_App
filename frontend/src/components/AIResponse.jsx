import React from 'react';

function InlineText({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`)/g);
  return parts.filter(Boolean).map((part, index) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="ai-inline-code">{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={index}>{part.replace(/\*+/g, '')}</React.Fragment>;
  });
}

function normalizeMarkdown(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\s*---+\s*/g, '\n')
    .replace(/([^\n])\s+(?=#{1,3}\s)/g, '$1\n')
    .replace(/([^\n])\s+(?=(?:\*\*)?(?:\d+[.)]\s+|[-*•]\s+|\*\*[^*\n]{1,60}:\*\*))/g, '$1\n')
    .trim();
}

function isTableSeparator(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

export default function AIResponse({ text }) {
  const lines = normalizeMarkdown(text).split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }

    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const headers = line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().includes('|')) {
        rows.push(lines[index].trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
        index += 1;
      }
      blocks.push(
        <div className="ai-response-table-wrap" key={`table-${index}`}>
          <table className="ai-response-table">
            <thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex}><InlineText text={cell} /></th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex}><InlineText text={row[cellIndex] || ''} /></td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push(<h4 className="ai-response-heading" key={`heading-${index}`}><InlineText text={heading[2]} /></h4>);
      index += 1;
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*•]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*•]\s+/, '').trim());
        index += 1;
      }
      blocks.push(<ul className="ai-response-list" key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}><InlineText text={item} /></li>)}</ul>);
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+[.)]\s+/, '').trim());
        index += 1;
      }
      blocks.push(<ol className="ai-response-list" key={`ordered-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex}><InlineText text={item} /></li>)}</ol>);
      continue;
    }

    if (/^\*\*[^*]{1,60}:\*\*/.test(line)) {
      blocks.push(<p className="ai-response-label-line" key={`label-${index}`}><InlineText text={line} /></p>);
      index += 1;
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() &&
      !/^#{1,3}\s|^[-*•]\s+|^\d+[.)]\s+|^\*\*[^*]{1,60}:\*\*/.test(lines[index].trim()) &&
      !(lines[index].includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1]))) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p className="ai-response-paragraph" key={`paragraph-${index}`}><InlineText text={paragraph.join(' ')} /></p>);
  }

  return <div className="ai-response-content">{blocks}</div>;
}
