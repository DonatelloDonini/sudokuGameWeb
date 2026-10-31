const express= require("express");
const {hashPassword, verifyPassword}= require("../auth");

const USERNAME_PATTERN= /^[A-Za-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH= 6;
const MAX_PASSWORD_LENGTH= 128;

/**
 * @returns {string|null} What is wrong with the credentials, null if they are fine.
 */
const validateCredentials= (username, password)=> {
  if (typeof username!== "string" || ! USERNAME_PATTERN.test(username)){
    return "The username must be 3 to 20 letters, numbers or underscores.";
  }
  if (typeof password!== "string" || password.length< MIN_PASSWORD_LENGTH || password.length> MAX_PASSWORD_LENGTH){
    return `The password must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters long.`;
  }
  return null;
};

/**
 * /api/auth: register, login, logout and the current user.
 */
const authRouter= ({users, sessions})=> {
  const router= express.Router();

  const logIn= (res, user)=> {
    sessions.setCookie(res, sessions.create(user.id));
    res.json({user: users.toPublic(user)});
  };

  router.post("/register", async (req, res)=> {
    const {username, password}= req.body ?? {};
    const problem= validateCredentials(username, password);
    if (problem) return res.status(400).json({error: problem});

    if (users.findByUsername(username)) return res.status(409).json({error: "This username is already taken."});

    const user= users.create(username, await hashPassword(password));
    res.status(201);
    logIn(res, user);
  });

  router.post("/login", async (req, res)=> {
    const {username, password}= req.body ?? {};
    const user= typeof username=== "string" ? users.findByUsername(username) : null;

    if (! user || typeof password!== "string" || ! await verifyPassword(password, user.password_hash)){
      return res.status(401).json({error: "Wrong username or password."});
    }
    if (user.banned_at!== null){
      return res.status(403).json({error: `This account is suspended${user.ban_reason ? `: ${user.ban_reason}` : "."}`});
    }

    logIn(res, user);
  });

  router.post("/logout", (req, res)=> {
    if (req.sessionToken) sessions.destroy(req.sessionToken);
    sessions.clearCookie(res);
    res.json({user: null});
  });

  router.get("/me", (req, res)=> {
    res.json({user: req.user ? users.toPublic(req.user) : null});
  });

  return router;
};

module.exports= {authRouter, validateCredentials};
