const saito = require('./../../lib/saito/saito');
const ModTemplate = require('../../lib/templates/modtemplate');
const CryptoOverlay = require('./lib/overlay/main');

class Crypto extends ModTemplate {

  constructor(app) {

    super(app);

    this.appname = "Crypto";
    this.name = "Crypto";
    this.description = "Modifies the Game-Menu to add an option for managing in-game crypto";
    this.categories = "Utility Entertainment";

    this.overlay = new CryptoOverlay(app, this);

  }
  
  respondTo(type = "") {
    if (type == "game-menu") {

      //
      // only show if games are winable
      //
      let gm = this.app.modules.returnActiveModule();
      if (gm.winable == 0) { return null; }
      if (gm.cooperative == 1) { return null; }
      if (gm.losable == 0) { return null; }

      let ac = this.app.wallet.returnActivatedCryptos();
      let cm = this;
      let menu = { id: "game-crypto",
                   text: "Crypto",
                   submenus: []};

      for (let i = 0; i < ac.length; i++) {
      	menu.submenus.push({
          text : ac[i].ticker,
          id : "game-crypto-"+ac[i].ticker,
          class : "game-crypto-ticker",
          callback : async function(app, game_mod) {
            game_mod.menu.hideSubMenus();
      	    cm.enableCrypto(game_mod, game_mod.game.id, ac[i].ticker);
          }
        });
      }
      return menu;
    }

    return super.respondTo(type);
  }


  enableCrypto(game_mod, game_id, ticker) {

    if (game_mod.game.crypto != "") {
      alert("Exiting: crypto already enabled for this game!");
      return;
    }

    //
    // restore original pre-move state
    //
    // this ensures if we are halfway through a move that we will
    // return to the game in a clean state after we send the request
    // to our opponent for shifting game modes.
    //
    game_mod.game = game_mod.game_state_pre_move;
    game_mod.game.turn = [];
    game_mod.moves = [];
    game_mod.proposeGameStake(ticker, "100");

  }

}

module.exports = Crypto;

