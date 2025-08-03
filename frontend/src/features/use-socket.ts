import { Env } from "@/env";
import EventBus from "js-event-bus";
import _ from "lodash";
import { useEffect } from "react";
import { useQueryClient } from "react-query";
import { Socket, io } from "socket.io-client";
import { useUser } from "./user/use-user";

let ready = false;
let joined: { room: string }[] = [];
let socket: Socket | null = null;

export const websocketBus = new EventBus();

websocketBus.on("join", (event) => {
  if (!ready) joined.push(event);
});
websocketBus.on("leave", (event) => {
  if (!ready) joined = joined.filter((j) => j !== event);
});

export const useWebSockets = () => {
  const { user } = useUser();

  const queryClient = useQueryClient();

  useEffect(() => {
    if (user?.data?.id) {
      let server = Env.server.replace(/\/$/, "");
      if (!server.match(/:[0-9]+$/)) {
        server = server + (server.includes("https://") ? ":443" : ":80");
      }
      socket = io(server + "/websockets", {
        auth: {
          token: localStorage.getItem("token"),
        },
      });

      // Event Update, and Object AssignmentType
      // Need to be either generic or passed as props
      socket.on("message", (event: any) => {
        // Handle incoming messages - correctly pass through the websocket bus
        try {
          // If event is already parsed as object, use it directly
          const data = typeof event === "string" ? JSON.parse(event) : event;
          const room = data.room;
          const eventType = data.event;

          console.log(`Socket received: ${eventType}`, data);

          if (eventType) {
            websocketBus.emit(eventType, null, data);
          }

          if (room) {
            websocketBus.emit(room, null, data);
          }
        } catch (e) {
          console.error("Error processing WebSocket message:", e);
        }
      });

      socket.on("connect", () => {
        ready = true;
        console.log("websockets connected");

        websocketBus.detach("join"); //Detach buffer
        websocketBus.on("join", (event) => {
          joined.push(event);
          if (socket) socket.emit("join", event.room);
        });

        websocketBus.detach("leave"); //Detach buffer
        websocketBus.on("leave", (event) => {
          joined = joined.filter((j) => j !== event);
          if (socket) socket.emit("leave", event.room);
        });

        joined = _.uniqBy(joined, "room");
        joined.forEach((event) => socket && socket.emit("join", event.room));
      });

      socket.on("disconnect", () => {
        ready = false;
        console.log("websockets disconnected");
      });
    } else {
      socket?.close();
      socket = null;
    }

    return () => {
      socket?.close();
      socket = null;
    };
  }, [user?.data?.id]);

  useEffect(() => {
    if (user?.data?.id) {
      websocketBus.emit("join", null, { room: `private/${user?.data?.id}` });
    }

    websocketBus.on("credits", (event) => {
      // Edit the "user" queryclient data with event.data.credits
      if (event?.data?.credits)
        queryClient.setQueryData("user", (old: any) => {
          return {
            ...old,
            credits: event.data.credits,
          };
        });
    });
  }, [user?.data?.id, queryClient]);
};
