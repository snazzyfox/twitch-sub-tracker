import dotenv from 'dotenv';
dotenv.config();

import { google } from 'googleapis';
import TTLCache from 'ttl-cache';
import ComfyJS from 'comfy.js';
import config from './config.js';
import io from 'socket.io-client';

const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    // keyFile: '.credentials.json',
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
            rowData.tip,
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

ComfyJS.onChat = (user, message, flags, self, extra ) => {
    if (user === 'StreamElements') {
        const match = /^(\w+) just bought me/.exec(message);
        if (match && match[1]) {
            writeRow({
                channel: extra.channel, 
                action: 'Throne', 
                from: match[1],
                message,
            })
        }
    }
}

console.log('Initializing Comfy.JS twitch chat connection');
ComfyJS.Init(config[0].twitchChannel, null, Object.keys(channels));

config.forEach(({ twitchChannel, streamlabsSocketToken, streamelementsJwtToken }) => {
    if (streamlabsSocketToken) {
        const socket = io(`https://sockets.streamlabs.com?token=${streamlabsSocketToken}`, {transports: ['websocket']});
        socket.on('connect', () => {
            console.log(`Connected to streamlabs socket for ${twitchChannel}`);
        });
        socket.on('connect_error', error => {
            console.log(`Error connecting to streamlabs socket: `, error);
        });
        socket.on('event', ({type, message}) => {
            if (type === 'donation') {
                message.forEach(({isTest, amount, from, message}) => {
                    writeRow({
                        channel: twitchChannel,
                        action: 'Tip',
                        tip: Number(amount),
                        from: isTest ? 'Streamlabs Test' : from, 
                        message,
                    })
                })
            }
        });
        socket.connect();
    }

    if (streamelementsJwtToken) {
        const socket = io('https://realtime.streamelements.com', {transports: ['websocket']});
        socket.on('connect', () => {
            socket.emit('authenticate', {method: 'jwt', token: streamelementsJwtToken});
        });
        socket.on('authenticated', () => {
            console.log(`Connected to streamelements socket for ${twitchChannel}`);
        });
        socket.on('unauthorized', console.error);
        socket.on('event', (data) => {
            if (data.type === 'tip') {
                writeRow({
                    channel: twitchChannel,
                    action: 'Tip', 
                    tip: data.data.amount,
                    from: data.isMock ? 'StreamElements Test': data.data.username,
                    message: data.data.message,
                })
            }
        })
    }
})

console.log('Initiailization finished.');