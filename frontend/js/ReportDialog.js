import Modal from "./Modal.js";
import { api } from "./api.js";
import { el } from "./utils.js";

/** Used when the reasons can't be loaded: the same as the server's. */
const FALLBACK_REASONS= [
  {id: "solver", label: "Used a solver or a bot"},
  {id: "impossible_time", label: "Impossible time"},
  {id: "disconnect_abuse", label: "Leaves battles on purpose"},
  {id: "other", label: "Other"},
];

let reasonsRequest= null;

/**
 * Asks the player why they think someone is cheating, and sends the report to the admins.
 *
 * @param {Object} options
 * @param {string} options.username Who is reported.
 * @param {string|null} [options.battleId] The battle the report is about.
 * @returns {Promise<boolean>} Whether the report was sent.
 */
export const openReportDialog= ({username, battleId= null})=> new Promise((resolve)=> {
  let sent= false;
  const modal= new Modal(`Report ${username}`, {onClose: ()=> resolve(sent)});

  reasonsRequest??= api.reportReasons().then(({reasons})=> reasons).catch(()=> {
    reasonsRequest= null;
    return FALLBACK_REASONS;
  });

  reasonsRequest.then((reasons)=> {
    const errorText= el("p", {className: "error-text", role: "alert"});
    const comment= el("textarea", {name: "comment", rows: 3, maxlength: 500, placeholder: "What made you think so? (optional)"});
    const submit= el("button", {className: "button button-primary", type: "submit", text: "Send report"});

    const form= el("form", {className: "report-form"},
      el("fieldset", {},
        el("legend", {text: "Why do you think they are cheating?"}),
        ...reasons.map((reason, i)=> el("label", {className: "radio"},
          el("input", {type: "radio", name: "reason", value: reason.id, required: true, checked: i=== 0}),
          reason.label,
        )),
      ),
      el("label", {}, "Details", comment),
      errorText,
      el("div", {className: "modal-actions"},
        el("button", {className: "button", type: "button", text: "Cancel", onClick: ()=> modal.hide()}),
        submit,
      ),
    );

    form.addEventListener("submit", async (event)=> {
      event.preventDefault();
      submit.disabled= true;
      errorText.textContent= "";

      try {
        await api.report({username, battleId, reason: new FormData(form).get("reason"), comment: comment.value});
        sent= true;
        modal.setContent(
          el("p", {text: "Thanks: an admin will look at the report. Reports are anonymous for the reported player."}),
          el("div", {className: "modal-actions"}, el("button", {className: "button button-primary", type: "button", text: "Close", onClick: ()=> modal.hide()})),
        );
      }
      catch (error) {
        errorText.textContent= error.message;
        submit.disabled= false;
      }
    });

    modal.setContent(
      el("p", {className: "muted", text: battleId
        ? "The admins will see how both of you played this battle, move by move."
        : "The admins will look at this player's games and battles."}),
      form,
    );
  });

  modal.setContent(el("p", {className: "muted", text: "Loading…"}));
  modal.show();
});
