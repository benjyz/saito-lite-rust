const saito = require('./../../../lib/saito/saito');
const RedSquareTweetTemplate = require("./tweet.template");
const LinkPreview = require("./link-preview");
const ImgPreview = require("./img-preview");
const PostTweet = require("./post");
const JSON = require('json-bigint');

class RedSquareTweet {

  constructor(app, mod, container = "", tx=null) {

    this.app = app;
    this.mod = mod;
    this.container = container;
    this.name = "RedSquareTweet";

    this.tx = tx;
    let txmsg = tx.returnMessage();

    this.parent_id = "";
    this.thread_id = "";
    this.updated_at = 0;

    this.children = [];
    this.children_sigs_hmap = {};
    this.unknown_children = [];
    this.unknown_children_sigs_hmap = {};
    this.critical_child = null;

    this.retweet = null;
    this.retweeters = [];
    this.retweet_tx = null;
    this.retweet_tx_sig = null;
    this.links = [];
    this.link = null;

    this.link_properties = null;
    this.show_controls = 1;

    this.setKeys(tx.msg.data);
    this.setKeys(tx.optional);

    //
    // this.text <== set by setKeys
    // this.images <== set by setKeys
    //
  
    //
    // do we have a link?
    //
    let expression = /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi;
    this.link = null;
    if (this.text) {
      this.links = this.text.match(expression);
    }
    if (this.links.length > 0) { this.link = this.links[0]; }

    //
    // create retweet if exists
    //
    if (this.retweet != null) {
      let newtx = new saito.default.transaction(JSON.parse(this.retweet_tx));
      this.retweet = new RedSquareTweet(this.app, this.mod, `.tweet-preview-${this.tx.transaction.sig}`, newtx);
    } else {
      //
      // create image preview if exists
      //
      if (this.images?.length > 0) {
        this.img_preview = new ImgPreview(this.app, this.mod, `.tweet-${this.tx.transaction.sig} .tweet-body .tweet-main .tweet-preview`, this);
      } else {
        //
        // create link preview if exists
        //
        if (this.link != null) {
          this.link_preview = new LinkPreview(this.app, this.mod, `.tweet-${this.tx.transaction.sig} .tweet-body .tweet-main .tweet-preview`, this);
        }
      }
    }

    this.generateTweetProperties(app, mod, 1);

  }

  render() {

    let myqs = `.tweet-${this.tx.transaction.sig}`;

    //
    // replace or add
    //
    if (document.querySelector(myqs)) {
       this.app.browser.replaceElementBySelector(RedSquareTweetTemplate(this.app, this.mod, this), myqs);
    } else {
      this.app.browser.addElementToSelector(RedSquareTweetTemplate(this.app, this.mod, this), this.container);
    }

    if (this.retweet != null) {
      this.retweet.render();
    }
    if (this.img_preview != null) {
      this.img_preview.render();
    }
    if (this.link_preview != null) {
      this.link_preview.render();
    }

    this.attachEvents();

  }

  attachEvents() {

    if (this.show_controls == 0) { return; }

    try {

    ///////////
    // reply //
    ///////////
    document.querySelector(`.tweet-${this.tx.transaction.sig} .tweet-body .tweet-main .tweet-controls .tweet-tool-comment`).onclick = (e) => {

      e.preventDefault();
      e.stopImmediatePropagation();
        
      let tweet_sig = e.currentTarget.parentNode.parentNode.parentNode.parentNode.getAttribute("data-id");
      if (tweet_sig != null) {

        let post = new PostTweet(this.app, this.mod, this);
        post.parent_id = tweet_sig;
        post.source = 'Reply';
        post.render();
        this.app.browser.prependElementToSelector(`<div id="post-tweet-preview-${tweet_sig}" class="post-tweet-preview" data-id="${tweet_sig}"></div>`, ".redsquare-tweet-overlay");

        let newtx = new saito.default.transaction(JSON.parse(JSON.stringify(this.tx.transaction)));
	newtx.transaction.sig = this.app.crypto.hash(newtx.transaction.sig);
        let new_tweet = new RedSquareTweet(this.app, this.mod, `#post-tweet-preview-${tweet_sig}`, newtx);
        new_tweet.show_controls = 0;
        new_tweet.render();

      }
    };


    /////////////
    // retweet //
    /////////////
    document.querySelector(`.tweet-${this.tx.transaction.sig} .tweet-body .tweet-main .tweet-controls .tweet-tool-retweet`).onclick = (e) => {

      e.preventDefault();
      e.stopImmediatePropagation();
        
      let tweet_sig = e.currentTarget.parentNode.parentNode.parentNode.parentNode.getAttribute("data-id");
      if (tweet_sig != null) {

        let post = new PostTweet(this.app, this.mod, this);
        post.parent_id = tweet_sig;
        post.source = 'Retweet / Share';
        post.render();
        this.app.browser.prependElementToSelector(`<div id="post-tweet-preview-${tweet_sig}" class="post-tweet-preview" data-id="${tweet_sig}"></div>`, ".redsquare-tweet-overlay");

        let newtx = new saito.default.transaction(JSON.parse(JSON.stringify(this.tx.transaction)));
	newtx.transaction.sig = this.app.crypto.hash(newtx.transaction.sig);
        let new_tweet = new RedSquareTweet(this.app, this.mod, `#post-tweet-preview-${tweet_sig}`, newtx);
        new_tweet.show_controls = 0;
        new_tweet.render();

      }
    };

    } catch (err) {

    }

  }


