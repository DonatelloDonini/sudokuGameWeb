import { adminApi } from "../adminApi.js";
import { panel, statTile, segmentedButton, badge, errorMessage } from "../DashboardPanel.js";
import DataTable from "../DataTable.js";
import LineChart from "../LineChart.js";
import { ADMIN_ICONS } from "../pages.js";
import { formatDateTime, formatDuration, capitalize } from "../format.js";
import Modal from "../../Modal.js";
import { el, icon, fill } from "../../utils.js";

const STATUSES= [
  {label: "Open", value: "open"},
  {label: "Dismissed", value: "dismissed"},
  {label: "Banned", value: "actioned"},
  {label: "All", value: "all"},
];

const STATUS_BADGES= {
  open: ()=> badge("Open", "accent"),
  dismissed: ()=> badge("Dismissed"),
  actioned: ()=> badge("Banned", "danger"),
};

let currentStatus= "open";

/**
 * The list of the cheating reports; a report opens with its evidence and the actions.
 */
export async function render(main){
  const listHolder= el("div");

  const showList= async ()=> {
    listHolder.replaceChildren(el("p", {className: "muted", text: "Loading…"}));
    let reports;
    try {
      ({reports}= await adminApi.reports(currentStatus));
    }
    catch (error) {
      listHolder.replaceChildren(errorMessage(error));
      return;
    }

    const table= new DataTable({
      caption: "Reports",
      emptyText: currentStatus=== "open" ? "No open report: all clear." : "No report here.",
      rows: reports,
      searchKeys: ["reported", "reporter", "reasonLabel", "comment"],
      onRowClick: (report)=> showReport(main, report.id),
      columns: [
        {key: "createdAt", label: "Date", format: formatDateTime},
        {key: "reported", label: "Reported", format: (value, row)=> el("span", {className: "cellWithBadge"},
          value,
          row.reportedBanned ? badge("Banned", "danger") : null,
          row.openReportsOnReported> 1 ? badge(`${row.openReportsOnReported} open`, "accent") : null,
        )},
        {key: "reporter", label: "By"},
        {key: "reasonLabel", label: "Reason"},
        {key: "battleId", label: "Battle", format: (value)=> value ? "Yes" : "No"},
        {key: "status", label: "Status", format: (value)=> STATUS_BADGES[value]()},
      ],
      actions: (report)=> [el("button", {type: "button", className: "button", text: "Review", onClick: ()=> showReport(main, report.id)})],
    });
    listHolder.replaceChildren(table.DOMElement);
  };

  main.replaceChildren(
    el("h1", {className: "pageTitle", text: "Reports"}),
    panel({
      title: "Cheating reports",
      actions: [segmentedButton({
        segments: STATUSES,
        value: currentStatus,
        ariaLabel: "Status",
        onChange: (status)=> {
          currentStatus= status;
          showList();
        },
      })],
    }, listHolder),
  );
  await showList();
}

/**
 * A report with everything needed to decide: the report, the reported player's history, the battle move by move.
 */
async function showReport(main, reportId){
  main.replaceChildren(el("p", {className: "muted", text: "Loading…"}));

  let report;
  try {
    report= await adminApi.report(reportId);
  }
  catch (error) {
    main.replaceChildren(errorMessage(error));
    return;
  }

  const back= el("button", {type: "button", className: "button", text: "← All reports", onClick: ()=> render(main)});
  const {reported}= report;

  fill(main,
    el("div", {className: "pageHeader"}, back, el("h1", {className: "pageTitle", text: `Report #${report.id}: ${reported.username}`})),

    panel({title: "Report", actions: [STATUS_BADGES[report.status]()]},
      definitionList([
        ["Reason", report.reasonLabel],
        ["Reported by", report.reporter],
        ["Date", formatDateTime(report.createdAt)],
        ["Comment", report.comment || "–"],
        ...(report.status!== "open" ? [
          ["Closed by", report.resolvedBy ?? "–"],
          ["Closed on", formatDateTime(report.resolvedAt)],
          ["Note", report.resolutionNote || "–"],
        ] : []),
      ]),
    ),

    panel({title: `Player: ${reported.username}`, actions: reported.banned ? [badge("Banned", "danger")] : []},
      el("div", {className: "tiles"},
        statTile("Elo", reported.elo),
        statTile("Battles", `${reported.battlesWon}/${reported.battlesPlayed}`, {hint: "won / played"}),
        statTile("Solo games solved", reported.gamesCompleted),
        statTile("Reports", reported.reports.total, {hint: `${reported.reports.open} open, ${reported.reports.actioned} led to a ban`}),
      ),
      reported.banned ? el("p", {text: `Ban reason: ${reported.banReason ?? "–"}`}) : null,
      reported.soloTimes.length> 0
        ? new DataTable({
          caption: "Best solo times",
          rows: reported.soloTimes,
          pageSize: 10,
          columns: [
            {key: "difficulty", label: "Difficulty", format: capitalize},
            {key: "completed", label: "Solved", numeric: true},
            {key: "bestMs", label: "Best time", numeric: true, format: formatDuration},
            {key: "everybodyAverageMs", label: "Everybody's average", numeric: true, format: (value)=> value ? formatDuration(value) : "–"},
          ],
        }).DOMElement
        : el("p", {className: "muted", text: "No solo game solved."}),
    ),

    report.battle ? battleEvidence(report.battle, reported.username) : panel({title: "Battle"}, el("p", {className: "muted", text: "This report isn't about a battle."})),

    report.status=== "open" ? decisionPanel(main, report) : null,
  );
}

