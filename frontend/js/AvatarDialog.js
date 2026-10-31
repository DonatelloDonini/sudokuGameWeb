import { decodeAvatar, encodeAvatar, randomAvatar } from "pixel-avatar";
import { AvatarEditor } from "pixel-avatar/editor";
import Modal from "./Modal.js";
import { api } from "./api.js";
import { el } from "./utils.js";

/**
 * The avatar editor of the pixel-avatar module, in a dialog: the player builds their face and saves it.
 *
 * @param {Object} user The logged in user.
 * @returns {Promise<Object|null>} The updated user once saved, null when cancelled.
 */
export const openAvatarDialog= (user)=> new Promise((resolve)=> {
  let savedUser= null;
  const modal= new Modal("Your avatar", {wide: true, onClose: ()=> resolve(savedUser)});

  let avatar;
  try {
    avatar= decodeAvatar(user.avatar);
  }
  catch {
    avatar= randomAvatar(user.username.toLowerCase());
  }

  const editor= new AvatarEditor({value: avatar, previewSize: 160});
  const errorText= el("p", {className: "error-text", role: "alert"});
  const save= el("button", {className: "button button-primary", type: "button", text: "Save", onClick: async ()=> {
    save.disabled= true;
    try {
      savedUser= (await api.setAvatar(encodeAvatar(editor.value))).user;
      modal.hide();
    }
    catch (error) {
      errorText.textContent= error.message;
      save.disabled= false;
    }
  }});

  modal.setContent(
    editor.element,
    errorText,
    el("div", {className: "modal-actions"},
      el("button", {className: "button", type: "button", text: "Cancel", onClick: ()=> modal.hide()}),
      save,
    ),
  );
  modal.show();
});
