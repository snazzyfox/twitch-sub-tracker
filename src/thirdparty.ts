import io from "socket.io-client";
import { config } from "./config.js";
import { writeRow } from "./gsheet.js";

export default function start() {
  config.forEach((conf) => {
    if (conf.streamlabs?.socketToken) {
      const socket = io(
        `https://sockets.streamlabs.com?token=${conf.streamlabs.socketToken}`,
        { transports: ["websocket"] }
      );
      socket.on("connect", () => {
        console.log(`Connected to streamlabs socket for ${conf.userId}`);
      });
      socket.on("connect_error", (error) => {
        console.log(`Error connecting to streamlabs socket: `, error);
      });
      socket.on("event", ({ type, message }) => {
        if (type === "donation") {
          message.forEach(
            (msg: { amount: string; isTest: boolean; from: string }) => {
              writeRow({
                channel: conf.userName,
                action: "Tip",
                amount: Number(msg.amount),
                user: msg.isTest ? "Streamlabs Test" : msg.from,
                message,
              });
            }
          );
        }
      });
      socket.connect();
    }

    if (conf.streamElements?.jwt) {
      const socket = io("https://realtime.streamelements.com", {
        transports: ["websocket"],
      });
      socket.on("connect", () => {
        socket.emit("authenticate", {
          method: "jwt",
          token: conf.streamElements.jwt,
        });
      });
      socket.on("authenticated", () => {
        console.log(`Connected to streamelements socket for ${conf.userId}`);
      });
      socket.on("unauthorized", console.error);
      socket.on("event", (ev) => {
        if (ev.type === "tip") {
          writeRow({
            channel: conf.userName,
            action: "Tip",
            amount: ev.data.amount,
            user: ev.isMock ? "StreamElements Test" : ev.data.displayName,
            message: ev.data.message,
          });
        }
      });
    }
  });
}
