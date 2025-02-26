const JSON = require("json-bigint");

const ArcadeMainTemplate = require("./main.template");
const SaitoCarousel = require("./../../../../lib/saito/ui/saito-carousel/saito-carousel");
const ArcadeInviteTemplate = require("./arcade-invite.template");

const SaitoSidebar = require('./../../../../lib/saito/new-ui/saito-sidebar/saito-sidebar');
const ArcadeMenu = require("./menu");

const ArcadeBanner = require("./arcade-banner");
const ArcadeLeaderboard = require("./meta-leaderboard"); //require("./arcade-leaderboard");
const ArcadeLeague = require("./arcade-league");

class ArcadeMain {
  constructor(app, mod){

    this.app = app;
    this.mod = mod;

    //
    // left sidebar
    //
    this.sidebar = new SaitoSidebar(app, mod, ".saito-sidebar-left");
    this.sidebar.align = "nope";

    //Add Menu to Sidebar
    this.menu = new ArcadeMenu(app, mod);
    this.sidebar.addComponent(this.menu);
    
    //Add Chat Manager as Service to Sidebar
    app.modules.respondTo("chat-manager").forEach(m => {
      this.sidebar.addComponent(m.respondTo("chat-manager"));
    });

    this.banner = new ArcadeBanner(app, mod);
    this.leaderboard = null;
    this.userLeagues = null;

  }

  render(app, mod) {
    // avoid rendering over inits
    if (mod.viewing_arcade_initialization_page == 1 || !mod.browser_active || !app.BROWSER) {
      return;
    }

    if (!document.querySelector("#saito-container")) {
      app.browser.addElementToDom(ArcadeMainTemplate(app, mod));
    }else{
      app.browser.replaceElementById(ArcadeMainTemplate(app, mod), "saito-container");
    }

    //Check hash for game page
    var hash = window.location.hash;
    if (hash){
      hash = hash.substring(1).toLowerCase();
      mod.viewing_game_homepage = hash[0].toUpperCase() + hash.substring(1);
    }else{
      mod.viewing_game_homepage = "Arcade";
    }


    this.sidebar.render(app, mod);
    this.banner.render(app, mod);
    if (app.modules.returnModule("League")){
      if (!this.leaderboard){
        this.leaderboard = new ArcadeLeaderboard(app, mod);
      }
      this.leaderboard.render(app, mod);

      if (!this.userLeagues){
        this.userLeagues = new ArcadeLeague(app, mod);
      }
      this.userLeagues.render(app, mod);
    }

    //
    // add games
    //
    this.renderArcadeTab(app, mod);

    let game_filter = (mod.viewing_game_homepage == mod.name) ? "" : mod.viewing_game_homepage;
    app.connection.emit("observer-render-arcade-tabs", {selector: "observer-live-hero", game_filter, live_games: true});
    app.connection.emit("observer-render-arcade-tabs", {selector: "observer-review-hero", game_filter, live_games: false});
  }


  renderArcadeTab(app, mod){
    //No Service modules
    if (!app.BROWSER){ return; }

    //Announce to active module
    if (mod.browser_active == 0 || mod.viewing_arcade_initialization_page == 1) {
      //so any function in Arcade that triggers a refresh of the invite list
      //will notify the active module that maybe you want to update the DOM
      app.connection.emit('game-invite-list-update');
      return;
    }

    // put active games first
    let whereTo = 0;
    for (let i = 0; i < mod.games.length; i++) {
      if (mod.isMyGame(mod.games[i], app)) {
        mod.games[i].isMine = true;
        let replacedGame = mod.games[whereTo];
        mod.games[whereTo] = mod.games[i];
        mod.games[i] = replacedGame;
        whereTo++;
      } else {
        mod.games[i].isMine = false;
      }
    }


    let numGamesDisplayed = 0;
    let tab = document.getElementById("arcade-hero");
    let league = app.modules.returnModule("League");

    if (tab) {
      tab.innerHTML = "";


      //On initial load of Arcade, it takes a while for Leagues array to get populated
      //so need some way to refresh the arcade game invites...
      let visibleLeagues = (league) ? league.filterLeagues(app) : "";

      mod.games.forEach((invite, i) => {
        if (mod.viewing_game_homepage == "Arcade" || invite.msg.game === mod.viewing_game_homepage) {
          //console.log("INVITE: " + JSON.stringify(invite) + " -- " + mod.name);
          let includeGame = true;
          
          //Only filter if there are leagues to compare against
          if (league && league.leagues.length > 0){
            //Do some extra checking to see if we should make this game invite visible based on leagues
            if (invite.msg.options.league){
              includeGame = false;
              for (let l of visibleLeagues){
                if (l.id == invite.msg.options.league){
                  includeGame = true;
                }
              }
            }
          }

          if (invite.msg?.options["game-wizard-players-select-max"] == invite.msg.players.length){
            includeGame = false;
          }

          //isMyGame is a decent safety catch for ongoing games
          if (includeGame || mod.isMyGame(invite, app)){
            numGamesDisplayed++;
            app.browser.addElementToElement(ArcadeInviteTemplate(app, mod, invite, i), tab);    
          }
        }
      });

      if (mod.viewing_game_homepage == "Arcade" && numGamesDisplayed == 0) {
        let observer = app.modules.returnModule("Observer");
        if (!observer || observer.games.length == 0){
          let carousel = new SaitoCarousel(app);
          carousel.render(app, "arcade-hero");
          if (mod.viewing_game_homepage === mod.name) {
              carousel.addLeaves(app);
          }
        }
      }

    }
    

    this.attachEvents(app, mod);
  }

