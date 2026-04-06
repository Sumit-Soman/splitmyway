/// <reference path="../pb_data/types.d.ts" />
/**
 * Local dev superuser (idempotent). Change password in PocketBase UI for anything beyond localhost.
 */
migrate((app) => {
  const email = "admin@splitmyway.local";
  try {
    app.findAuthRecordByEmail("_superusers", email);
    return;
  } catch {
    /* not found */
  }
  const superusers = app.findCollectionByNameOrId("_superusers");
  const record = new Record(superusers);
  record.set("email", email);
  record.set("password", "SplitMyWayLocalDev1!");
  app.save(record);
});
