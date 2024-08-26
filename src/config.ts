import { AccessToken } from "@twurple/auth";
import { readFileSync } from "fs";
import { writeFile } from "fs/promises";
import dotenv from "dotenv";
dotenv.config();

interface Config {
  userId: string;
  userName: string;
  spreadsheetId: string;
  sheetName: string;
  streamElements: {
    jwt: string;
  };
  streamlabs: {
    socketToken: string;
  }
  twitch: AccessToken;
}

const FILENAME = process.env.CONFIG_FILE || "config.json";

export const config: Map<string, Config> = new Map();

JSON.parse(readFileSync(FILENAME, "utf-8")).forEach((conf: Config) =>
  config.set(conf.userId, conf)
);

export async function writeConfig() {
  // writes the config file after it's been updated
  const contents = JSON.stringify(Array.from(config.values()), null, 2);
  await writeFile(FILENAME, contents, "utf-8");
}
