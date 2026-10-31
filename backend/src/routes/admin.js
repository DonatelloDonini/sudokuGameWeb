const express= require("express");
const {ReportError}= require("../reports");
const {PERIODS}= require("../admin");

const MAX_REASON_LENGTH= 500;

/**
 * /api/admin: the data and the actions of the admin dashboard, for admins only.
 *
 * @param {Object} services
 * @param {Object} runtime
 * @param {import("../battle/BattleManager").BattleManager} [runtime.battleManager] To kick the banned players out of the battles.
 * @param {import("../levelPool").LevelPool} [runtime.levelPool]
 */
const adminRouter= ({users, reports, adminData}, runtime= {})=> {
  const router= express.Router();

  router.use((req, res, next)=> {
    if (! req.user) return res.status(401).json({error: "Log in first."});
    if (req.user.is_admin!== 1) return res.status(403).json({error: "Only admins can open the dashboard."});
    next();
  });

  const banUser= (userId, reason)=> {
    users.ban(userId, reason);
    runtime.battleManager?.kick(userId);
  };

  router.get("/stats", (req, res)=> {
    const period= req.query.period ?? "month";
    if (! Object.hasOwn(PERIODS, period)) return res.status(400).json({error: `period must be one of: ${Object.keys(PERIODS).join(", ")}`});
    res.json(adminData.stats(period));
  });

  router.get("/system", (req, res)=> {
    res.json(adminData.system(runtime));
  });

  router.get("/battles", (req, res)=> {
    res.json({battles: adminData.recentBattles()});
  });

  router.get("/games", (req, res)=> {
    res.json({games: adminData.recentGames()});
  });

  //////       //////
  ////// users //////
  //////       //////

  router.get("/users", (req, res)=> {
    res.json({users: adminData.userList(typeof req.query.search=== "string" ? req.query.search : "")});
  });

  router.param("userId", (req, res, next, userId)=> {
    const user= users.findById(Number(userId));
    if (! user) return res.status(404).json({error: "User not found."});
    req.target= user;
    next();
  });

  router.post("/users/:userId/ban", (req, res)=> {
    const reason= req.body?.reason ?? "";
    if (typeof reason!== "string" || reason.length> MAX_REASON_LENGTH) return res.status(400).json({error: "Invalid reason."});
    if (req.target.id=== req.user.id) return res.status(400).json({error: "You can't ban yourself."});

    banUser(req.target.id, reason.trim() || null);
    res.json({ok: true});
  });

  router.post("/users/:userId/unban", (req, res)=> {
    users.unban(req.target.id);
    res.json({ok: true});
  });

  router.post("/users/:userId/admin", (req, res)=> {
    const isAdmin= req.body?.isAdmin;
    if (typeof isAdmin!== "boolean") return res.status(400).json({error: "isAdmin must be true or false."});
    if (req.target.id=== req.user.id && ! isAdmin) return res.status(400).json({error: "You can't remove your own admin rights."});

    users.setAdmin(req.target.id, isAdmin);
    res.json({ok: true});
  });

  //////         //////
  ////// reports //////
  //////         //////

  router.get("/reports", (req, res)=> {
    const status= req.query.status ?? "open";
    if (! ["open", "dismissed", "actioned", "all"].includes(status)) return res.status(400).json({error: "Invalid status."});
    res.json({reports: reports.list(status)});
  });

  router.get("/reports/:reportId", (req, res)=> {
    const report= reports.get(Number(req.params.reportId));
    if (! report) return res.status(404).json({error: "Report not found."});
    res.json(report);
  });

  router.post("/reports/:reportId/resolve", (req, res)=> {
    const {action, note}= req.body ?? {};
    try {
      const reportedId= reports.resolve(Number(req.params.reportId), req.user, action, note ?? "");
      if (action=== "ban") runtime.battleManager?.kick(reportedId);
      res.json({ok: true});
    }
    catch (error) {
      if (! (error instanceof ReportError)) throw error;
      res.status(error.status).json({error: error.message});
    }
  });

  return router;
};

module.exports= {adminRouter};
