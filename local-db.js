// Local MongoDB for development (no Atlas needed).
// Starts an in-memory mongod on 127.0.0.1:27017 with db `huxnStore`.
// Keep this running in its own terminal: `npm run db`
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create({
  instance: { port: 27017, dbName: "huxnStore" },
});

console.log(`Local MongoDB running: ${mongod.getUri("huxnStore")}`);
console.log("Keep this terminal open. Press Ctrl+C to stop.");

// Keep process alive + clean shutdown
setInterval(() => {}, 1000);
const shutdown = async () => {
  await mongod.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
