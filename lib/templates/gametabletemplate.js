/****************************************************************
 *
 * An extension of the Game Engine for special games like
 * Poker or Blackjack where you want to start a game with
 * 2 players, but have open slots on the table that other
 * players can join at a later time. Meanwhile, players can
 * stop playing without ending the game
 *
 *
 ***************************************************************/

let saito = require("../saito/saito");
let GameTemplate = require("./gametemplate");

class GameTableTemplate extends GameTemplate {
  constructor(app) {
    super(app);

    this.opengame = true; //We will use this as a flag for Arcade to distinguish between parent and child class
    this.willjoin = false;
    this.willleave = false;
    this.toJoin = [];
    this.toLeave = [];
    this.scoreFrame = ""; //We are hardcoding scoreboard, but this is a hook to let the game module include information
  }

  initialize(app) {
    super.initialize(app);
    if (app.modules.returnModule("Observer") == null) {
      this.opengame = false;
    }
  }

  initializeGame() {
    //Parse game options
    this.maxPlayers = this.game.options["game-wizard-players-select-max"] || this.maxPlayers;
  }

  initializeHTML(app) {
    super.initializeHTML(app);

    //Add scoreboard button
    let scoreboard_ctrl_html = this.scoreFrame;

    if (this.game.player == 0) {
      //Get rid of default step-through controls
      if (this.observer && this.game.live) {
        this.observer.removeControls();
        this.observer.step_speed = 0;
      }
      if (this.willleave || this.game?.eliminated?.includes(app.wallet.returnPublicKey())) {
        scoreboard_ctrl_html += `<div id="watch" class="table_ctrl">WATCH</div>`;
      } else {
        scoreboard_ctrl_html += `<div id="join" class="table_ctrl">JOIN</div>`;
      }
    } else {
      scoreboard_ctrl_html += `<div id="leave" class="table_ctrl">LEAVE</div>`;
    }

    this.scoreboard.update(scoreboard_ctrl_html, this.controller.bind(this));
  }

  controller() {
    let game_self = this;

    let btn = document.querySelector(".table_ctrl");
    if (btn) {
      btn.onclick = (e) => {
        switch (e.currentTarget.id) {
          case "join":
            game_self.displayWarning(
              "Join game",
              "You will be dealt into the next hand (if there is a free seat)"
            );
            game_self.willjoin = true;
            game_self.scoreboard.update(
              this.scoreFrame + `<div id="cancel" class="table_ctrl">CANCEL</div>`,
              game_self.controller.bind(game_self)
            );
            game_self.sendMetaMessage("JOIN");
            console.log("Click to join");
            break;
          case "leave":
            game_self.displayWarning("Leave game", "You won't be dealt into the next hand");
            game_self.willleave = true;
            game_self.scoreboard.update(
              this.scoreFrame + `<div id="cancel" class="table_ctrl">CANCEL</div>`,
              game_self.controller.bind(game_self)
            );
            game_self.sendMetaMessage("LEAVE");
            break;
          case "cancel":
            game_self.sendMetaMessage("CANCEL");
            if (game_self.willjoin) {
              game_self.willjoin = false;
              game_self.scoreboard.update(
                this.scoreFrame + `<div id="join" class="table_ctrl">JOIN</div>`,
                game_self.controller.bind(game_self)
              );
            } else {
              game_self.willleave = false;
              game_self.scoreboard.update(
                this.scoreFrame + `<div id="leave" class="table_ctrl">LEAVE</div>`,
                game_self.controller.bind(game_self)
              );
            }
            break;
          case "watch":
          //Add code to reload with observer mode
          default:
            console.log(e.currentTarget.id);
        }
      };
    }
  }

  sendMetaMessage(request) {
    let newtx = this.app.wallet.createUnsignedTransactionWithDefaultFee();
    newtx.msg = {
      module: this.name,
      game_id: this.game.id,
      request: request,
      my_key: this.app.wallet.returnPublicKey(),
    };

    for (let i = 0; i < this.game.accepted.length; i++) {
      newtx.transaction.to.push(new saito.default.slip(this.game.accepted[i], 0.0));
    }

    console.log(JSON.parse(JSON.stringify(this.game.accepted)));
    console.log(JSON.parse(JSON.stringify(newtx.msg)));

    newtx = this.app.wallet.signTransaction(newtx);

    this.app.network.propagateTransaction(newtx);
    //Relay too...
    let relay_mod = this.app.modules.returnModule("Relay");
    if (relay_mod) {
      relay_mod.sendRelayMessage(this.game.accepted, "game relay update", newtx);
    }
  }

