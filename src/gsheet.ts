import { google } from "googleapis";
import { config } from "./config.js";

const auth = new google.auth.GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
let lastGSheetApiCallTime = 0;

interface GSheetRow {
  channel: string;
  action: string;
  level?: string; // sub tier or hype train level
  amount?: number; // sub count, bits count, tip dollars
  user?: string;
  message?: string;
}

export async function writeRow(userId: string, data: GSheetRow) {
  while (Date.now() - lastGSheetApiCallTime < 1000) {
    // delay processing until at least 1 sec past last call
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  lastGSheetApiCallTime = Date.now();
  const { spreadsheetId, sheetName } = config.get(userId)!;
  try {
    // get spreadsheet id and name
    const row = [
      new Date().toISOString(),
      data.channel,
      data.action,
      data.level || "",
      data.amount,
      data.user,
      data.message || "",
    ];
    console.log("Writing row: ", row);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: sheetName,
      valueInputOption: "RAW",
      requestBody: {
        values: [row],
      },
    });
  } catch (err) {
    console.error(err);
  }
}
