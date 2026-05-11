export const WEBVIEW_TRANSLATION_CSS = `
.translation-block {
  display: block;
  color: var(--text-secondary, #666);
  font-size: 0.92em;
  line-height: 1.6;
  margin-top: 0.3em;
  margin-bottom: 0;
}
.translation-block.translating {
  opacity: 0.5;
  font-style: italic;
}
.translation-block.error {
  color: #d32f2f;
  font-style: italic;
}
.translation-blockquote {
  border-left: 2px solid var(--accent, #0066cc);
  padding-left: 0.6em;
}
.translation-h1 { font-size: 0.85em; font-weight: 600; }
.translation-h2 { font-size: 0.85em; font-weight: 600; }
.translation-h3 { font-size: 0.88em; font-weight: 500; }
.translation-h4 { font-size: 0.88em; font-weight: 500; }
.translation-h5,
.translation-h6 { font-size: 0.9em; font-weight: 500; }
.translation-li { margin-left: 0.4em; }
.translation-td,
.translation-th { margin-top: 0; margin-bottom: 0; font-size: 0.88em; }
`
