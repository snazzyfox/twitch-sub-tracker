# twitch-sub-tracker
Tracks twitch subs and records details in a Google Sheet

## How to use

#### Prerequisites

- A GCP account with Google Sheets API enabled
- If not running on GCP infrastructure, create service user credentials. You can specify the credentials JSON file to use with environment variables. 
- Create a blank Google spreadsheet. Add a header and formatting if you want to. Make sure to share the spreadsheet with your GCP service user's email and give it edit permissions.
- Copy [config.js.template] to `config.js` and fill out its contents. To track multiple channels into multiple spreadsheets, repeat the object as needed. You can track multiple channels in the same sheet, separate sheets in the same document, or multiple documents.

#### Running the script

- `npm install`
- `npm start`
