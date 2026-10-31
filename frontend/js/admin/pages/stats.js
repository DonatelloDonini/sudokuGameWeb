import { adminApi } from "../adminApi.js";
import { panel, statTile, segmentedButton, errorMessage } from "../DashboardPanel.js";
import DataTable from "../DataTable.js";
import LineChart from "../LineChart.js";
import { formatDay, formatDuration, formatPercent, capitalize } from "../format.js";
import { el } from "../../utils.js";

/** The segments of the period picker: label → period of GET /api/admin/stats. */
const PERIODS= [
  {label: "Last week", value: "week"},
  {label: "Last month", value: "month"},
  {label: "Last year", value: "year"},
  {label: "All time", value: "all"},
];

const DIFFICULTY_ORDER= ["easy", "medium", "hard", "expert"];

/** The pending request, cancelled when another period is picked. */
let currentPeriod= "month";

export async function render(main){
  let stats;
  try {
    stats= await adminApi.stats(currentPeriod);
  }
  catch (error) {
    main.replaceChildren(errorMessage(error));
    return;
  }

  const {totals}= stats;
  const tiles= el("div", {className: "tiles"},
    statTile("Players", totals.users, {hint: totals.bannedUsers> 0 ? `${totals.bannedUsers} banned` : null}),
    statTile("Active today", totals.activePlayersToday),
    statTile("Solo games", totals.gamesStarted, {hint: `${formatPercent(totals.gamesCompleted, totals.gamesStarted)} solved`}),
    statTile("Battles", totals.battles),
    statTile("Open reports", totals.openReports, {
      hint: totals.openReports> 0 ? "Review them" : "All clear",
      onClick: ()=> document.getElementById("reports").open(),
    }),
  );

  const chartHolder= el("div");
  const activityPanel= panel({
    title: "Activity per day",
    actions: [segmentedButton({
      segments: PERIODS,
      value: currentPeriod,
      ariaLabel: "Period",
      onChange: async (period)=> {
        currentPeriod= period;
        try {
          showActivity(chartHolder, (await adminApi.stats(period)).daily);
        }
        catch (error) {
          chartHolder.replaceChildren(errorMessage(error));
        }
      },
    })],
  }, chartHolder);
  showActivity(chartHolder, stats.daily);

  const difficulties= [...stats.difficulties].sort((a, b)=> DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty));
  const difficultyTable= new DataTable({
    caption: "Solo games per difficulty",
    emptyText: "No solo game played yet.",
    rows: difficulties,
    columns: [
      {key: "difficulty", label: "Difficulty", format: capitalize, sortValue: (row)=> DIFFICULTY_ORDER.indexOf(row.difficulty)},
      {key: "started", label: "Started", numeric: true},
      {key: "completed", label: "Solved", numeric: true},
      {key: "revealed", label: "Gave up", numeric: true},
      {key: "rate", label: "Solved %", numeric: true, format: (_, row)=> formatPercent(row.completed, row.started), sortValue: (row)=> row.completed / row.started},
      {key: "averageMs", label: "Average time", numeric: true, format: (value)=> value ? formatDuration(value) : "–"},
    ],
  });

  main.replaceChildren(
    el("h1", {className: "pageTitle", text: "Stats"}),
    tiles,
    activityPanel,
    panel({title: "Solo games per difficulty"}, difficultyTable.DOMElement),
  );
}

/**
 * Draws the activity chart: games, battles and new players per day.
 */
const showActivity= (holder, daily)=> {
  const seriesOf= (key)=> daily.map(day=> ({x: Date.parse(day.date), y: day[key]}));
  const chart= new LineChart({
    title: "Activity per day",
    xLabel: "Day",
    formatX: formatDay,
    series: [
      {label: "Solo games", color: "var(--series-1)", points: seriesOf("games")},
      {label: "Battles", color: "var(--series-2)", points: seriesOf("battles")},
      {label: "New players", color: "var(--series-3)", points: seriesOf("newUsers")},
    ],
  });
  holder.replaceChildren(chart.DOMElement);
};
