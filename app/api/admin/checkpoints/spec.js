import { bool, int, lat, lng, paths, text } from '@/lib/server/fields';

export const checkpointSpec = {
  name: (v) => text(v, 100),
  sort_order: int,
  description: (v) => text(v, 20000),
  summary: (v) => text(v, 500),
  photo_paths: (v) => paths(v, 5),
  lat,
  lng,
  is_public: bool,
};
