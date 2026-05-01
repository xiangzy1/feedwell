import { getDb } from '../db'

export async function importOpml(xmlString: string): Promise<{ imported: number; failed: number }> {
  let imported = 0
  let failed = 0

  const folderStack: { id: number | null; name: string }[] = [{ id: null, name: '' }]
  const tagRegex = /<\/?outline[^>]*>/g
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(xmlString)) !== null) {
    const tag = match[0]

    if (tag.startsWith('</')) {
      if (folderStack.length > 1) folderStack.pop()
      continue
    }

    const isSelfClosing = tag.endsWith('/>')
    const xmlUrl = tag.match(/xmlUrl=["']([^"']+)["']/)?.[1]

    if (xmlUrl) {
      const title = tag.match(/title=["']([^"']+)["']/)?.[1]
        || tag.match(/text=["']([^"']+)["']/)?.[1]
        || xmlUrl
      const category = tag.match(/category=["']([^"']+)["']/)?.[1]
      const folderId = category ? getOrCreateFolder(category) : folderStack[folderStack.length - 1].id

      try {
        const existing = getDb().prepare('SELECT id FROM feeds WHERE url = ?').get(xmlUrl) as { id: number } | undefined
        if (existing) {
          if (folderId) {
            getDb().prepare('UPDATE feeds SET folder_id = ? WHERE id = ? AND folder_id IS NULL').run(folderId, existing.id)
          }
        } else {
          getDb().prepare('INSERT INTO feeds (title, url, folder_id) VALUES (?, ?, ?)').run(title, xmlUrl, folderId)
          imported++
        }
      } catch {
        failed++
      }
    } else {
      const title = tag.match(/title=["']([^"']+)["']/)?.[1]
        || tag.match(/text=["']([^"']+)["']/)?.[1]
      if (title) {
        const folderId = getOrCreateFolder(title)
        if (!isSelfClosing) {
          folderStack.push({ id: folderId, name: title })
        }
      }
    }
  }

  return { imported, failed }
}

function getOrCreateFolder(name: string): number {
  const existing = getDb().prepare('SELECT id FROM folders WHERE name = ?').get(name) as { id: number } | undefined
  if (existing) return existing.id
  const info = getDb().prepare('INSERT INTO folders (name) VALUES (?)').run(name)
  return info.lastInsertRowid as number
}

export function exportOpml(): string {
  const feeds = getDb().prepare(`
    SELECT f.*, fo.name as folder_name FROM feeds f
    LEFT JOIN folders fo ON fo.id = f.folder_id
    ORDER BY fo.name, f.title
  `).all() as any[]

  const grouped = new Map<string, any[]>()
  const ungrouped: any[] = []
  for (const feed of feeds) {
    if (feed.folder_name) {
      if (!grouped.has(feed.folder_name)) grouped.set(feed.folder_name, [])
      grouped.get(feed.folder_name)!.push(feed)
    } else {
      ungrouped.push(feed)
    }
  }

  const lines: string[] = []
  for (const [folderName, folderFeeds] of grouped) {
    lines.push(`    <outline text="${escapeXml(folderName)}">`)
    for (const feed of folderFeeds) {
      lines.push(`      ${feedOutline(feed)}`)
    }
    lines.push('    </outline>')
  }
  for (const feed of ungrouped) {
    lines.push(`    ${feedOutline(feed)}`)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>Feedwell Subscriptions</title>
  </head>
  <body>
${lines.join('\n')}
  </body>
</opml>`
}

function feedOutline(feed: any): string {
  const attrs = [`type="rss"`, `text="${escapeXml(feed.title)}"`, `title="${escapeXml(feed.title)}"`, `xmlUrl="${escapeXml(feed.url)}"`]
  if (feed.site_url) attrs.push(`htmlUrl="${escapeXml(feed.site_url)}"`)
  return `<outline ${attrs.join(' ')} />`
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
