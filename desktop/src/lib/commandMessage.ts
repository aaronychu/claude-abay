function decodeXmlText(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function extractXmlTag(text: string, tag: string): string | undefined {
  const match = text.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  const value = match?.[1]?.trim()
  return value ? decodeXmlText(value) : undefined
}

export function formatCommandMessageContent(raw: string): string {
  const commandName = extractXmlTag(raw, 'command-name')
  if (!commandName) return raw

  const commandArgs = extractXmlTag(raw, 'command-args')
  return [commandName, commandArgs].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}
