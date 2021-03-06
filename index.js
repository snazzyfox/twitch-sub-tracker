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

function getTierName(subTierData) {
    if (subTierData) {
        return subTierData.prime ? 'Prime' : 'Tier ' + subTierData.plan / 1000;
    } else {
        return null;
    }
}

let lastGSheetApiCallTime = 0;

async function writeRow(rowData) {
    console.log(JSON.stringify(rowData))
    while (Date.now() - lastGSheetApiCallTime < 1000) {  // delay processing until at least 1 sec past last call
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    lastGSheetApiCallTime = Date.now();
    try {
        const { spreadsheetId, sheetName } = channels[rowData.channel.toLowerCase()];
        const tierName = getTierName(rowData.tier)
        const row = [
            (new Date()).toISOString(),
            rowData.channel,
            rowData.action,
            getTierName(rowData.tier),
            rowData.count,
            rowData.bits,
            rowData.from,
            rowData.to,
            rowData.months,
            rowData.message || '',
        ]
        const resource = { values: [row] };
        if (rowData.range) {
            const response = (await sheets.spreadsheets.values.update({
                spreadsheetId, range: rowData.range, valueInputOption: 'RAW', resource,
            })).data;
        } else {
            const response = (await sheets.spreadsheets.values.append({
                spreadsheetId, range: sheetName, valueInputOption: 'RAW', resource,
            })).data;
            rowData.range = response.updates.updatedRange;  // this also updates the cache since it's by ref
        }
    } catch (err) {
        console.error(err);
    }
}

ComfyJS.onSub = (user, message, subTierInfo, extra) => {
    writeRow({
        channel: extra.channel,
        action: 'Sub',
        tier: subTierInfo,
        count: 1,
        from: user,
        to: user,
        months: 1,
        message,
    });
}

ComfyJS.onResub = (user, message, streamMonths, cumulativeMonths, subTierInfo, extra) => {
    writeRow({
        channel: extra.channel,
        action: 'Resub',
        tier: subTierInfo,
        count: 1,
        from: user,
        to: user,
        months: cumulativeMonths,
        message,
    });
}

ComfyJS.onGiftSubContinue = (user, sender, extra) => {
    writeRow({
        channel: extra.channel,
        action: 'Gift Continue',
        from: sender,
        to: user,
    });
}

ComfyJS.onSubGift = async (gifterUser, streakMonths, recipientUser, senderCount, subTierInfo, extra) => {
    const originId = extra.userState['msg-param-origin-id'];
    let subData = cache.get(originId);
    if (subData) {
        if (subData.to) {
            subData.to += ', ' + recipientUser;
        } else {
            subData.to = recipientUser;
        }
    } else {
        subData = {
            channel: extra.channel,
            action: 'Gift',
            tier: subTierInfo,
            count: 1,
            from: gifterUser,
            to: recipientUser,
        }
    }
    cache.set(originId, subData);
    await writeRow(subData);
}

ComfyJS.onSubMysteryGift = async (gifterUser, numbOfSubs, senderCount, subTierInfo, extra) => {
    const originId = extra.userState['msg-param-origin-id'];
    let subData = cache.get(originId);
    if (subData) {
        subData.count = extra.userMassGiftCount;
    } else {
        subData = {
            channel: extra.channel,
            action: 'Gift',
            tier: subTierInfo,
            count: extra.userMassGiftCount,
            from: gifterUser,
        }
    }
    cache.set(originId, subData);
    await writeRow(subData);
}

ComfyJS.onCheer = ( user, message, bits, flags, extra ) => {
    writeRow({
        channel: extra.channel,
        action: 'Cheer',
        bits,
        from: user,
        message: message,
    });
}

ComfyJS.Init(config[0].twitchChannel, null, Object.keys(channels));