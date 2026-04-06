/// <reference path="../pb_data/types.d.ts" />
/**
 * Base collections require `created` and `updated` columns. Tables repaired in 1738000002
 * had only custom fields + id; without system columns, PocketBase rejects creates and sort.
 */
migrate((app) => {
  const db = app.db();
  const tables = [
    "groups",
    "group_members",
    "invitations",
    "expenses",
    "expense_participants",
    "settlements",
    "activity_logs",
  ];

  for (const t of tables) {
    try {
      db.newQuery(`ALTER TABLE \`${t}\` ADD COLUMN \`created\` TEXT DEFAULT '' NOT NULL`).execute();
    } catch (_) {
      /* column exists */
    }
    try {
      db.newQuery(`ALTER TABLE \`${t}\` ADD COLUMN \`updated\` TEXT DEFAULT '' NOT NULL`).execute();
    } catch (_) {
      /* column exists */
    }
  }

  const stamp = new Date().toISOString().replace("T", " ").replace("Z", "Z");
  for (const t of tables) {
    db.newQuery(
      `UPDATE \`${t}\` SET \`created\` = '${stamp}', \`updated\` = '${stamp}' WHERE \`created\` = '' OR \`updated\` = ''`
    ).execute();
  }
});
