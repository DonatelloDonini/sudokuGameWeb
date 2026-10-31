import { adminApi } from "../adminApi.js";
import { panel, badge } from "../DashboardPanel.js";
import DataTable from "../DataTable.js";
import { formatDate } from "../format.js";
import Modal from "../../Modal.js";
import { el } from "../../utils.js";
import { avatarImage } from "../../avatars.js";

/**
 * The players: search, ban/unban, admin rights.
 */
export async function render(main){
  let me= null;
  try {
    me= (await adminApi.me()).user;
  }
  catch {}

  const errorText= el("p", {className: "errorText", role: "alert"});
  const table= new DataTable({
    caption: "Users",
    emptyText: "No user found.",
    rows: [],
    columns: [
      {key: "username", label: "Username", format: (value, row)=> el("span", {className: "cellWithBadge"},
        avatarImage(row.avatar, {size: 28, name: value}),
        value,
        row.isAdmin ? badge("Admin", "accent") : null,
        row.bannedAt ? badge("Banned", "danger") : null,
      )},
      {key: "elo", label: "Elo", numeric: true},
      {key: "createdAt", label: "Joined", format: formatDate},
      {key: "gamesCompleted", label: "Solo solved", numeric: true},
      {key: "battles", label: "Battles won", numeric: true, format: (value, row)=> `${row.battlesWon}/${value}`, sortValue: (row)=> row.battlesWon},
      {key: "openReports", label: "Open reports", numeric: true},
      {key: "banReason", label: "Ban reason", format: (value, row)=> row.bannedAt ? (value ?? "–") : ""},
    ],
    actions: (user)=> {
      if (user.id=== me?.id) return [el("span", {className: "muted", text: "You"})];
      return [
        user.bannedAt
          ? el("button", {type: "button", className: "button", text: "Unban", onClick: ()=> act(()=> adminApi.unban(user.id))})
          : el("button", {type: "button", className: "button button-danger", text: "Ban", onClick: ()=> banDialog(user, (reason)=> act(()=> adminApi.ban(user.id, reason)))}),
        el("button", {type: "button", className: "button", text: user.isAdmin ? "Remove admin" : "Make admin", onClick: async ()=> {
          const confirmed= await Modal.confirm(
            user.isAdmin ? `Remove ${user.username}'s admin rights?` : `Make ${user.username} an admin?`,
            user.isAdmin ? "They won't be able to open the dashboard anymore." : "They will be able to open this dashboard, ban players and manage the admins.",
            user.isAdmin ? "Remove" : "Make admin",
          );
          if (confirmed) act(()=> adminApi.setAdmin(user.id, ! user.isAdmin));
        }}),
      ];
    },
  });

  const search= el("input", {type: "search", className: "input", placeholder: "Search a username…", "aria-label": "Search a username"});
  let searchTimer= null;
  search.addEventListener("input", ()=> {
    clearTimeout(searchTimer);
    searchTimer= setTimeout(load, 250);
  });

  async function load(){
    try {
      table.setRows((await adminApi.users(search.value.trim())).users);
      errorText.textContent= "";
    }
    catch (error) {
      errorText.textContent= error.message;
    }
  }

  async function act(action){
    try {
      await action();
      await load();
    }
    catch (error) {
      errorText.textContent= error.message;
    }
  }

  main.replaceChildren(
    el("h1", {className: "pageTitle", text: "Users"}),
    panel({title: "Players", actions: [search]}, errorText, table.DOMElement),
  );
  await load();
}

/**
 * Asks why the user is banned (shown to them when they try to log in).
 */
function banDialog(user, onBan){
  const modal= new Modal(`Ban ${user.username}?`);
  const reason= el("textarea", {className: "input", rows: 3, maxlength: 500, placeholder: "Reason (shown to the player when they try to log in)"});
  modal.setContent(
    el("p", {text: "They will be logged out, won't be able to log in, and will leave the leaderboards."}),
    reason,
    el("div", {className: "modal-actions"},
      el("button", {className: "button", type: "button", text: "Cancel", onClick: ()=> modal.hide()}),
      el("button", {className: "button button-danger", type: "button", text: "Ban", onClick: ()=> {
        modal.hide();
        onBan(reason.value);
      }}),
    ),
  );
  modal.show();
}

