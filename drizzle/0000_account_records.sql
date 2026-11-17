CREATE TABLE account_records (
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('tasks', 'expenses')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  data TEXT NOT NULL,
  PRIMARY KEY (user_id, kind)
);
