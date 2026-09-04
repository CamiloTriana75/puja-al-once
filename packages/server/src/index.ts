import config from "@colyseus/tools";
import { AuctionRoom } from "./AuctionRoom.js";

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define("auction", AuctionRoom);
  },
});