  //
  // respond to off-chain game moves
  //
  async handlePeerRequest(app, message, peer, mycallback = null) {
    // servers should not make game moves
    if (app.BROWSER == 0) {
      return;
    }

    super.handlePeerRequest(app, message, peer, mycallback);

    if (message.request === "game relay update") {
      if (message.data != undefined) {
        let gametx = new saito.default.transaction(message.data.transaction);

        let gametxmsg = gametx.returnMessage();

        // nope out if game does not exist locally
        if (!this.doesGameExistLocally(gametxmsg.game_id)) {
          console.log(
            "Game does not exist locally. Not processing HPR message: waiting for on-chain"
          );
          return;
        }

        //
        if (this.name === gametxmsg.module) {
          //console.log("Game Peer Request",JSON.parse(JSON.stringify(gametxmsg)));

          if (gametxmsg.game_id) {
            if (this.game.id !== gametxmsg.game_id) {
              this.game = this.loadGame(gametxmsg.game_id);
            }
          } else if (gametxmsg.id) {
            gametxmsg.game_id = gametxmsg.id;
            if (this.game.id !== gametxmsg.id) {
              this.game = this.loadGame(gametxmsg.id);
            }
          }

          if (!this.game?.id || gametxmsg.game_id != this.game.id) {
            return;
          }

          if (gametxmsg.request === "JOIN") {
            console.log("Join request:" + gametxmsg.my_key);
            if (!this.toJoin.includes(gametxmsg.my_key)) {
              this.toJoin.push(gametxmsg.my_key);
              siteMessage(
                `${
                  app.wallet.returnPublicKey() == gametxmsg.my_key
                    ? "You"
                    : app.keys.returnUsername(gametxmsg.my_key)
                } will be dealt in next hand`,
                2500
              );
            }
            console.log(JSON.stringify(this.toJoin));
          }
          if (gametxmsg.request === "LEAVE") {
            console.log("Leave request:" + gametxmsg.my_key);
            if (!this.toLeave.includes(gametxmsg.my_key)) {
              this.toLeave.push(gametxmsg.my_key);
              siteMessage(
                `${
                  app.wallet.returnPublicKey() == gametxmsg.my_key
                    ? "You"
                    : app.keys.returnUsername(gametxmsg.my_key)
                } will leave the table after this hand`,
                2500
              );
            }
          }
          if (gametxmsg.request === "CANCEL") {
            this.toJoin = this.toJoin.filter((key) => key !== gametxmsg.my_key);
            this.toLeave = this.toLeave.filter((key) => key !== gametxmsg.my_key);
            siteMessage(`${app.keys.returnUsername(gametxmsg.my_key)} changed their mind`, 2500);
          }
        }
      }
    }
  }

  addPlayerLate(address) {
    if (!this.addPlayer(address)) {
      return;
    }
    //To add a player after the game started,
    // need to assign this.game.player
    // add key
    if (this.app.wallet.returnPublicKey() === address) {
      this.game.live = 1;
      this.game.player = this.game.players.length;
    }
    this.game.keys.push(address);
  }

  removePlayerFromState(index) {
    console.error("Did you define removePlayerFromState in your game module?");
  }

  addPlayerToState(address) {
    console.error("Did you define addPlayerToState in your game module?");
  }

  processResignation(resigning_player, txmsg) {
    //End game if only two players
    if (this.game.players.length == 2) {
      super.processResignation(resigning_player, txmsg);
      return;
    }

    //Stop receiving game txs
    if (!this.game.players.includes(resigning_player)) {
      console.log(resigning_player + " not in " + JSON.stringify(this.game.players));
      //Player already not an active player, make sure they are also removed from accepted to stop receiving messages
      for (let i = this.game.accepted.length; i >= 0; i--) {
        if (this.game.accepted[i] == player_key) {
          this.game.accepted.splice(i, 1);
        }
      }
      return;
    }

    //Schedule to leave at end of round
    if (!this.toLeave.includes(resigning_player)) {
      this.toLeave.push(resigning_player);
    }
  }

  /**
   * Definition of core gaming logic commands
   */
  initializeQueueCommands() {
    //Take all Game Engine Commands
    super.initializeQueueCommands();

    //Add some more ones
    this.commands.push((game_self, gmv) => {
      if (gmv[0] === "PLAYERS") {
        let change = this.toLeave.length + this.toJoin.length > 0;
        game_self.game.queue.splice(game_self.game.queue.length - 1, 1);
        console.log("Checking player change between rounds");
        console.log(JSON.stringify(this.toLeave), JSON.stringify(this.toJoin));
        for (let pkey of this.toLeave) {
          let i = this.game.players.indexOf(pkey);
          this.removePlayerFromState(i);
          this.removePlayer(pkey);
          this.updateLog(`Player ${i + 1} (${this.app.keys.returnUsername(pkey)}) leaves the table.`);
          if (pkey === this.app.wallet.returnPublicKey()) {
            this.app.connection.emit("arcade-gametable-removeplayer", this.game.id);
          }
        }

        while (this.toJoin.length > 0 && this.game.players.length < this.maxPlayers) {
          let pkey = this.toJoin.shift();
          this.addPlayerToState(pkey);
          this.addPlayerLate(pkey);
          this.updateLog(
            `${this.app.keys.returnUsername(pkey)} joins the table as Player ${this.game.players.length}`
          );
          if (pkey === this.app.wallet.returnPublicKey()) {
            this.app.connection.emit("arcade-gametable-addplayer", this.game.id);
          }
        }

        this.toLeave = [];

        if (change) {
          this.game.halted = 1;

          console.log("!!!!!!!!!!!!!!!!!!!!");
          console.log("!!! GAME UPDATED !!!");
          console.log("!!!!!!!!!!!!!!!!!!!!");
          console.log("My Public Key: " + this.app.wallet.returnPublicKey());
          console.log("My Position: " + this.game.player);
          //console.log("My Share Key: " + this.loadGamePreference(game_id + "_sharekey"));
          console.log("ALL PLAYERS: " + JSON.stringify(this.game.players));
          console.log("ALL KEYS: " + JSON.stringify(this.game.keys));
          console.log("saving with id: " + this.game.id);
          console.log("!!!!!!!!!!!!!!!!!!!!");
          console.log("!!!!!!!!!!!!!!!!!!!!");
          console.log("!!!!!!!!!!!!!!!!!!!!");

          this.saveGame(this.game.id);
          setTimeout(() => {
            this.initialize_game_run = 0;
            this.initializeGameFeeder(this.game.id);
          }, 1000);
          return 0;
        }
      }
      return 1;
    });
  }
}

module.exports = GameTableTemplate;
