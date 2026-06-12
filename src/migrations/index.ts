import * as migration_20260605_124517_payload_phase_zero from './20260605_124517_payload_phase_zero';
import * as migration_20260611_174051_payload_faqs from './20260611_174051_payload_faqs';
import * as migration_20260611_185148_payload_media_mcp from './20260611_185148_payload_media_mcp';

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
  {
    up: migration_20260611_185148_payload_media_mcp.up,
    down: migration_20260611_185148_payload_media_mcp.down,
    name: '20260611_185148_payload_media_mcp'
  },
];