  setKeys(obj) {
    for (let key in obj) {
      if (typeof obj[key] !== 'undefined') {
        if (this[key] === 0 || this[key] === "" || this[key] === null) {
          this[key] = obj[key];
        }
      }
    }
  }



  addTweet(tweet, levels_deep=0) {

    //
    // still here? add in unknown children
    //
    // this means we know the comment is supposed to be somewhere in this thread/parent
    // but its own parent doesn't yet exist, so we are simply going to store it here
    // until we possibly add the parent (where we will check all unknown children) for
    // placement then.
    //
    this.unknown_children.push(tweet);
    this.unknown_children_sigs_hmap[tweet.tx.transaction.sig] = 1;

    //
    // if this tweet is the parent-tweet of a tweet we have already downloaded
    // and indexed here. this can happen if tweets arrive out-of-order.
    //
    for (let i = 0; i < this.unknown_children.length; i++) {
      if (this.unknown_children[i].parent_id === tweet.tx.transaction.sig) {

        if (this.isCriticalChild(this.unknown_children[i])) {
          this.critical_child = this.unknown_children[i];
          this.updated_at = this.critical_child.updated_at;
        }
        this.unknown_children[i].parent_tweet = tweet;

	//
	// tweet adds its orphan
	//
        tweet.addTweet(this.unknown_children[i], (levels_deep+1));

	//
	// and delete from unknown children
	//
        if (this.unknown_children_sigs_hmap[this.unknown_children[i].tx.transaction.sig]) {
	  delete this.unknown_children_sigs_hmap[this.unknown_children[i].tx.transaction.sig];
        }
        this.unknown_children.splice(i, 0);
      }
    }

    //
    // tweet is direct child
    //
    if (tweet.parent_id == this.tx.transaction.sig) {

      //
      // already added?
      //
      if (this.children_sigs_hmap[tweet.tx.transaction.sig]) {
        return 0;
      }

      //
      // make critical child if needed
      //
      if (this.isCriticalChild(tweet) || tweet.tx.transaction.ts > this.updated_at && this.critical_child == null) {
        this.critical_child = tweet;
        this.updated_at = tweet.updated_at;
      }

      //
      // prioritize tweet-threads
      //
      if (tweet.tx.transaction.from[0].add === this.tx.transaction.from[0].add) {
        this.children.unshift(tweet);
	this.children_sigs_hmap[tweet.tx.transaction.sig] == 1;
        return 1;
      } else {
        tweet.parent_tweet = this;
        this.children.push(tweet);
	this.children_sigs_hmap[tweet.tx.transaction.sig] == 1;
        return 1;
      }

    //
    // tweet belongs to a child
    //
    } else {

      //
      // maybe it is a critical child
      //
      if (this.isCriticalChild(tweet)) {
        this.critical_child = tweet;
      }

      if (this.children_sigs_hmap[tweet.parent_id]) {

        for (let i = 0; i < this.children.length; i++) {
          if (this.children[i].addTweet(tweet, (levels_deep+1))) {
	    this.children_sigs_hmap[tweet.tx.transaction.sig] = 1;
            this.updated_at = tweet.updated_at;
            return 1;
          }
        }

      } else {

        //
        // if still here, add to unknown children if top-level as we didn't add to any children
        //
        if (levels_deep == 0) {
          this.unknown_children.push(tweet);
          this.unknown_children_sigs_hmap[tweet.tx.transaction.sig] = 1;
        }

      }
    }
  }


  isCriticalChild(tweet) {
    for (let i = 0; i < tweet.tx.transaction.to.length; i++) {
      if (tweet.tx.transaction.to[i].add === this.app.wallet.returnPublicKey()) {
        if (this.critical_child == null) { return true; }
        if (tweet.tx.transaction.ts > this.critical_child.tx.transaction.tx) {
          return true;
        }
      }
    }
    return false;
  }


  async generateTweetProperties(app, mod, fetch_open_graph = 0) {

    if (this.text == null) { return this; }

    let expression = /(https?:\/\/(?:www\.|(?!www))[^\s\.]+\.[^\s]{2,}|www\.[^\s]+\.[^\s]{2,})/gi;
    let links = this.text.match(expression);

    if (links != null && links.length > 0) {

      //
      // save the first link
      //
      let link = new URL(links[0]);
      this.link = link.toString();

      //
      // youtube link
      //
      if (this.link.indexOf("youtube.com") != -1 || this.link.indexOf("youtu.be") != -1) {
        let videoId = "";

        if (this.link.indexOf("youtu.be") != -1) {
          videoId = (this.link.split("/"));
          videoId = videoId[videoId.length - 1];
        } else {
          let urlParams = new URLSearchParams(link.search);
          videoId = urlParams.get('v');
        }

        this.youtube_id = videoId;
        return this;
      }

      //
      // normal link
      //
      if (fetch_open_graph == 1) {
        let res = await mod.fetchOpenGraphProperties(app, mod, this.link);
        
        if (res != '') {
          this.link_properties = res;
        }
      }

      return this;

    }

    return this;

  }




}

module.exports = RedSquareTweet;

