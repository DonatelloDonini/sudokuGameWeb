import { adminApi } from "../adminApi.js";
import { panel, badge, errorMessage } from "../DashboardPanel.js";
import DataTable from "../DataTable.js";
import { formatDateTime, formatDuration, capitalize } from "../format.js";
import { el } from "../../utils.js";

const END_REASONS= {solved: "Solved", resign: "Resigned", disconnect: "Left"};

/**
 * The last battles.
 */
export async function render(main){
  let battles;
  try {
    ({battles}= await adminApi.battles());
  }
  catch (error) {
    main.replaceChildren(errorMessage(error));
    return;
  }

  const table= new DataTable({
    caption: "Recent battles",
    emptyText: "No battle played yet.",
    rows: battles,
    searchKeys: ["player1", "player2", "winner", "difficulty"],
    columns: [
      {key: "startedAt", label: "Date", format: formatDateTime},
      {key: "player1", label: "Players", format: (value, row)=> `${value} vs ${row.player2}`},
      {key: "winner", label: "Winner"},
      {key: "difficulty", label: "Difficulty", format: capitalize},
      {key: "hardestTechnique", label: "Hardest technique", format: (value)=> value ?? "–"},
      {key: "durationMs", label: "Duration", numeric: true, format: formatDuration},
      {key: "endReason", label: "End", format: (value)=> END_REASONS[value]},
      {key: "eloChange", label: "Elo", numeric: true, format: (value)=> `±${value}`},
      {key: "reports", label: "Reports", numeric: true, format: (value)=> value> 0 ? badge(String(value), "danger") : "0"},
    ],
  });

  main.replaceChildren(
    el("h1", {className: "pageTitle", text: "Battles"}),
    panel({title: "Last 200 battles"}, table.DOMElement),
  );
}
