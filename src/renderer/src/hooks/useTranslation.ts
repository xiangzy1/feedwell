import { useEffect, useRef } from 'react'
import { useTranslationSettings } from './useTranslationSettings'

const TRANSLATABLE_TAGS = new Set(['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'TD', 'TH', 'FIGCAPTION', 'DD', 'DT'])

function collectTexts(el: HTMLElement): { element: HTMLElement; text: string }[] {
  const results: { element: HTMLElement; text: string }[] = []
  const walk = (node: Element) => {
    if (TRANSLATABLE_TAGS.has(node.tagName)) {
      const text = node.textContent?.trim()
      if (text && text.length > 0) {
        results.push({ element: node as HTMLElement, text })
      }
      return
    }
    for (const child of node.children) {
      walk(child)
    }
  }
  walk(el)
  return results
}

export function useTranslation(
  contentRef: React.RefObject<HTMLDivElement | null>,
  articleId: number | undefined,
  enabled: boolean,
  contentVersion: number
): { isTranslating: boolean; error: string | null } {
  const { settings } = useTranslationSettings()
  const isTranslatingRef = useRef(false)
  const errorRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    isTranslatingRef.current = false
    errorRef.current = null
  }, [articleId])

  useEffect(() => {
    if (enabled) return
    const el = contentRef.current
    if (!el) return
    el.querySelectorAll('.translation-block').forEach(b => b.remove())
    isTranslatingRef.current = false
    errorRef.current = null
  }, [enabled, contentRef])

  // Insert translation blocks
  useEffect(() => {
    if (!enabled || !articleId || settings.provider === 'disabled' || !contentVersion) return

    const el = contentRef.current
    if (!el) return

    const requestId = ++requestIdRef.current
    isTranslatingRef.current = true
    errorRef.current = null

    el.querySelectorAll('.translation-block').forEach(b => b.remove())

    const texts = collectTexts(el)
    if (texts.length === 0) {
      isTranslatingRef.current = false
      return
    }

    // Insert placeholders
    const placeholders: HTMLDivElement[] = []
    const tagClasses: string[] = []
    for (const { element } of texts) {
      const tag = element.tagName.toLowerCase()
      const block = document.createElement('div')
      block.className = `translation-block translation-${tag} translating`
      block.textContent = 'Translating...'
      element.after(block)
      placeholders.push(block)
      tagClasses.push(tag)
    }

    const doTranslate = async () => {
      const off = window.api.translation.onTranslationChunk(({ articleId: aid, index, translated }) => {
        if (aid !== articleId || requestIdRef.current !== requestId) return
        const block = placeholders[index]
        if (block?.isConnected) {
          block.className = `translation-block translation-${tagClasses[index]}`
          block.textContent = translated
        }
      })

      try {
        const results = await window.api.translation.translate(
          articleId,
          texts.map(t => t.text)
        )

        if (requestIdRef.current !== requestId) return

        // Final sweep for any remaining placeholders
        for (let i = 0; i < placeholders.length; i++) {
          const block = placeholders[i]
          if (block.isConnected) {
            block.className = `translation-block translation-${tagClasses[i]}`
            block.textContent = results[i] || ''
          }
        }
        isTranslatingRef.current = false
      } catch (err) {
        if (requestIdRef.current !== requestId) return
        const message = err instanceof Error ? err.message : 'Translation failed'
        for (let i = 0; i < placeholders.length; i++) {
          const block = placeholders[i]
          if (block.isConnected) {
            block.className = `translation-block translation-${tagClasses[i]} error`
            block.textContent = message
          }
        }
        errorRef.current = message
        isTranslatingRef.current = false
      } finally {
        off()
      }
    }

    doTranslate()

    return () => {
      if (requestIdRef.current === requestId) {
        requestIdRef.current++
      }
    }
  }, [enabled, articleId, settings.provider, settings.targetLang, contentVersion, contentRef])

  return { isTranslating: isTranslatingRef.current, error: errorRef.current }
}
