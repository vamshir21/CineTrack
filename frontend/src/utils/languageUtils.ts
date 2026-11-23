/**
 * Language utilities and badge color definitions for movies and TV series.
 */

export function getLanguageBadgeStyle(language: string): { bg: string; text: string; border: string } {
  const lower = language.toLowerCase();

  switch (lower) {
    case 'hindi':
      return {
        bg: 'bg-orange-950/70',
        text: 'text-orange-300',
        border: 'border-orange-700/50',
      };
    case 'telugu':
      return {
        bg: 'bg-emerald-950/70',
        text: 'text-emerald-300',
        border: 'border-emerald-700/50',
      };
    case 'tamil':
      return {
        bg: 'bg-amber-950/70',
        text: 'text-amber-300',
        border: 'border-amber-700/50',
      };
    case 'kannada':
    case 'malayalam':
      return {
        bg: 'bg-teal-950/70',
        text: 'text-teal-300',
        border: 'border-teal-700/50',
      };
    case 'english':
      return {
        bg: 'bg-blue-950/70',
        text: 'text-blue-300',
        border: 'border-blue-700/50',
      };
    case 'korean':
    case 'japanese':
      return {
        bg: 'bg-rose-950/70',
        text: 'text-rose-300',
        border: 'border-rose-700/50',
      };
    case 'spanish':
    case 'french':
    case 'german':
    case 'italian':
      return {
        bg: 'bg-purple-950/70',
        text: 'text-purple-300',
        border: 'border-purple-700/50',
      };
    default:
      return {
        bg: 'bg-neutral-800',
        text: 'text-neutral-300',
        border: 'border-neutral-700',
      };
  }
}

export function formatLanguageList(languages?: string[]): string {
  if (!languages || languages.length === 0) return 'English';
  return languages.join(' • ');
}
