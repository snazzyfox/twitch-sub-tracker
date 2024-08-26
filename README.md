# twitch-sub-tracker
Tracks twitch subs and records details in a Google Sheet

## How to use

Copy `config.template.json` to `config.json` or some other file. You can point to it using the `CONFIG_FILE` environment variable.

#### Setting up: GCP Side

- GCP Service User credentials, specified via standard gcloud environment variables.
- A Google spreadsheet. Make sure to add a header row manually first. Otherwise, Google Sheets may fail to detect the correct place to append data if there are blank cells. 
- Share the spreadsheet with your GCP service user's email and give it edit permissions.
- Write the spreadsheet ID and sheet name in the config file.

#### Setting up: Twitch Side

- A twitch app with client ID and client secret. Specify both in environment variables.
- Manually obtain the first access token and refresh token. Write them in the config file, and set expire to 0. The app will automatically handle refreshing them from then on.
- StreamLabs and/or StreamElements socket tokens. These cannot be auto-refreshed and must be kept updated manually. Leave blank if not needed.

#### Running the script

For development:
- `npm install`
- `npm start` 

For production:
- `npm ci`
- `npm run build`
- `node dist/index.js`
