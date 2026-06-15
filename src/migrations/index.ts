import * as migration_20260605_124517_payload_phase_zero from './20260605_124517_payload_phase_zero';
import * as migration_20260611_174051_payload_faqs from './20260611_174051_payload_faqs';
import * as migration_20260611_185148_payload_media_mcp from './20260611_185148_payload_media_mcp';
import * as migration_20260612_211900_payload_dashboard_mcp_tools from './20260612_211900_payload_dashboard_mcp_tools';
import * as migration_20260615_183958___name from './20260615_183958___name';

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
    name: '20260611_185148_payload_media_mcp',
  },
  {
    up: migration_20260612_211900_payload_dashboard_mcp_tools.up,
    down: migration_20260612_211900_payload_dashboard_mcp_tools.down,
    name: '20260612_211900_payload_dashboard_mcp_tools',
  },
  {
    up: migration_20260615_183958___name.up,
    down: migration_20260615_183958___name.down,
    name: '20260615_183958___name'
  },
];
