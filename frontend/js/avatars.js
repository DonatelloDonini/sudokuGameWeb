import { decodeAvatar, randomAvatar, renderSVG } from "pixel-avatar";

/**
 * A player's pixel avatar (see the pixel-avatar module), drawn from its code.
 *
 * @param {string|null|undefined} code The avatar code the server gives with every player.
 * @param {Object} [options]
 * @param {number} [options.size] In pixels.
 * @param {string} [options.name] Whose avatar: read by screen readers, and the seed of a face when the code is missing.
 * @returns {HTMLElement}
 */
export const avatarImage= (code, {size= 32, name= ""}= {})=> {
  let avatar;
  try {
    avatar= decodeAvatar(code);
  }
  catch {
    avatar= randomAvatar(name.toLowerCase());
  }

  const image= document.createElement("span");
  image.className= "avatar-image";
  image.innerHTML= renderSVG(avatar, {size, title: name ? `${name}'s avatar` : "Avatar"});
  return image;
};

/**
 * A username with its avatar in front.
 */
export const playerName= (username, code, {size= 24}= {})=> {
  const element= document.createElement("span");
  element.className= "player-name";
  element.append(avatarImage(code, {size, name: username}), document.createTextNode(username));
  return element;
};
