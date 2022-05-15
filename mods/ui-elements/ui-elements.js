const AppTemplate = require("../../lib/templates/apptemplate");
const SaitoHeader = require("../../lib/saito/ui/saito-header/saito-header");
const UI_ELEMENTS_TEMPLATE = require('./templates/ui-elements-template.js');
const TABS_TEMPLATE = require('./templates/tab_templates');
const HEADER_TEMPLATE = require('./templates/header_template');
const BUTTON_TEMPLATE = require('./templates/button_templates');
const CAROUSEL_TEMPLATE = require("./templates/carousel_templates");
const COLUMN_TEMPLATE = require("./templates/column_templates");
const CARD_TEMPLATE = require("./templates/card_templates");
const READ_MORE_TEMPLATE = require("./templates/readmore_templates");
const DIVIDER_TEMPLATE = require("./templates/divider_templates");
const DATE_TEMPLATE = require("./templates/date_templates");
const SELECT_TEMPLATE = require("./templates/select_templates");
const MODAL_TEMPLATE = require("./templates/modal_templates");
const ICON_TEMPLATE = require('./templates/icon_templates');
const ALERT_TEMPLATE = require("./templates/alert_templates")
const GALLERY_TEMPLATE = require("./templates/gallery_templates")
const HEADING_TEMPLATE = require("./templates/heading_templates")
const TOGGLE_TEMPLATE = require("./templates/toggle_templates")
const RADIO_TEMPLATE = require("./templates/radio_templates")
const FORM_TEMPLATE = require("./templates/form_templates")
const TABLE_TEMPLATE = require("./templates/table_templates")


class UI_ELEMENTS extends AppTemplate {




  constructor(app) {

    super(app);
    this.parameters['display'] = "grid";
    this.name = "ui-elements";

    this.description = "Re-usabale elements are here";
    this.categories = "Design";
    this.chat = null;
    // this.events = ["chat-render-request"];
    // this.icon_fa = "fas fa-code";

    this.header = null;


    // this.emails = {};
    // this.emails.inbox = [];
    // this.emails.output = [];
    // this.emails.trash = [];

    this.pages = {
      tabs: {
        heading: 'Tabs',
        subheading: 'Revolutionalize the way Tabs look',
        html: TABS_TEMPLATE(app),
      },
      buttons: {
        heading: 'Buttons',
        subheading: "",
        html: BUTTON_TEMPLATE(app)
      },
      carousels: {
        heading: "Carousel",
        subheading: "",
        html: CAROUSEL_TEMPLATE(app)
      },

      grid: {
        heading: "Columns and grids",
        subheading: "",
        html: COLUMN_TEMPLATE(app)

      },
      'read-more': {
        heading: "Read More",
        subheading: "",
        html: READ_MORE_TEMPLATE(app)
      },
      'cards': {
        heading: "lists and Cards",
        subheading: "",
        html: CARD_TEMPLATE(app)
      },
      forms: {
        heading: "Forms and Inputs",
        subheading: "",
        html: FORM_TEMPLATE(app)
      },
      tables: {
        heading: "Forms and Inputs",
        subheading: "",
        html: TABLE_TEMPLATE(app)
      },
      modals: {
        heading: 'Modals',
        subheading: "",
        html: MODAL_TEMPLATE(app)
      },
      dividers: {
        heading: 'Dividers',
        subheading: "",
        html: DIVIDER_TEMPLATE(app)
      },

      'date-time': {
        heading: 'Date and Time pickers',
        subheading: "",
        html: DATE_TEMPLATE(app)
      },
      "input-select": {
        heading: 'Select Boxes',
        subheading: "",
        html: SELECT_TEMPLATE(app)
      },
      "icons": {
        heading: "Icons",
        subheading: "",
        html: ICON_TEMPLATE(app)
      },
      "alerts": {
        heading: "Alert",
        subheading: "",
        html: ALERT_TEMPLATE(app)
      },

      "gallery": {
        heading: "Gallery",
        subheading: "",
        html: GALLERY_TEMPLATE(app)
      },
      "headings": {
        heading: "Heading",
        html: HEADING_TEMPLATE(app)
      },
      toggles: {
        heading: "Toggles",
        subheading: "",
        html: TOGGLE_TEMPLATE(app)
      },
      radios: {
        heading: "Radios",
        subheading: "",
        html: RADIO_TEMPLATE(app)
      }



    }

  }



  initialize(app) {
    // const stylesheets = ["/ui-elements/font-icons.css", "/ui-elements/animate.css", "/ui-elements/magnific-popup.css"]; // In order of css specificity: increases in specificity from left to right;
    const stylesheets = [];
    const scripts = ["/saito/lib/scripts/plugins.min.js", "/saito/lib/scripts/functions.js"];
    const meta = []

    super.initialize(app, meta, stylesheets, scripts);


  }

  initializeHTML(app, additionalURL) {

    super.initializeHTML(app, additionalURL);




  }









  render(app) {
    if (app.BROWSER != 1 || this.browser_active != 1) {
      return;
    }

    super.render(app);

    const to_display = this.parameters['display'];

    try {
      const html = this.pages[to_display].html;

      const pageContent = document.querySelector('.main-content');
      pageContent.innerHTML = html;

    }
    catch (error) {
      console.log(error);
    }



  }


