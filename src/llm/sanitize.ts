/**
 * sanitize.ts
 *
 * Utilidades de sanitización para contenido del mundo antes de incluirlo en prompts LLM.
 * El contenido del mundo nunca entra como autoridad de system prompt — va dentro de
 * <world_context>...</world_context> tags. Solo escapes estructurales deterministas;
 * sin heurísticas de detección de patrones de prompt injection.
 */

const DEFAULT_MAX_LEN = 100;

/**
 * Sanitiza string del mundo para inclusión segura en prompts:
 * - Escape backticks (`) → ' (apostrofe simple).
 * - Escape comillas dobles (") → ' (apostrofe simple).
 * - Escape newlines (\n, \r) → espacio.
 * - Escape `<world_context>` y `</world_context>` literales para prevenir spoofing del wrapper.
 * - Length limit (default 100). Trunca con '...'.
 */
export function sanitizeWorldString(s: string, maxLen: number = DEFAULT_MAX_LEN): string {
  if (typeof s !== 'string') return '';
  let out = s;
  // Escape backticks y comillas dobles → apostrofe simple
  out = out.replace(/`/g, "'");
  out = out.replace(/"/g, "'");
  // Newlines → espacio
  out = out.replace(/\r\n|\r|\n/g, ' ');
  // Escape el wrapper literal para prevenir spoofing
  out = out.replace(/<world_context>/gi, '&lt;world_context&gt;');
  out = out.replace(/<\/world_context>/gi, '&lt;/world_context&gt;');
  // Length limit
  if (out.length > maxLen) {
    out = out.slice(0, Math.max(0, maxLen - 3)) + '...';
  }
  return out;
}

/**
 * Wrap string en `<world_context>...</world_context>` para inclusión segura.
 * Asume que el contenido YA fue sanitizado con sanitizeWorldString.
 */
export function wrapWorldContext(content: string): string {
  return `<world_context>\n${content}\n</world_context>`;
}
