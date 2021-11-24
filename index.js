import dotenv from 'dotenv';
dotenv.config();

import { google } from 'googleapis';
import TTLCache from 'ttl-cache';
import ComfyJS from 'comfy.js';
import config from './config.js';

const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const cache = new TTLCache({ ttl: 60, interval: 20 });

const sheets = google.sheets({ version: 'v4', auth });
const channels = Object.create(null);
config.forEach(({ spreadsheetId, sheetName, twitchChannel }) => {
    channels[twitchChannel.toLowerCase()] = { spreadsheetId, sheetName }
})

async function writeRow(channel, action, tier, subcount, from, to, months, message, range) {
    try {
        const { spreadsheetId, sheetName } = channels[channel.toLowerCase()];
        const tierName = tier ? tier.prime ? 'Prime' : 'Tier ' + tier.plan / 1000 : null
        const resource = { values: [[(new Date()).toISOString(), channel, action, tierName, subcount, from, to, months, message || '']] }
        if (range) {
            const response = (await sheets.spreadsheets.values.update({
                spreadsheetId, range, valueInputOption: 'RAW', resource,
            })).data;
            return response.updatedRange;
        } else {
            const response = (await sheets.spreadsheets.values.append({
                spreadsheetId, range: sheetName, valueInputOption: 'RAW', resource,
            })).data;
            return response.updates.updatedRange;
        }
    } catch (err) {
        console.error(err);
    }
}

ComfyJS.onSub = (user, message, subTierInfo, extra) => {
    writeRow(extra.channel, 'Sub', subTierInfo, 1, user, user, 1, message);
}

ComfyJS.onResub = (user, message, streamMonths, cumulativeMonths, subTierInfo, extra) => {
    writeRow(extra.channel, 'Resub', subTierInfo, 1, user, user, cumulativeMonths, message);
}

ComfyJS.onSubGift = async (gifterUser, streakMonths, recipientUser, senderCount, subTierInfo, extra) => {
    const originId = extra.userState['msg-param-origin-id'];
    let subData = cache.get(originId);
    if (subData) {
        if (subData.recipient) {
            subData.recipient += ', ' + recipientUser;
        } else {
            subData.recipient = recipientUser;
        }
    } else {
        subData = {
            channel: extra.channel, type: 'Gift', subTierInfo, count: 1, gifter: gifterUser, recipient: recipientUser
        }
    }
    const rowRange = await writeRow(subData.channel, subData.type, subTierInfo, subData.count, subData.gifter, subData.recipient, null, null, subData.range);
    subData.range = rowRange;
    cache.set(originId, subData);
}

ComfyJS.onSubMysteryGift = async (gifterUser, numbOfSubs, senderCount, subTierInfo, extra) => {
    const originId = extra.userState['msg-param-origin-id'];
    let subData = cache.get(originId);
    if (subData) {
        subData.count = extra.userMassGiftCount;
    } else {
        subData = {
            channel: extra.channel, type: 'Gift', subTierInfo, count: extra.userMassGiftCount, gifter: gifterUser
        }
    }
    const rowRange = await writeRow(subData.channel, subData.type, subTierInfo, subData.count, subData.gifter, subData.recipient, null, null, subData.range);
    subData.range = rowRange;
    cache.set(originId, subData);
}

ComfyJS.onGiftSubContinue = (user, sender, extra) => {
    writeRow(extra.channel, 'Gift Continue', null, null, sender, user, null, null, null);
}

ComfyJS.Init(config[0].twitchChannel, null, Object.keys(channels));