  attachEvents(app) {
    const self = this;
    const listener2 = $('#render_arcade').on('click', function (e) {
      const app_mod = app.modules.returnModule("App");
      const arcade_mod = app.modules.returnModule("Arcade");

      app_mod.render(app, arcade_mod);
      self.eventListeners.push({ type: 'click', listener2 });
    });


    document.querySelectorAll('.big-menu-link').forEach(link => {
      link.addEventListener('click', function () {

        const app_mod = app.modules.returnModule("App");
        const ui_mod = app.modules.returnModule("ui-elements");

        const url = this.getAttribute('data-url');
        const route = this.getAttribute('data-route');

        if (route) {
          const mod = app.modules.returnModule(route);
          app_mod.render(app, mod, route);
        } else if (url) {
          console.log(ui_mod, url, this);
          ui_mod.parameters['display'] = url.split("=")[url.split('=').length - 1];
          ui_mod.render(app);

        }

      })
    })
    document.querySelectorAll('.breadcrumb-link').forEach(link => {
      link.addEventListener('click', function () {

        const app_mod = app.modules.returnModule("App");
        const ui_mod = app.modules.returnModule("ui-elements");

        const url = this.getAttribute('data-url');
        const route = this.getAttribute('data-route');

        if (route) {
          const mod = app.modules.returnModule(route);
          app_mod.render(app, mod, route);
        } else if (url) {
          console.log(ui_mod, url, this);
          ui_mod.parameters['display'] = url.split("=")[url.split('=').length - 1];
          ui_mod.render(app);

        }
        self.toggleMenu();

      })
    })

    document.querySelector(".switch").addEventListener('click', (e) => {
      e.preventDefault();
      console.log('toggling dark mode')
      const slider = document.querySelector(".slider");
      console.log(slider.classList.contains("checked"));
      const app_mod = app.modules.returnModule("App");

      app_mod.toggleDarkMode();
      // self.eventListeners.push({ type: 'click', listener });
      if (slider.classList.contains("checked")) {
        slider.classList.remove("checked");
      } else {
        slider.classList.add("checked");
      }
    })

    document.querySelector("#menuToggle").addEventListener("click", this.toggleMenu);


    document.querySelector("#sidebar-toggle-mobile").addEventListener("click", () => {
      console.log('clicking')
      document.querySelector('.sidebar-mobile').classList.contains('display') == false ? document.querySelector('.sidebar-mobile').classList.add('display') : document.querySelector('.sidebar-mobile').classList.remove('display')

    });

    //  Chat events
    document.querySelector("#chat-container-close").addEventListener("click", () => {

      document.querySelector('.saito-chat-container').classList.remove('display-chat');
    });

    document.querySelectorAll(".saito-chat-toggle").forEach(item => {
      item.addEventListener("click", () => {
        const chatContainer = document.querySelector('.saito-chat-container');
        const chatBody = document.querySelector('.saito-chat-body');
        chatContainer.classList.contains('display-chat') == false ? chatContainer.classList.add('display-chat') : chatContainer.classList.remove('display-chat')
        chatBody.scroll({
          top: chatBody.scrollHeight,
          behavior: "smooth"
        })

      });

    })

    document.body.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {

        sendMessage()
      }
    })

    document.querySelector("#saito-sendmsg-btn").addEventListener('click', sendMessage)

    function sendMessage() {
      const chatInput = document.querySelector('#saito-chat-input');
      const chatBody = document.querySelector('.saito-chat-body')

      const time = `${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()} `
      if (chatInput.value != "") {
        console.log(chatInput.value);
        const template = `<div class="saito-chat-bubble me"> 
       <div class="chat-dialog">
         <img src="/saito/img/account.svg"/>
         <div>
           <p class="saito-chat-address">kkadiaiudaol...</p>
           <p>${chatInput.value.trim()}</p>

         </div>
         <span>${time}</span>
       </div>

     </div>`;

        chatBody.insertAdjacentHTML('beforeend', template);
        chatInput.value = "";

        chatBody.scroll({
          top: chatBody.scrollHeight,
          behavior: "smooth"
        })

        console.log(template);
      }
    }




  }


  returnBaseHTML(app) {

    return null;
  }

  toggleMenu(e) {
    console.log("toggling menu");
    document
      .querySelector("#hamburger-contents")
      .classList.contains("show-menu")
      ? document
        .querySelector("#hamburger-contents")
        .classList.remove("show-menu")
      : document
        .querySelector("#hamburger-contents")
        .classList.add("show-menu");
  }




  renderMain(app) {
    if (app.BROWSER != 1 || this.browser_active != 1) {
      return;
    }
    EmailMain.render(app, this);
    EmailMain.attachEvents(app, this);
  }

  renderSidebar(app) {
    if (app.BROWSER != 1 || this.browser_active != 1) {
      return;
    }
    console.log("### 1");
    EmailSidebar.render(app, this);
    console.log("### 2");
    EmailSidebar.attachEvents(app, this);
    console.log("### 3");
  }


  respondTo(type = "") {
    if (type == "header-dropdown") {
      return {
        name: this.appname ? this.appname : this.name,
        icon_fa: this.icon_fa,
        browser_active: this.browser_active,
        slug: this.returnSlug()
      };
    }
    return null;
  }


  //
  // load transactions into interface when the network is up
  //
  onPeerHandshakeComplete(app, peer) {

    /********
     if (this.browser_active == 0) { return; }
     url = new URL(window.location.href);
     if (url.searchParams.get('module') != null) { return; }
   
     this.app.storage.loadTransactions("Dev", 50, (txs) => {
      for (let i = 0; i < txs.length; i++) {
  txs[i].decryptMessage(app);
        this.addTransaction(txs[i]);
      }
      let readyCount = app.browser.getValueFromHashAsNumber(window.location.hash, "ready")
      window.location.hash = app.browser.modifyHash(window.location.hash, {ready: readyCount + 1});
    });
     *******/
  }

}

module.exports = UI_ELEMENTS;

