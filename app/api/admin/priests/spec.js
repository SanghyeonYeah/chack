import { HttpError } from '@/lib/server/http';
import { bool, int, text } from '@/lib/server/fields';

export const priestSpec = {
  name: (v) => text(v, 50),
  baptismal_name: (v) => text(v, 50),
  role_title: (v) => text(v, 50),
  photo_url: (v) => text(v, 500),
  greeting: (v) => {
    const s = text(v, 1000);
    if (s && [...s].length > 200) throw new HttpError(400, 'GREETING_TOO_LONG');
    return s;
  },
  consent_checked: bool,
  consent_note: (v) => text(v, 500),
  is_visible: bool,
  sort_order: (v) => int(v) ?? 0,
};
