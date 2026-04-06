/// <reference path="../pb_data/types.d.ts" />
/**
 * SplitMyWay schema: extend auth users + domain collections.
 * Field definitions MUST be plain objects ({ type: "text", name: "..." }).
 * Class constructors (new TextField, new RelationField) inside `new Collection({ fields })`
 * are not persisted by the JS migrator — only the system `id` field was saved.
 *
 * Run: ./tools/pocketbase serve --http=127.0.0.1:8090 --dir=./pb_data --migrationsDir=./pb_migrations
 */
migrate((app) => {
  // --- Extend built-in users (auth) ---
  const usersCol = app.findCollectionByNameOrId("users");
  usersCol.fields.push(
    { type: "text", name: "name", required: false },
    { type: "text", name: "currency", required: false },
    {
      type: "file",
      name: "avatar",
      required: false,
      maxSelect: 1,
      maxSize: 2097152,
      mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    }
  );
  app.save(usersCol);

  const usersId = usersCol.id;

  // --- groups ---
  const groups = new Collection({
    type: "base",
    name: "groups",
    fields: [
      { type: "text", name: "name", required: true },
      { type: "text", name: "description", required: false },
      { type: "text", name: "category", required: true },
      { type: "text", name: "currency", required: true },
    ],
  });
  app.save(groups);
  const groupsId = app.findCollectionByNameOrId("groups").id;

  // --- group_members ---
  const groupMembers = new Collection({
    type: "base",
    name: "group_members",
    fields: [
      {
        type: "relation",
        name: "user",
        required: true,
        collectionId: usersId,
        cascadeDelete: true,
        maxSelect: 1,
        minSelect: 0,
      },
      {
        type: "relation",
        name: "group",
        required: true,
        collectionId: groupsId,
        cascadeDelete: true,
        maxSelect: 1,
        minSelect: 0,
      },
      { type: "text", name: "role", required: true },
      { type: "date", name: "joined_at", required: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_group_members_user_group ON group_members (user, `group`)",
    ],
  });
  app.save(groupMembers);

  // --- invitations ---
  const invitations = new Collection({
    type: "base",
    name: "invitations",
    fields: [
      {
        type: "relation",
        name: "group",
        required: true,
        collectionId: groupsId,
        cascadeDelete: true,
        maxSelect: 1,
        minSelect: 0,
      },
      { type: "text", name: "email", required: false },
      { type: "text", name: "token", required: true },
      { type: "text", name: "status", required: true },
      {
        type: "relation",
        name: "invited_by",
        required: true,
        collectionId: usersId,
        cascadeDelete: false,
        maxSelect: 1,
        minSelect: 0,
      },
      { type: "date", name: "expires_at", required: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_invitations_token ON invitations (token)"],
  });
  app.save(invitations);

  // --- expenses (amounts as text for decimal precision) ---
  const expenses = new Collection({
    type: "base",
    name: "expenses",
    fields: [
      {
        type: "relation",
        name: "group",
        required: true,
        collectionId: groupsId,
        cascadeDelete: true,
        maxSelect: 1,
        minSelect: 0,
      },
      {
        type: "relation",
        name: "paid_by",
        required: true,
        collectionId: usersId,
        cascadeDelete: false,
        maxSelect: 1,
        minSelect: 0,
      },
      { type: "text", name: "description", required: true },
      { type: "text", name: "amount", required: true },
      { type: "text", name: "currency", required: true },
      { type: "text", name: "original_amount", required: false },
      { type: "text", name: "original_currency", required: false },
      { type: "text", name: "exchange_rate", required: false },
      { type: "text", name: "category", required: true },
      { type: "date", name: "date", required: true },
      { type: "text", name: "notes", required: false },
      { type: "text", name: "receipt_url", required: false },
      { type: "text", name: "split_method", required: true },
    ],
  });
  app.save(expenses);
  const expensesId = app.findCollectionByNameOrId("expenses").id;

  // --- expense_participants ---
  const expenseParticipants = new Collection({
    type: "base",
    name: "expense_participants",
    fields: [
      {
        type: "relation",
        name: "expense",
        required: true,
        collectionId: expensesId,
        cascadeDelete: true,
        maxSelect: 1,
        minSelect: 0,
      },
      {
        type: "relation",
        name: "user",
        required: true,
        collectionId: usersId,
        cascadeDelete: true,
        maxSelect: 1,
        minSelect: 0,
      },
      { type: "text", name: "amount", required: true },
      { type: "number", name: "shares", required: false },
      { type: "text", name: "percentage", required: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_expense_participants_expense_user ON expense_participants (expense, user)",
    ],
  });
  app.save(expenseParticipants);

  // --- settlements ---
  const settlements = new Collection({
    type: "base",
    name: "settlements",
    fields: [
      {
        type: "relation",
        name: "group",
        required: true,
        collectionId: groupsId,
        cascadeDelete: true,
        maxSelect: 1,
        minSelect: 0,
      },
      {
        type: "relation",
        name: "from_user",
        required: true,
        collectionId: usersId,
        cascadeDelete: false,
        maxSelect: 1,
        minSelect: 0,
      },
      {
        type: "relation",
        name: "to_user",
        required: true,
        collectionId: usersId,
        cascadeDelete: false,
        maxSelect: 1,
        minSelect: 0,
      },
      { type: "text", name: "amount", required: true },
      { type: "text", name: "currency", required: true },
      { type: "text", name: "notes", required: false },
      { type: "date", name: "settled_at", required: true },
    ],
  });
  app.save(settlements);

  // --- activity_logs ---
  const activityLogs = new Collection({
    type: "base",
    name: "activity_logs",
    fields: [
      {
        type: "relation",
        name: "group",
        required: false,
        collectionId: groupsId,
        cascadeDelete: true,
        maxSelect: 1,
        minSelect: 0,
      },
      {
        type: "relation",
        name: "user",
        required: true,
        collectionId: usersId,
        cascadeDelete: true,
        maxSelect: 1,
        minSelect: 0,
      },
      { type: "text", name: "type", required: true },
      { type: "json", name: "metadata", required: false },
    ],
  });
  app.save(activityLogs);
});
