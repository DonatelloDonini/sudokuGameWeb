/**
 * Material Design icon paths (Apache 2.0) of the dashboard.
 */
export const ADMIN_ICONS= Object.freeze({
  chart: "M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z",
  flag: "M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6h-5.6Z",
  users: "M12,5.5A3.5,3.5 0 0,1 15.5,9A3.5,3.5 0 0,1 12,12.5A3.5,3.5 0 0,1 8.5,9A3.5,3.5 0 0,1 12,5.5M5,8C5.56,8 6.08,8.15 6.53,8.42C6.38,9.85 6.8,11.27 7.66,12.38C7.16,13.34 6.16,14 5,14A3,3 0 0,1 2,11A3,3 0 0,1 5,8M19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14C17.84,14 16.84,13.34 16.34,12.38C17.2,11.27 17.62,9.85 17.47,8.42C17.92,8.15 18.44,8 19,8M5.5,18.25C5.5,16.18 8.41,14.5 12,14.5C15.59,14.5 18.5,16.18 18.5,18.25V20H5.5V18.25M0,20V18.5C0,17.11 1.89,15.94 4.45,15.6C3.86,16.28 3.5,17.22 3.5,18.25V20H0M24,20H20.5V18.25C20.5,17.22 20.14,16.28 19.55,15.6C22.11,15.94 24,17.11 24,18.5V20Z",
  swords: "M6.2,2.44L18.1,14.34L20.22,12.22L21.63,13.63L19.16,16.1L22.34,19.28C22.73,19.67 22.73,20.3 22.34,20.69L21.63,21.4C21.24,21.79 20.61,21.79 20.22,21.4L17,18.23L14.56,20.7L13.15,19.29L15.27,17.17L3.37,5.27V2.44H6.2M15.89,10L20.63,5.26V2.44H17.8L13.06,7.18L15.89,10M10.94,15.27L8.11,12.44L5.62,14.93L3.5,12.81L2.09,14.22L4.56,16.69L1.39,19.86C1,20.25 1,20.89 1.39,21.28L2.1,22C2.5,22.39 3.12,22.39 3.5,22L6.7,18.83L9.12,21.28L10.53,19.86L8.41,17.74L10.94,15.27Z",
  grid: "M3,11H11V3H3M3,21H11V13H3M13,21H21V13H13M13,3V11H21V3",
  server: "M4,1H20A1,1 0 0,1 21,2V6A1,1 0 0,1 20,7H4A1,1 0 0,1 3,6V2A1,1 0 0,1 4,1M4,9H20A1,1 0 0,1 21,10V14A1,1 0 0,1 20,15H4A1,1 0 0,1 3,14V10A1,1 0 0,1 4,9M4,17H20A1,1 0 0,1 21,18V22A1,1 0 0,1 20,23H4A1,1 0 0,1 3,22V18A1,1 0 0,1 4,17M9,5H10V3H9V5M9,13H10V11H9V13M9,21H10V19H9V21M5,3V5H7V3H5M5,11V13H7V11H5M5,19V21H7V19H5Z",
  collapse: "M18.41,7.41L17,6L11,12L17,18L18.41,16.59L13.83,12L18.41,7.41M12.41,7.41L11,6L5,12L11,18L12.41,16.59L7.83,12L12.41,7.41Z",
  chevron: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  warning: "M13 14h-2V9h2m0 9h-2v-2h2M1 21h22L12 2 1 21Z",
});

/**
 * The pages of the dashboard, in the order of its side menu. Adding one here adds its <dashboard-option>.
 *
 * - The id names the page in links (admin.html#<id>) and in the last opened page saved by the browser:
 *   don't rename it once released.
 * - module draws the page: it exports render(main). Its path is relative to DashboardOption.js.
 */
export const PAGES= Object.freeze([
  {id: "stats", label: "Stats", icon: ADMIN_ICONS.chart, module: "./pages/stats.js"},
  {id: "reports", label: "Reports", icon: ADMIN_ICONS.flag, module: "./pages/reports.js"},
  {id: "users", label: "Users", icon: ADMIN_ICONS.users, module: "./pages/users.js"},
  {id: "battles", label: "Battles", icon: ADMIN_ICONS.swords, module: "./pages/battles.js"},
  {id: "games", label: "Solo games", icon: ADMIN_ICONS.grid, module: "./pages/games.js"},
  {id: "system", label: "System", icon: ADMIN_ICONS.server, module: "./pages/system.js"},
]);