  attachEvents(app, mod) {
    
    //
    // game invitation actions
    //
    let arcade_main_self = this;
    mod.games.forEach((invite, i) => {
      try {
        document.querySelectorAll(`#invite-${invite.transaction.sig} .invite-tile-button`)
          .forEach((el, i) => {
            el.onclick = function (e) {
              let game_sig = e.currentTarget.getAttribute("data-sig");
              let game_cmd = e.currentTarget.getAttribute("data-cmd");

              app.browser.logMatomoEvent("Arcade", "ArcadeAcceptInviteButtonClick", game_cmd);

              if (game_cmd === "cancel") {
                if (app.wallet.returnPublicKey() !== invite.msg.originator || invite.msg.players.length >= invite.msg.players_needed){
                  let c = confirm("Are you sure you want to cancel this game?");
                  if (c) {
                      mod.cancelGame(game_sig);
                      return;
                  }
                }else{
                  mod.cancelGame(game_sig);                  
                }

              }

              if (game_cmd === "join") {
                  mod.joinGame(game_sig);
                  return;
              }

              if (game_cmd === "continue") {
                mod.continueGame(game_sig);
                return;
              }

              if (game_cmd === "watch"){
                app.connection.emit("arcade-observer-join-table", game_sig);
                return;
              }

              if (game_cmd === "invite") {
                arcade_main_self.privatizeGame(app, mod, game_sig);
                return;
              }
              if (game_cmd === "publicize") {
                arcade_main_self.publicizeGame(app, mod, game_sig);
                return;
              }

            };
          });
      } catch (err) {
        console.error(err);
      }
    });


    mod.games.forEach((invite, i) => {
      let linkBtn = document.querySelector(`#invite-${invite.transaction.sig} .link_icon`);
      if (linkBtn){
        linkBtn.onclick = () => {
          mod.showShareLink(invite.transaction.sig);
        };
      }
    });
    
  }


  privatizeGame(app, mod, game_sig) {
    console.log(JSON.parse(JSON.stringify(mod.games)));

    let accepted_game = null;
    mod.games.forEach((g) => {
      if (g.transaction.sig === game_sig) {
        accepted_game = g;
      }
    });
    if (accepted_game) {
      console.log("Game in my open list");
      let newtx = mod.createChangeTransaction(accepted_game, "private");
      app.network.propagateTransaction(newtx);
      app.connection.emit("send-relay-message", {recipient:"PEERS", request:"arcade spv update", data:newtx});

    }

    //Update status of the game invitation
    Array.from(document.querySelectorAll(`#invite-${game_sig} .invite-tile-button`)).forEach(button => {
      let game_cmd = button.getAttribute("data-cmd");
      if (game_cmd == "invite") {
        button.setAttribute("data-cmd", "publicize");
        button.textContent = "PRIVATE";
      }
    });
  }

  publicizeGame(app, mod, game_sig) {
    let accepted_game = null;
    mod.games.forEach((g) => {
      if (g.transaction.sig === game_sig) {
        accepted_game = g;
      }
    });
 

    if (accepted_game) {
      console.log("Game in my open list");
      let newtx = mod.createChangeTransaction(accepted_game, "open");
      app.network.propagateTransaction(newtx);

      let relay_mod = app.modules.returnModule("Relay");
      if (relay_mod != null) {
        let peers = [];
        for (let i = 0; i < app.network.peers.length; i++) {
          peers.push(app.network.peers[i].returnPublicKey());
        }
        relay_mod.sendRelayMessage(peers, "arcade spv update", newtx);
      }
 
    }
  
    //Update status of the game invitation
    Array.from(document.querySelectorAll(`#invite-${game_sig} .invite-tile-button`)).forEach(button => {
      let game_cmd = button.getAttribute("data-cmd");
      if (game_cmd == "publicize") {
        button.setAttribute("data-cmd", "invite");
        button.textContent = "PUBLIC";
      }
    });
  }


}

module.exports = ArcadeMain;