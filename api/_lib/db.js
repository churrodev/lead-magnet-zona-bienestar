import { neon } from "@neondatabase/serverless";

let client;

export function getDb() {
  const connectionString = process.env.ZCA_LEAD_DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing ZCA_LEAD_DATABASE_URL environment variable");
  }

  client ??= neon(connectionString);
  return client;
}
