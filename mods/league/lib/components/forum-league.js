const ForumLeagueTemplate = require("./forum-league.template");

class ForumLeague {

  constructor(app, mod, league) {

    this.app = app;
    this.mod = mod;
    this.league = league;
  }

  render(app, mod, elem) {
    if (!elem){
      return;
    }
    let forumTopic = elem.querySelector(".forum-topic-image");
    if (forumTopic){
      if (this.league.myRank > 0 && !forumTopic.querySelector(".forum-topic-league")){
        app.browser.addElementToElement(ForumLeagueTemplate(app, mod, this.league),forumTopic);
        this.attachEvents(app, mod, elem);
      }
    }
  }


  attachEvents(app, mod, elem) {
    let league = this.league;
    let el = elem.querySelector(`.forum-topic-league`); 
    if (el){
        el.onclick = function (e) {
        e.stopPropagation();
        let game_sig = e.currentTarget.getAttribute("data-sig");
        if (game_sig == league.id){
          app.connection.emit("view-league-details", game_sig);
        }
      }
      elem.querySelector("a").setAttribute("href","");
    }
  
  }

}

module.exports = ForumLeague;
