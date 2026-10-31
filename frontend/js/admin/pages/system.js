import { adminApi } from "../adminApi.js";
import { panel, statTile, badge, errorMessage } from "../DashboardPanel.js";
import DataTable from "../DataTable.js";
import { formatBytes, formatDuration, capitalize } from "../format.js";
import { el } from "../../utils.js";

const REFRESH_MS= 5000;

/**
 * The state of the server, refreshed every few seconds while the page is open.
 */
export async function render(main){
  const content= el("div", {className: "pageContent"});
  const updated= el("span", {className: "muted small"});
  main.replaceChildren(
    el("div", {className: "pageHeader"}, el("h1", {className: "pageTitle", text: "System"}), updated),
    content,
  );

  const refresh= async ()=> {
    // another page was opened
    if (! content.isConnected) return;

    try {
      showSystem(content, await adminApi.system());
      updated.textContent= `Updated ${new Date().toLocaleTimeString()}, every ${REFRESH_MS / 1000} s`;
    }
    catch (error) {
      content.replaceChildren(errorMessage(error));
    }
    setTimeout(refresh, REFRESH_MS);
  };
  await refresh();
}

function showSystem(content, system){
  const pool= system.levelPool;
  const poolRows= pool ? Object.entries(pool.ready).map(([difficulty, ready])=> ({difficulty, ready, size: pool.size})) : [];

  content.replaceChildren(
    panel({title: "Server"},
      el("div", {className: "tiles"},
        statTile("Uptime", formatDuration(system.uptimeMs)),
        statTile("Memory", formatBytes(system.memoryBytes)),
        statTile("Database", formatBytes(system.databaseBytes)),
        statTile("Node.js", system.nodeVersion),
      ),
    ),
    panel({title: "Battles right now"},
      system.battles
        ? el("div", {className: "tiles"},
          statTile("Connected players", system.battles.connected),
          statTile("Looking for an opponent", system.battles.queued),
          statTile("Battles being played", system.battles.battles),
        )
        : el("p", {className: "muted", text: "The battle server isn't running."}),
    ),
    panel({title: "Level generator", actions: pool ? [pool.workerRunning ? badge("Worker running", "accent") : badge("Worker stopped: generating on demand", "danger")] : []},
      pool
        ? el("div", {},
          el("p", {className: "muted", text: `${pool.queued} public API request${pool.queued=== 1 ? "" : "s"} waiting.`}),
          new DataTable({
            caption: "Levels ready",
            rows: poolRows,
            columns: [
              {key: "difficulty", label: "Difficulty", format: capitalize},
              {key: "ready", label: "Ready", numeric: true, format: (value, row)=> `${value}/${row.size}`},
            ],
          }).DOMElement,
        )
        : el("p", {className: "muted", text: "Levels are generated on demand (no worker)."}),
    ),
  );
}
