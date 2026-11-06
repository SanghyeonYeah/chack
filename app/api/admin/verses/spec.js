import { bool, int, text } from '@/lib/server/fields';

export const verseSpec = {
  text: (v) => text(v, 1000),
  source: (v) => text(v, 100),
  is_visible: bool,
  sort_order: (v) => int(v) ?? 0,
};
