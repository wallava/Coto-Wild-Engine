/**
 * Constantes centralizadas de localStorage keys de la capa LLM.
 * NUNCA hardcodear strings en otros archivos. Importar siempre desde acá.
 */
export const LLM_STORAGE_KEYS = {
  apiKey: 'cwe_llm_apikey',
  killswitch: 'cwe_llm_killswitch',
  sessionCap: 'cwe_llm_session_cap',
} as const;
