import { request } from "../api.js";

/**
 * The calls of the admin dashboard (see backend/src/routes/admin.js).
 */
export const adminApi= {
  me: ()=> request("/auth/me"),
  logout: ()=> request("/auth/logout", {}),

  stats: (period)=> request(`/admin/stats?period=${encodeURIComponent(period)}`),
  system: ()=> request("/admin/system"),
  battles: ()=> request("/admin/battles"),
  games: ()=> request("/admin/games"),

  users: (search= "")=> request(`/admin/users?search=${encodeURIComponent(search)}`),
  ban: (userId, reason)=> request(`/admin/users/${userId}/ban`, {reason}),
  unban: (userId)=> request(`/admin/users/${userId}/unban`, {}),
  setAdmin: (userId, isAdmin)=> request(`/admin/users/${userId}/admin`, {isAdmin}),

  reports: (status)=> request(`/admin/reports?status=${encodeURIComponent(status)}`),
  report: (reportId)=> request(`/admin/reports/${reportId}`),
  resolveReport: (reportId, action, note)=> request(`/admin/reports/${reportId}/resolve`, {action, note}),
};
