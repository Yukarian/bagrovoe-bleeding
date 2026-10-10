import fs from "node:fs";
import path from "node:path";
import { ClassicLevel } from "classic-level";

const spells = JSON.parse(fs.readFileSync("packs-src/blood-spells.json", "utf8"));
if (spells.length !== 12) throw new Error("Expected exactly 12 spells");
const ids = new Set();
for (const item of spells) {
  if (item.type !== "spell" || !/^[a-zA-Z0-9]{16}$/.test(item._id) || ids.has(item._id)) {
    throw new Error("Invalid spell item: " + item.name);
  }
  ids.add(item._id);
}
fs.mkdirSync("packs", { recursive: true });
const dir = path.resolve("packs/blood-spells");
fs.rmSync(dir, { force: true, recursive: true });
const db = new ClassicLevel(dir, { valueEncoding: "json" });
try {
  await db.open();
  await db.batch(spells.map(item => ({ type: "put", key: "!items!" + item._id, value: item })));
} finally {
  await db.close();
}
console.log("Built 12 blood spells in Foundry LevelDB pack");
