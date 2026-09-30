import * as migration_20260122_205052 from './20260122_205052';
import * as migration_20260930_172310_sync_schema_drift from './20260930_172310_sync_schema_drift';

export const migrations = [
  {
    up: migration_20260122_205052.up,
    down: migration_20260122_205052.down,
    name: '20260122_205052',
  },
  {
    up: migration_20260930_172310_sync_schema_drift.up,
    down: migration_20260930_172310_sync_schema_drift.down,
    name: '20260930_172310_sync_schema_drift'
  },
];