const definitionList= (entries)=> el("dl", {className: "definitions"},
  ...entries.flatMap(([term, description])=> [el("dt", {text: term}), el("dd", {text: description})]),
);

/**
 * How both players played the battle: their numbers, the warning signs, and the correct cells over time.
 */
function battleEvidence(battle, reportedUsername){
  // color follows the player: the reported one is always the first series
  const players= [...battle.players].sort((a, b)=> (b.username=== reportedUsername) - (a.username=== reportedUsername));

  const seconds= (ms)=> ms=== null ? "–" : `${(ms / 1000).toFixed(1)} s`;
  const table= new DataTable({
    caption: "How each player played",
    rows: players,
    columns: [
      {key: "username", label: "Player", format: (value)=> value=== reportedUsername ? el("strong", {text: `${value} (reported)`}) : value},
      {key: "correctCells", label: "Correct cells", numeric: true, format: (value)=> `${value}/${battle.emptyCells}`},
      {key: "placements", label: "Numbers placed", numeric: true},
      {key: "wrongPlacements", label: "Wrong", numeric: true},
      {key: "erasures", label: "Erased", numeric: true},
      {key: "medianIntervalMs", label: "Typical time per number", numeric: true, format: seconds},
      {key: "fastestTenMs", label: "Fastest 10 numbers", numeric: true, format: seconds},
    ],
  });

  const signals= players.flatMap(player=> player.signals.map(signal=> ({player: player.username, signal})));

  const chart= new LineChart({
    title: "Correct cells over time",
    xLabel: "Time",
    step: true,
    formatX: (ms)=> ms< 60000 ? `${(ms / 1000).toFixed(1)} s` : formatDuration(ms),
    xTicks: "linear",
    series: players.map((player, i)=> ({
      label: player.username,
      color: `var(--series-${i + 1})`,
      points: [...player.timeline, ...(player.lastMoveMs!== null && battle.durationMs> player.lastMoveMs ? [{atMs: battle.durationMs, correct: player.correctCells}] : [])]
        .map(point=> ({x: point.atMs, y: point.correct})),
    })),
  });

  return panel({title: "Battle"},
    definitionList([
      ["Played", formatDateTime(battle.startedAt)],
      ["Difficulty", `${capitalize(battle.difficulty)}${battle.hardestTechnique ? ` (needs ${battle.hardestTechnique})` : ""}, ${battle.emptyCells} empty cells`],
      ["Result", `${battle.winner} won (${{solved: "solved first", resign: "the other resigned", disconnect: "the other left"}[battle.endReason]}) in ${formatDuration(battle.durationMs)}, ±${battle.eloChange} elo`],
    ]),
    table.DOMElement,
    signals.length> 0
      ? el("ul", {className: "signals", "aria-label": "Warning signs"}, ...signals.map(({player, signal})=> el("li", {},
        icon(ADMIN_ICONS.warning), el("span", {text: `${player}: ${signal}`}),
      )))
      : el("p", {className: "muted", text: "No warning sign in how they played."}),
    el("p", {className: "muted small", text: "Warning signs are hints for a human decision, not proof: strong players can be fast too."}),
    el("h3", {className: "panelSubtitle", text: "Correct cells over time"}),
    chart.DOMElement,
  );
}

function decisionPanel(main, report){
  const note= el("textarea", {className: "input", rows: 2, maxlength: 500, placeholder: "Note for the other admins (shown to the player as the ban reason when banning)"});
  const errorText= el("p", {className: "errorText", role: "alert"});

  const resolve= async (action)=> {
    if (action=== "ban"){
      const confirmed= await Modal.confirm(`Ban ${report.reported.username}?`, "They will be logged out, won't be able to log in, and will leave the leaderboards. All their open reports will be closed.", "Ban");
      if (! confirmed) return;
    }
    try {
      await adminApi.resolveReport(report.id, action, note.value);
      await showReport(main, report.id);
    }
    catch (error) {
      errorText.textContent= error.message;
    }
  };

  return panel({title: "Decision"},
    note,
    errorText,
    el("div", {className: "buttonRow"},
      el("button", {type: "button", className: "button", text: "Dismiss: no cheating", onClick: ()=> resolve("dismiss")}),
      report.reported.banned ? null : el("button", {type: "button", className: "button button-danger", text: `Ban ${report.reported.username}`, onClick: ()=> resolve("ban")}),
    ),
  );
}
