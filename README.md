# twitch-sub-tracker
Tracks twitch subs and records details in a Google Sheet

## How to use

#### Prerequisites

- A GCP account with Google Sheets API enabled
- If not running on GCP infrastructure, create service user credentials. You can specify the credentials JSON file to use with environment variables. 
- Create a blank Google spreadsheet. Make sure to add a header! Otherwise, Google Sheets may fail to detect the correct place to append data if there are blank cells. 
- Share the spreadsheet with your GCP service user's email and give it edit permissions.
- Copy `config.template.json` and fill out your information. To track multiple channels into multiple spreadsheets, repeat the object as needed. You can track multiple channels in the same sheet, separate sheets in the same document, or multiple documents.

#### Running the script

- `npm install`
- `npm start`
