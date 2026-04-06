/// <reference path="../pb_data/types.d.ts" />
/**
 * Repairs DBs where 1738000000 created domain collections with only the system `id` field
 * (Field *classes* inside `new Collection({ fields })` were not persisted by the migrator).
 *
 * Uses Field class instances with `fields.push()` — that path persists correctly.
 * Clears domain data first (re-run: npx tsx --env-file=.env scripts/seed-pb.ts).
 */
migrate((app) => {
  const groupsCol = app.findCollectionByNameOrId("groups");
  let hasNameField = false;
  for (const f of groupsCol.fields) {
    if (f.name === "name") {
      hasNameField = true;
      break;
    }
  }
  if (hasNameField) {
    return;
  }

  const db = app.db();
  [
    "DELETE FROM `activity_logs`",
    "DELETE FROM `expense_participants`",
    "DELETE FROM `expenses`",
    "DELETE FROM `settlements`",
    "DELETE FROM `invitations`",
    "DELETE FROM `group_members`",
    "DELETE FROM `groups`",
  ].forEach((sql) => db.newQuery(sql).execute());

  const usersId = app.findCollectionByNameOrId("users").id;

  groupsCol.fields.push(
    new TextField({ name: "name", required: true }),
    new TextField({ name: "description", required: false }),
    new TextField({ name: "category", required: true }),
    new TextField({ name: "currency", required: true })
  );
  app.save(groupsCol);
  const groupsId = groupsCol.id;

  const gm = app.findCollectionByNameOrId("group_members");
  gm.fields.push(
    new RelationField({
      name: "user",
      required: true,
      collectionId: usersId,
      cascadeDelete: true,
      maxSelect: 1,
      minSelect: 0,
    }),
    new RelationField({
      name: "group",
      required: true,
      collectionId: groupsId,
      cascadeDelete: true,
      maxSelect: 1,
      minSelect: 0,
    }),
    new TextField({ name: "role", required: true }),
    new DateField({ name: "joined_at", required: true })
  );
  gm.indexes = [
    "CREATE UNIQUE INDEX idx_group_members_user_group ON group_members (user, `group`)",
  ];
  app.save(gm);

  const inv = app.findCollectionByNameOrId("invitations");
  inv.fields.push(
    new RelationField({
      name: "group",
      required: true,
      collectionId: groupsId,
      cascadeDelete: true,
      maxSelect: 1,
      minSelect: 0,
    }),
    new TextField({ name: "email", required: false }),
    new TextField({ name: "token", required: true }),
    new TextField({ name: "status", required: true }),
    new RelationField({
      name: "invited_by",
      required: true,
      collectionId: usersId,
      cascadeDelete: false,
      maxSelect: 1,
      minSelect: 0,
    }),
    new DateField({ name: "expires_at", required: true })
  );
  inv.indexes = ["CREATE UNIQUE INDEX idx_invitations_token ON invitations (token)"];
  app.save(inv);

  const exp = app.findCollectionByNameOrId("expenses");
  exp.fields.push(
    new RelationField({
      name: "group",
      required: true,
      collectionId: groupsId,
      cascadeDelete: true,
      maxSelect: 1,
      minSelect: 0,
    }),
    new RelationField({
      name: "paid_by",
      required: true,
      collectionId: usersId,
      cascadeDelete: false,
      maxSelect: 1,
      minSelect: 0,
    }),
    new TextField({ name: "description", required: true }),
    new TextField({ name: "amount", required: true }),
    new TextField({ name: "currency", required: true }),
    new TextField({ name: "original_amount", required: false }),
    new TextField({ name: "original_currency", required: false }),
    new TextField({ name: "exchange_rate", required: false }),
    new TextField({ name: "category", required: true }),
    new DateField({ name: "date", required: true }),
    new TextField({ name: "notes", required: false }),
    new TextField({ name: "receipt_url", required: false }),
    new TextField({ name: "split_method", required: true })
  );
  app.save(exp);
  const expensesId = app.findCollectionByNameOrId("expenses").id;

  const ep = app.findCollectionByNameOrId("expense_participants");
  ep.fields.push(
    new RelationField({
      name: "expense",
      required: true,
      collectionId: expensesId,
      cascadeDelete: true,
      maxSelect: 1,
      minSelect: 0,
    }),
    new RelationField({
      name: "user",
      required: true,
      collectionId: usersId,
      cascadeDelete: true,
      maxSelect: 1,
      minSelect: 0,
    }),
    new TextField({ name: "amount", required: true }),
    new NumberField({ name: "shares", required: false }),
    new TextField({ name: "percentage", required: false })
  );
  ep.indexes = [
    "CREATE UNIQUE INDEX idx_expense_participants_expense_user ON expense_participants (expense, user)",
  ];
  app.save(ep);

  const set = app.findCollectionByNameOrId("settlements");
  set.fields.push(
    new RelationField({
      name: "group",
      required: true,
      collectionId: groupsId,
      cascadeDelete: true,
      maxSelect: 1,
      minSelect: 0,
    }),
    new RelationField({
      name: "from_user",
      required: true,
      collectionId: usersId,
      cascadeDelete: false,
      maxSelect: 1,
      minSelect: 0,
    }),
    new RelationField({
      name: "to_user",
      required: true,
      collectionId: usersId,
      cascadeDelete: false,
      maxSelect: 1,
      minSelect: 0,
    }),
    new TextField({ name: "amount", required: true }),
    new TextField({ name: "currency", required: true }),
    new TextField({ name: "notes", required: false }),
    new DateField({ name: "settled_at", required: true })
  );
  app.save(set);

  const al = app.findCollectionByNameOrId("activity_logs");
  al.fields.push(
    new RelationField({
      name: "group",
      required: false,
      collectionId: groupsId,
      cascadeDelete: true,
      maxSelect: 1,
      minSelect: 0,
    }),
    new RelationField({
      name: "user",
      required: true,
      collectionId: usersId,
      cascadeDelete: true,
      maxSelect: 1,
      minSelect: 0,
    }),
    new TextField({ name: "type", required: true }),
    new JSONField({ name: "metadata", required: false })
  );
  app.save(al);
});
