import { adminApi } from "../adminApi.js";
import { panel, badge, errorMessage } from "../DashboardPanel.js";
import DataTable from "../DataTable.js";
import { formatDateTime, formatDuration, capitalize } from "../format.js";
import { el } from "../../utils.js";

const STATUS_BADGES= {
  in_progress: ()=> badge("Playing"),
  completed: ()=> badge("Solved", "accent"),
  revealed: ()=> badge("Gave up"),
};

/**
 * The last solo games.
 */
export async function render(main){
  let games;
  try {
    ({games}= await adminApi.games());
  }
  catch (error) {
    main.replaceChildren(errorMessage(error));
    return;
  }

  const table= new DataTable({
    caption: "Recent solo games",
    emptyText: "No solo game played yet.",
    rows: games,
    searchKeys: ["username", "difficulty", "status"],
    columns: [
      {key: "startedAt", label: "Started", format: formatDateTime},
      {key: "username", label: "Player", format: (value)=> value ?? el("span", {className: "muted", text: "Guest"})},
      {key: "difficulty", label: "Difficulty", format: capitalize},
      {key: "hardestTechnique", label: "Hardest technique", format: (value)=> value ?? "–"},
      {key: "status", label: "Status", format: (value)=> STATUS_BADGES[value]()},
      {key: "durationMs", label: "Time", numeric: true, format: (value)=> value=== null ? "–" : formatDuration(value)},
      {key: "hintsUsed", label: "Hints", numeric: true},
    ],
  });

  main.replaceChildren(
    el("h1", {className: "pageTitle", text: "Solo games"}),
    panel({title: "Last 200 solo games"}, table.DOMElement),
  );
}
