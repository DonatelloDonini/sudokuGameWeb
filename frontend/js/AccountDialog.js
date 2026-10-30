import Modal from "./Modal.js";
import { api } from "./api.js";
import { el } from "./utils.js";

/**
 * Login / registration form for guests, profile and logout for logged in users.
 */
export default class AccountDialog{
  /**
   * @param {Object} callbacks
   * @param {Function} callbacks.getUser Returns the logged in user or null.
   * @param {Function} callbacks.onUserChange Called with the new user (or null after logout).
   */
  constructor({getUser, onUserChange}){
    this.getUser= getUser;
    this.onUserChange= onUserChange;
    this.modal= new Modal("Account");
  }

  /**
   * @param {"login"|"register"} [tab] Which form to show to guests.
   */
  show(tab= "login"){
    const user= this.getUser();
    if (user) this.#showProfile(user);
    else this.#showForm(tab);
    this.modal.show();
  }

  #showProfile(user){
    const stat= (label, value)=> el("div", {className: "stat"}, el("span", {className: "stat-value", text: String(value)}), el("span", {className: "stat-label", text: label}));

    this.modal.setContent(
      el("p", {className: "profile-name", text: user.username}),
      el("div", {className: "stats"},
        stat("Elo", user.elo),
        stat("Battles won", user.battlesWon),
        stat("Battles lost", user.battlesLost),
        stat("Sudokus solved", user.gamesCompleted),
      ),
      el("div", {className: "modal-actions"},
        el("button", {className: "button", type: "button", text: "Log out", onClick: async ()=> {
          await api.logout().catch(()=> {});
          this.modal.hide();
          this.onUserChange(null);
        }}),
      ),
    );
  }

  #showForm(tab){
    const isLogin= tab=== "login";
    const errorText= el("p", {className: "error-text", role: "alert"});
    const username= el("input", {name: "username", autocomplete: "username", required: true, minlength: 3, maxlength: 20, pattern: "[A-Za-z0-9_]+"});
    const password= el("input", {name: "password", type: "password", autocomplete: isLogin ? "current-password" : "new-password", required: true, minlength: 6, maxlength: 128});
    const submit= el("button", {className: "button button-primary", type: "submit", text: isLogin ? "Log in" : "Create account"});

    const form= el("form", {className: "account-form"},
      el("label", {}, "Username", username),
      el("label", {}, "Password", password),
      errorText,
      submit,
    );

    form.addEventListener("submit", async (event)=> {
      event.preventDefault();
      submit.disabled= true;
      errorText.textContent= "";

      try {
        const {user}= isLogin
          ? await api.login(username.value, password.value)
          : await api.register(username.value, password.value);
        this.modal.hide();
        this.onUserChange(user);
      }
      catch (error) {
        errorText.textContent= error.message;
      }
      finally {
        submit.disabled= false;
      }
    });

    this.modal.setContent(
      el("div", {className: "tabs", role: "tablist"},
        el("button", {className: "tab", type: "button", role: "tab", "aria-selected": String(isLogin), text: "Log in", onClick: ()=> this.#showForm("login")}),
        el("button", {className: "tab", type: "button", role: "tab", "aria-selected": String(! isLogin), text: "Register", onClick: ()=> this.#showForm("register")}),
      ),
      el("p", {className: "muted", text: isLogin
        ? "Log in to save your times on the leaderboard and to battle other players."
        : "Usernames are 3 to 20 letters, numbers or underscores. Passwords need at least 6 characters."}),
      form,
    );
    username.focus();
  }
}
