export function htmlToPlainText(html: string): string {
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function escapeMdInline(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function escapeMdBlock(s: string): string {
  return s
    .split('\n')
    .map((line) => line.replace(/^(\s*)([#>])/g, '$1\\$2'))
    .join('\n');
}

function normalizeSegmentSummary(raw: string): string {
  return raw.replace(/^\s*[▼▾▿]\s*/u, '').replace(/\s+/g, ' ').trim();
}

function mdLinkDestination(href: string): string {
  if (/[()\s]/.test(href)) {
    return `<${href.replace(/\\/g, '\\\\').replace(/</g, '\\<').replace(/>/g, '\\>')}>`;
  }
  return href;
}

function inlineMarkdownFromElement(el: Element): string {
  let out = '';
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += escapeMdInline(child.textContent ?? '');
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const c = child as Element;
      const t = c.tagName.toLowerCase();
      if (t === 'strong' || t === 'b') {
        out += `**${escapeMdInline(c.textContent ?? '')}**`;
      } else if (t === 'em' || t === 'i') {
        out += `*${escapeMdInline(c.textContent ?? '')}*`;
      } else if (t === 'br') {
        out += '  \n';
      } else if (t === 'code') {
        out += `\`${escapeMdInline(c.textContent ?? '')}\``;
      } else if (t === 'a') {
        const href = (c.getAttribute('href') ?? '').trim();
        const label = inlineMarkdownFromElement(c);
        if (!href || /^javascript:/i.test(href)) {
          out += label;
        } else {
          out += `[${label}](${mdLinkDestination(href)})`;
        }
      } else {
        out += inlineMarkdownFromElement(c);
      }
    }
  }
  return out.trim();
}

function dialogueTurnBodyMarkdown(turn: Element): string {
  const textEl = turn.querySelector('.turn-text');
  if (textEl) {
    return inlineMarkdownFromElement(textEl);
  }
  const chunks: string[] = [];
  for (const child of turn.children) {
    if (child.classList.contains('speaker-label') || child.classList.contains('turn-time')) {
      continue;
    }
    const piece = inlineMarkdownFromElement(child);
    if (piece) chunks.push(piece);
  }
  return chunks.join('\n\n');
}

function headingLine(prefix: string, text: string): string {
  const t = normalizeSegmentSummary(text);
  if (!t) return '';
  return `${prefix} ${escapeMdInline(t)}\n\n`;
}

/** Convert streamed article HTML (see prompt.ts) to Markdown. */
export function htmlToMarkdown(html: string): string {
  if (typeof window === 'undefined') {
    const stripped = html.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n').trim();
    if (!stripped) return '';
    return escapeMdBlock(escapeMdInline(stripped.replace(/\n/g, ' ')));
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const parts: string[] = [];

  function walkChildren(parent: Element | DocumentFragment): void {
    for (const child of parent.childNodes) {
      walk(child);
    }
  }

  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === 'h1') {
      const line = headingLine('#', el.textContent ?? '');
      if (line) parts.push(line);
      return;
    }
    if (tag === 'h2') {
      const line = headingLine('##', el.textContent ?? '');
      if (line) parts.push(line);
      return;
    }
    const isArticleSegment =
      tag === 'details' &&
      (el.classList.contains('article-segment') ||
        el.querySelector(':scope > summary.article-segment-title') !== null);
    if (isArticleSegment) {
      const summary = el.querySelector(':scope > summary.article-segment-title');
      const body = el.querySelector(':scope > .article-segment-body');
      const title = normalizeSegmentSummary(summary?.textContent ?? '');
      if (title) {
        parts.push(`### ${escapeMdInline(title)}\n\n`);
      }
      if (body) {
        walkChildren(body);
      } else {
        for (const child of el.children) {
          if (child.tagName.toLowerCase() === 'summary') continue;
          walk(child);
        }
      }
      return;
    }
    if (tag === 'div' && el.classList.contains('dialogue-turn')) {
      const speaker = el.querySelector('.speaker-label')?.textContent?.trim() ?? '';
      const time = el.querySelector('.turn-time')?.textContent?.trim() ?? '';
      const bodyRaw = dialogueTurnBodyMarkdown(el);
      const body = bodyRaw ? escapeMdBlock(bodyRaw) : '';
      const meta: string[] = [];
      if (speaker) meta.push(`**${escapeMdInline(speaker)}**`);
      if (time) meta.push(`\`${escapeMdInline(time)}\``);
      const head = meta.join(' ');
      parts.push(head ? `${head}\n\n${body}\n\n` : `${body}\n\n`);
      return;
    }

    walkChildren(el);
  }

  walkChildren(doc.body);
  return parts.join('').trim();
}

export function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
