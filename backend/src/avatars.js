const path= require("node:path");
const {encodeAvatar, decodeAvatar, randomAvatar, renderSVG, InvalidAvatarError}= require("pixel-avatar");

/** Where the browser files of the avatar module are, served at /vendor/pixel-avatar/. */
const AVATAR_MODULE_DIR= path.join(path.dirname(require.resolve("pixel-avatar/package.json")), "src");

/**
 * @param {Object} user A users row.
 * @returns {string} The user's avatar code; players who didn't make one get a random face, always the same for their name.
 */
const avatarCodeOf= (user)=> user.avatar ?? encodeAvatar(randomAvatar(user.username.toLowerCase()));

/**
 * @param {*} code Untrusted input.
 * @returns {string|null} The code, normalized, or null when it isn't a valid avatar code.
 */
const normalizeAvatarCode= (code)=> {
  try {
    return encodeAvatar(decodeAvatar(code));
  }
  catch (error) {
    if (error instanceof InvalidAvatarError) return null;
    throw error;
  }
};

/**
 * @param {string} code A valid avatar code.
 * @param {number} size
 * @returns {string} The avatar as an SVG document.
 */
const avatarSVG= (code, size)=> renderSVG(decodeAvatar(code), {size, title: "Avatar"});

module.exports= {AVATAR_MODULE_DIR, avatarCodeOf, normalizeAvatarCode, avatarSVG};
