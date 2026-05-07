import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import ruby from 'highlight.js/lib/languages/ruby'
import php from 'highlight.js/lib/languages/php'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import diff from 'highlight.js/lib/languages/diff'
import ini from 'highlight.js/lib/languages/ini'
import dockerfile from 'highlight.js/lib/languages/dockerfile'

;([
  ['javascript', javascript], ['js', javascript],
  ['typescript', typescript], ['ts', typescript],
  ['python', python], ['py', python],
  ['go', go], ['rust', rust], ['java', java],
  ['cpp', cpp], ['c', cpp],
  ['csharp', csharp], ['cs', csharp],
  ['ruby', ruby], ['rb', ruby],
  ['php', php],
  ['bash', bash], ['sh', bash], ['shell', bash],
  ['sql', sql], ['json', json],
  ['xml', xml], ['html', xml], ['svg', xml],
  ['css', css],
  ['yaml', yaml], ['yml', yaml],
  ['markdown', markdown], ['md', markdown],
  ['diff', diff], ['ini', ini], ['dockerfile', dockerfile],
] as [string, ReturnType<typeof javascript>][]).forEach(([name, lang]) => {
  hljs.registerLanguage(name, lang)
})

export { hljs }
