-- SplitMyWay D1 schema (SQLite). Money stored as INTEGER minor units (e.g. cents).
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  avatar_mime TEXT,
  avatar_blob BLOB,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_users_email_lower ON users (email);

CREATE TABLE groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  currency TEXT NOT NULL,
  created_by TEXT REFERENCES users (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_groups_created_by ON groups (created_by);

CREATE TABLE group_members (
  id TEXT PRIMARY KEY NOT NULL,
  group_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON group_members (user_id);
CREATE INDEX idx_group_members_group ON group_members (group_id);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY NOT NULL,
  group_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  email TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  invited_by TEXT NOT NULL REFERENCES users (id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_invitations_group ON invitations (group_id);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY NOT NULL,
  group_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  paid_by_user_id TEXT NOT NULL REFERENCES users (id),
  description TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  original_amount_minor INTEGER,
  original_currency TEXT,
  exchange_rate_e8 INTEGER,
  category TEXT NOT NULL,
  expense_date TEXT NOT NULL,
  notes TEXT,
  split_type TEXT NOT NULL,
  attachment_mime TEXT,
  attachment_blob BLOB,
  created_by TEXT REFERENCES users (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_expenses_group ON expenses (group_id);
CREATE INDEX idx_expenses_date ON expenses (group_id, expense_date);

CREATE TABLE expense_shares (
  id TEXT PRIMARY KEY NOT NULL,
  expense_id TEXT NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id),
  share_amount_minor INTEGER NOT NULL,
  shares INTEGER,
  percentage_bps INTEGER,
  UNIQUE (expense_id, user_id)
);

CREATE INDEX idx_expense_shares_expense ON expense_shares (expense_id);

CREATE TABLE payments (
  id TEXT PRIMARY KEY NOT NULL,
  group_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  from_user_id TEXT NOT NULL REFERENCES users (id),
  to_user_id TEXT NOT NULL REFERENCES users (id),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  notes TEXT,
  paid_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_payments_group ON payments (group_id);
CREATE INDEX idx_payments_paid_at ON payments (group_id, paid_at);

CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY NOT NULL,
  group_id TEXT REFERENCES groups (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id),
  type TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_activity_user ON activity_logs (user_id);
CREATE INDEX idx_activity_group ON activity_logs (group_id);
CREATE INDEX idx_activity_created ON activity_logs (created_at);
