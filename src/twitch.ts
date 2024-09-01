import { RefreshingAuthProvider } from "@twurple/auth";
import { ApiClient } from "@twurple/api";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import { config, writeConfig } from "./config.js";
import { writeRow } from "./gsheet.js";

const authProvider = new RefreshingAuthProvider({
  clientId: process.env.TWITCH_CLIENT_ID!,
  clientSecret: process.env.TWITCH_CLIENT_SECRET!,
});

// Write tokens to config on auto refresh
authProvider.onRefresh(async (userId, newTokenData) => {
  console.log(`Refreshed token for ${userId}: ${JSON.stringify(newTokenData)}`);
  config.get(userId)!.twitch = newTokenData;
  await writeConfig();
});

authProvider.onRefreshFailure((userId, error) => {
  console.error(`Failed to refresh token for ${userId}: ${error}`);
});

const apiClient = new ApiClient({
  authProvider,
  mockServerPort: Number(process.env.TWITCH_MOCK_SERVER_PORT) || undefined,
});

const listener = new EventSubWsListener({
  apiClient,
  // url: process.env.TWITCH_EVENTSUB_ENDPOINT,
});

export default function start() {
  listener.start();
  
  config.forEach((conf) => {
    console.log(`Creating websocket subscriptions for channel ${conf.userId}`);
    authProvider.addUser(conf.userId, conf.twitch);

    listener.onChannelChatNotification(conf.userId, conf.userId, async (event) => {
      if (event.type === 'sub') {
        // brand new subs only
        const resp = await writeRow(conf.userId, {
          channel: event.broadcasterDisplayName,
          action: "Sub",
          level: event.tier,
          user: event.chatterDisplayName,
          amount: 1,
        });
      } else if (event.type === 'resub' && !event.isGift) {
        // resub message. Gifted sub already counted in gift
        await writeRow(conf.userId, {
          channel: event.broadcasterDisplayName,
          action: "Resub",
          level: event.tier,
          user: event.chatterDisplayName,
          amount: 1,
          message: event.messageText,
        });
      } else if (event.type === 'sub_gift' && !event.communityGiftId) {
        // gifted subs to specific targets
        await writeRow(conf.userId, {
          channel: event.broadcasterDisplayName,
          action: "Gift",
          level: event.tier,
          user: event.chatterDisplayName,
          amount: 1,
        });
      } else if (event.type === 'community_sub_gift') {
        // random sub gifts
        await writeRow(conf.userId, {
          channel: event.broadcasterDisplayName,
          action: "Gift",
          level: event.tier,
          user: event.chatterDisplayName,
          amount: event.amount,
        });
      }
    })

    listener.onChannelCheer(conf.userId, async (event) => {
      await writeRow(conf.userId, {
        channel: event.broadcasterDisplayName,
        action: "Cheer",
        user: event.userDisplayName || "(Anonymous)",
        amount: event.bits,
        message: event.message,
      });
    });

    listener.onChannelHypeTrainEnd(conf.userId, async (event) => {
      await writeRow(conf.userId, {
        channel: event.broadcasterDisplayName,
        action: "HypeTrain",
        level: event.level,
      });
    });

    listener.onChannelAutomaticRewardRedemptionAdd(conf.userId, async (event) => {
      if (["message_effect", "gigantify_an_emote", "celebration"].includes(event.rewardType))
        await writeRow(conf.userId, {
          channel: event.broadcasterDisplayName,
          action: "Redeem",
          level: event.rewardType,
          amount: event.rewardCost,
          user: event.userDisplayName,
          message: event.input || undefined,
        });
    });
  });

  console.log("Done subscribing to EventSub events.");
}
