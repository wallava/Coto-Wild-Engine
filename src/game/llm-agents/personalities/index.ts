/**
 * Catálogo de personalidades MVP Fase 5.
 * 3 personalidades distinguibles: CEO Pretender, Junior Overconfident, Intern Anxious.
 */

import type { Personality } from '../personality';
import { ceoPretender } from './ceo-pretender';
import { juniorOverconfident } from './junior-overconfident';
import { internAnxious } from './intern-anxious';

export { ceoPretender, juniorOverconfident, internAnxious };

export const ALL_PERSONALITIES: Personality[] = [
  ceoPretender,
  juniorOverconfident,
  internAnxious,
];

export function getPersonalityById(id: string): Personality | undefined {
  return ALL_PERSONALITIES.find((p) => p.id === id);
}
