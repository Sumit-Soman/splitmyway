/// <reference path="../pb_data/types.d.ts" />
/**
 * Optional single file attachment per expense (any mime type; max 15 MB).
 */
migrate((app) => {
  const col = app.findCollectionByNameOrId("expenses");
  let has = false;
  for (const f of col.fields) {
    if (f.name === "attachment") {
      has = true;
      break;
    }
  }
  if (has) {
    return;
  }

  col.fields.push(
    new FileField({
      name: "attachment",
      required: false,
      maxSelect: 1,
      maxSize: 15 * 1024 * 1024,
      mimeTypes: [],
    })
  );
  app.save(col);
});
