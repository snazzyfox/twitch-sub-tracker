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
    console.log(`Creating subscriptions for user ${conf.userId}`);
    authProvider.addUser(conf.userId, conf.twitch);

    listener.onChannelSubscription(conf.userId, async (event) => {
      await writeRow({
        channel: event.broadcasterDisplayName,
        action: "Sub",
        level: event.tier,
        user: event.userDisplayName,
        amount: 1,
      });
    });

    listener.onChannelSubscriptionMessage(conf.userId, async (event) => {
      await writeRow({
        channel: event.broadcasterDisplayName,
        action: "Resub",
        level: event.tier,
        user: event.userDisplayName,
        amount: 1,
        message: event.messageText,
      });
    });

    listener.onChannelSubscriptionGift(conf.userId, async (event) => {
      await writeRow({
        channel: event.broadcasterDisplayName,
        action: "Gift",
        level: event.tier,
        user: event.gifterDisplayName,
        amount: event.amount,
      });
    });

    listener.onChannelCheer(conf.userId, async (event) => {
      await writeRow({
        channel: event.broadcasterDisplayName,
        action: "Cheer",
        user: event.userDisplayName || "(Anonymous)",
        amount: event.bits,
        message: event.message,
      });
    });

    listener.onChannelHypeTrainEnd(conf.userId, async (event) => {
      await writeRow({
        channel: event.broadcasterDisplayName,
        action: "HypeTrain",
        level: event.level.toString(),
      });
    });

    listener.onChannelAutomaticRewardRedemptionAdd(conf.userId, async (event) => {
      if (["message_effect", "gigantify_an_emote", "celebration"].includes(event.rewardType))
        await writeRow({
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
