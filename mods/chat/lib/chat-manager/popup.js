const SaitoEmoji = require("../../../../lib/saito/new-ui/saito-emoji/saito-emoji");
const ChatPopupTemplate = require("./popup.template");

class ChatPopup {

  constructor(app, mod) {
    this.app = app;
    this.mod = mod;

    this.emoji = new SaitoEmoji(app, mod, `chat-input`);
    this.minimized = false;

    //Each ChatPopup has listeners so we need to only act if it is for us
    app.connection.on("chat-render-request", (gid) => {
      if (gid) {
        if (!mod.mute){
          let at = this.activeTab();
          if (!at || at == gid){
            if (!this.minimized){
              this.render(app, mod, gid);
              return;              
            }
          }else{
            if (!document.getElementById(`chat-group-${gid}`)){
              this.insertBackgroundTab(app, mod, gid);
            }
          }  
        }
        app.connection.emit("chat-render-request-notify", mod.returnGroup(gid));        
      }
    });

    app.connection.on("chat-render-request-notify", (chat_group)=>{
      if (chat_group?.id && (chat_group.id != this.activeTab() || this.minimized) ) {
        let tab = document.getElementById(`chat-group-${chat_group.id}`);
        if (tab && chat_group?.unread){
          tab.innerHTML = `${chat_group.name}<div class="saito-notification-counter">${chat_group.unread}</div>`;
        }
      }
    });

  }

  activeTab(){
    let tab = document.querySelector(".active-chat-tab");
    if (tab){
      return tab.getAttribute("id")?.replace("chat-group-", "");
    }
    return null;
  }

  render(app, mod, group_id = "") {

    if (!group_id){ return; }
    let group = mod.returnGroup(group_id);

    if (this.minimized){
      this.toggleDisplay();
    }

    if (!document.getElementById(`chat-container`)) {
      app.browser.addElementToDom(ChatPopupTemplate(app, mod, group));
      app.browser.makeDraggable(`chat-container`, `chat-header`, true);

      this.emoji.render(app, mod);

    }else{
      //Deactivate other tabs
      let activeTab = document.querySelector(".active-chat-tab");
      if (activeTab){
        activeTab.classList.remove("active-chat-tab");
      }

      if (document.getElementById(`chat-group-${group_id}`)){
        //Update tab
        document.getElementById(`chat-group-${group_id}`).innerHTML = group.name;
        document.getElementById(`chat-group-${group_id}`).classList.add("active-chat-tab");
        //Load chat messages
        app.browser.replaceElementBySelector(`<div class="chat-body">${mod.returnChatBody(group_id)}</div>`, `#chat-container .chat-body`);
      }else{
        let tabContainer = document.querySelector(".chat-group-tabs");
        if (tabContainer){
          tabContainer.classList.add("show-multi");
        }

        //Insert new tab
        app.browser.addElementToSelector(`<div id="chat-group-${group_id}" class="chat-group active-chat-tab">${group.name}</div>`, ".chat-group-tabs");
        app.browser.replaceElementBySelector(`<div class="chat-body">${mod.returnChatBody(group_id)}</div>`, `#chat-container .chat-body`);
      }

    } 

    app.connection.emit("refresh-chat-groups");
    document.querySelector(".chat-body").scroll(0, 1000000000);
    this.attachEvents(app, mod);
      
  }

  insertBackgroundTab(app, mod, gid){
    let tabContainer = document.querySelector(".chat-group-tabs");
    if (tabContainer){
      tabContainer.classList.add("show-multi");
    }

    let group = mod.returnGroup(gid);

    //Insert new tab
    app.browser.addElementToSelector(`<div id="chat-group-${gid}" class="chat-group">${group.name}</div>`, ".chat-group-tabs");
    this.attachEvents(app, mod);

  }

  attachEvents(app, mod) {

    let group_id = this.activeTab();

    //
    // close
    //
    document.querySelector(`#chat-container-close`).onclick = (e) => {
      this.minimized = false;
      mod.mute = true;
      document.getElementById(`chat-container`).remove();

      app.options.auto_open_chat_box = -1;
      app.storage.saveOptions();
    }

    //
    // minimize
    //
    let chat_bubble = document.getElementById(`chat-container-minimize`);
    if (chat_bubble){
      chat_bubble.onclick = (e) =>{
        this.toggleDisplay();
      }
    }

    //
    // focus on text input
    //
    if (!mod.isOtherInputActive()){
      document.getElementById("chat-input").focus();
    }

    //
    // submit
    //
    let msg_input = document.getElementById("chat-input");

    msg_input.onkeydown = (e) => {
      if ((e.which == 13 || e.keyCode == 13) && !e.shiftKey) {
        e.preventDefault();
        if (msg_input.value == "") { return; }
        let newtx = mod.createChatTransaction(group_id, msg_input.value);
        mod.sendChatTransaction(app, newtx);
        mod.receiveChatTransaction(app, newtx);
        msg_input.value = "";
      }
    }

    //
    // submit (button)
    //
    document.getElementById("chat-input-submit").onclick = (e) => {
      e.preventDefault();
      if (msg_input.value == "") { return; }
      let newtx = mod.createChatTransaction(group_id, msg_input.value);
      mod.sendChatTransaction(app, newtx);
      mod.receiveChatTransaction(app, newtx);
      msg_input.value = "";
    }

    //
    // View Other tab
    //
    Array.from(document.getElementsByClassName("chat-group")).forEach((tab) =>{
      if (!tab.classList.contains("active-chat-tab")){
        tab.onclick = (e) => {
          let id = e.currentTarget.getAttribute("id");
          id = id.replace("chat-group-", "");

          this.app.options.auto_open_chat_box = id;
          this.app.storage.saveOptions();

          this.render(this.app, this.mod, id);
        };
      }
    });

  }

  toggleDisplay(){
    let chat_bubble = document.getElementById(`chat-container-minimize`);
    if (chat_bubble){
      chat_bubble.parentElement.parentElement.classList.toggle("minimize");
      chat_bubble.parentElement.parentElement.removeAttribute("style");
      chat_bubble.innerHTML = "";

      this.minimized = !this.minimized;

      //Upon restoring chat popup, resend message to render
      if (!this.minimized){
        this.render(this.app, this.mod, this.activeTab());
      }

    }

  }

}

module.exports = ChatPopup;

