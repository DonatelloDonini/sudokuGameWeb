/**
 * Fixed window rate limiting per client IP, kept in memory.
 *
 * @param {Object} options
 * @param {number} options.limit How many units each client can spend per window.
 * @param {number} [options.windowMs] The length of a window.
 * @param {Function} [options.cost] (req) => how many units the request costs (default 1).
 * @param {Function} [options.now] Returns the current time in ms, replaceable in tests.
 * @returns {Function} Express middleware answering 429 when the client is over the limit.
 */
const rateLimit= ({limit, windowMs= 60 * 1000, cost= ()=> 1, now= Date.now})=> {
  /** @type {Map<string, {used: number, resetAt: number}>} */
  const clients= new Map();

  // forget the clients whose window is over
  const cleanup= setInterval(()=> {
    const time= now();
    for (const [ip, client] of clients){
      if (client.resetAt<= time) clients.delete(ip);
    }
  }, windowMs);
  cleanup.unref();

  return (req, res, next)=> {
    const time= now();
    let client= clients.get(req.ip);
    if (! client || client.resetAt<= time){
      client= {used: 0, resetAt: time + windowMs};
      clients.set(req.ip, client);
    }

    const requestCost= cost(req);
    const resetSeconds= Math.ceil((client.resetAt - time) / 1000);
    res.set("RateLimit-Limit", String(limit));
    res.set("RateLimit-Reset", String(resetSeconds));

    if (client.used + requestCost> limit){
      res.set("RateLimit-Remaining", String(Math.max(0, limit - client.used)));
      res.set("Retry-After", String(resetSeconds));
      return res.status(429).json({error: `Rate limit exceeded: ${limit} per ${windowMs / 1000} seconds. Retry in ${resetSeconds} seconds.`});
    }

    client.used+= requestCost;
    res.set("RateLimit-Remaining", String(limit - client.used));
    next();
  };
};

module.exports= {rateLimit};
