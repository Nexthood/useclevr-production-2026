import * as migration_20260605_124517_payload_phase_zero from './20260605_124517_payload_phase_zero';
import * as migration_20260611_174051_payload_faqs from './20260611_174051_payload_faqs';

export const migrations = [
  {
    up: migration_20260605_124517_payload_phase_zero.up,
    down: migration_20260605_124517_payload_phase_zero.down,
    name: '20260605_124517_payload_phase_zero',
  },
  {
    up: migration_20260611_174051_payload_faqs.up,
    down: migration_20260611_174051_payload_faqs.down,
    name: '20260611_174051_payload_faqs',
  },
];
