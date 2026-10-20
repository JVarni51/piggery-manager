/**
 * Sync-ready herd schema.
 * Every shared row has a client UUID, created_at, updated_at, deleted_at, and sync_status.
 * That shape can move to PowerSync or WatermelonDB later without renumbering ids.
 * `meta` is device-local (active role, seed flag) and is not part of the sync set.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS farms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  premises_id TEXT,
  gestation_days INTEGER NOT NULL,
  weaning_age_days INTEGER NOT NULL,
  heat_cycle_days INTEGER NOT NULL,
  farrowing_interval_days INTEGER NOT NULL,
  low_feed_lb REAL NOT NULL,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS breeds (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pig_groups (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feed_types (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  reorder_lb REAL NOT NULL,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS income_categories (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS farm_users (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pigs (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  name TEXT,
  litter_number TEXT,
  gender TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  breed_id TEXT,
  group_id TEXT,
  weight_lb REAL,
  dob TEXT,
  entry_date TEXT,
  source TEXT NOT NULL,
  source_detail TEXT,
  sire_id TEXT,
  sire_text TEXT,
  dam_id TEXT,
  dam_text TEXT,
  notes TEXT,
  photo_uri TEXT,
  ear_notch TEXT,
  show_tag TEXT,
  registration_no TEXT,
  litter_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS litters (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  sow_id TEXT NOT NULL,
  sire_id TEXT,
  breeding_event_id TEXT,
  farrow_date TEXT NOT NULL,
  parity INTEGER,
  born_alive INTEGER NOT NULL,
  stillborn INTEGER NOT NULL,
  mummies INTEGER NOT NULL,
  birth_weight_lb REAL,
  litter_number TEXT,
  weaned_count INTEGER,
  wean_date TEXT,
  wean_weight_lb REAL,
  notes TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS foster_moves (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  move_date TEXT NOT NULL,
  from_litter_id TEXT NOT NULL,
  to_litter_id TEXT NOT NULL,
  count INTEGER NOT NULL,
  reason TEXT,
  notes TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  pig_id TEXT,
  mass_event_id TEXT,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  notes TEXT,
  weight_lb REAL,
  weight_context TEXT,
  sire_id TEXT,
  sire_name TEXT,
  mating_method TEXT,
  technician TEXT,
  due_date TEXT,
  breeding_event_id TEXT,
  preg_result TEXT,
  preg_method TEXT,
  litter_id TEXT,
  born_alive INTEGER,
  stillborn INTEGER,
  mummies INTEGER,
  birth_weight_lb REAL,
  weaned_count INTEGER,
  wean_weight_lb REAL,
  drug_name TEXT,
  dose TEXT,
  route TEXT,
  withdrawal_days INTEGER,
  withdrawal_ends TEXT,
  diagnosis TEXT,
  symptoms TEXT,
  treated_by TEXT,
  vet_name TEXT,
  vfd_number TEXT,
  vaccine_name TEXT,
  next_due_date TEXT,
  buyer_id TEXT,
  buyer_name TEXT,
  sale_amount_cents INTEGER,
  cause TEXT,
  custom_name TEXT,
  transaction_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS mass_events (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  group_id TEXT,
  medicine_name TEXT,
  custom_name TEXT,
  notes TEXT,
  withdrawal_days INTEGER,
  cost_cents INTEGER,
  expense_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS mass_event_pigs (
  id TEXT PRIMARY KEY,
  mass_event_id TEXT NOT NULL,
  pig_id TEXT NOT NULL,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  txn_date TEXT NOT NULL,
  txn_type TEXT NOT NULL,
  category_id TEXT,
  feed_type_id TEXT,
  quantity REAL,
  title TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  receipt_no TEXT,
  notes TEXT,
  pig_id TEXT,
  buyer_id TEXT,
  feed_move_id TEXT,
  event_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS feed_movements (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  feed_type_id TEXT NOT NULL,
  movement TEXT NOT NULL,
  move_date TEXT NOT NULL,
  quantity REAL NOT NULL,
  cost_cents INTEGER,
  remark TEXT,
  done_by TEXT,
  notes TEXT,
  expense_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS shows (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  show_date TEXT NOT NULL,
  location TEXT,
  target_weight_lb REAL,
  notes TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS show_entries (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL,
  show_id TEXT NOT NULL,
  pig_id TEXT NOT NULL,
  exhibitor TEXT,
  class_name TEXT,
  target_weight_lb REAL,
  weigh_in_lb REAL,
  placing TEXT,
  premium_cents INTEGER,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  sync_status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pigs_farm ON pigs(farm_id);
CREATE INDEX IF NOT EXISTS idx_events_pig ON events(pig_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(txn_date);
CREATE INDEX IF NOT EXISTS idx_feed_type ON feed_movements(feed_type_id);
`;

export const DATA_TABLES = [
  'show_entries',
  'shows',
  'feed_movements',
  'transactions',
  'mass_event_pigs',
  'mass_events',
  'events',
  'foster_moves',
  'litters',
  'pigs',
  'contacts',
  'farm_users',
  'feed_types',
  'income_categories',
  'expense_categories',
  'pig_groups',
  'breeds',
  'farms',
] as const;

export const RESTORE_TABLES = new Set<string>([
  'pigs',
  'events',
  'litters',
  'foster_moves',
  'transactions',
  'feed_movements',
  'shows',
  'show_entries',
  'mass_events',
  'breeds',
  'pig_groups',
  'feed_types',
  'income_categories',
  'expense_categories',
  'contacts',
]);
