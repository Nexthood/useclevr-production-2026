import * as migration_20260605_124517_payload_phase_zero from './20260605_124517_payload_phase_zero';

export const migrations = [
  {
    up: migration_20260605_124517_payload_phase_zero.up,
    down: migration_20260605_124517_payload_phase_zero.down,
    name: '20260605_124517_payload_phase_zero'
  },
];
