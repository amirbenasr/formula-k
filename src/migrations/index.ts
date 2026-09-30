import * as migration_20260122_205052 from './20260122_205052';
import * as migration_20260930_172310_sync_schema_drift from './20260930_172310_sync_schema_drift';
import * as migration_20260930_184201_add_ai_action_kind from './20260930_184201_add_ai_action_kind';

export const migrations = [
  {
    up: migration_20260122_205052.up,
    down: migration_20260122_205052.down,
    name: '20260122_205052',
  },
  {
    up: migration_20260930_172310_sync_schema_drift.up,
    down: migration_20260930_172310_sync_schema_drift.down,
    name: '20260930_172310_sync_schema_drift',
  },
  {
    up: migration_20260930_184201_add_ai_action_kind.up,
    down: migration_20260930_184201_add_ai_action_kind.down,
    name: '20260930_184201_add_ai_action_kind'
  },
];
