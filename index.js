import dotenv from 'dotenv';
dotenv.config();

import { google } from 'googleapis';
import ComfyJS from 'comfy.js';
import config from './config.js';

const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({version: 'v4', auth});
const channels = Object.create(null);
config.forEach(({spreadsheetId, sheetName, twitchChannel}) => {
    channels[twitchChannel.toLowerCase()] = {spreadsheetId, sheetName}
})

async function appendRow(channel, action, tier, subcount, from, to, months, message) {
    try {
        const {spreadsheetId, sheetName} = channels[channel.toLowerCase()];
        const tierName = tier ? tier.prime ? 'Prime' : 'Tier ' + tier.plan / 1000 : null
        const response = (await sheets.spreadsheets.values.append({
            spreadsheetId, range: sheetName, valueInputOption: 'RAW', 
            resource: {values: [[(new Date()).toISOString(), channel, action, tierName, subcount, from, to, months, message]]}
        })).data;
    } catch (err) {
        console.error(err);
    }
}

ComfyJS.onSub = (user, message, subTierInfo, extra) => {
    appendRow(extra.channel, 'Sub', subTierInfo, 1, user, user, 1, message)
}

ComfyJS.onResub = ( user, message, streamMonths, cumulativeMonths, subTierInfo, extra ) => {
    appendRow(extra.channel, 'Resub', subTierInfo, 1, user, user, cumulativeMonths, message)
}

ComfyJS.onSubGift = ( gifterUser, streakMonths, recipientUser, senderCount, subTierInfo, extra ) => {
    appendRow(extra.channel, 'Gift', subTierInfo, 1, gifterUser, recipientUser, null, null);
}

ComfyJS.onSubMysteryGift = ( gifterUser, numbOfSubs, senderCount, subTierInfo, extra ) => {
    appendRow(extra.channel, 'Mass Gift', subTierInfo, extra.userMassGiftCount, gifterUser, null, null, null);
}

ComfyJS.onGiftSubContinue = ( user, sender, extra ) => {
    appendRow(extra.channel, 'Gift Continue', null, null, sender, user, null, null, null);
}

ComfyJS.Init(config[0].twitchChannel, null, Object.keys(channels));