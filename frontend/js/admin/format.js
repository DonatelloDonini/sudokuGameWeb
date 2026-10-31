import { formatDuration } from "../utils.js";

export { formatDuration };

const dateTimeFormat= new Intl.DateTimeFormat(undefined, {dateStyle: "medium", timeStyle: "short"});
const dateFormat= new Intl.DateTimeFormat(undefined, {dateStyle: "medium"});
// the days of the activity chart are calendar days: no timezone shift
const dayFormat= new Intl.DateTimeFormat(undefined, {day: "numeric", month: "short", timeZone: "UTC"});

export const formatDateTime= (time)=> time=== null || time=== undefined ? "" : dateTimeFormat.format(new Date(time));
export const formatDate= (time)=> time=== null || time=== undefined ? "" : dateFormat.format(new Date(time));
export const formatDay= (time)=> dayFormat.format(new Date(time));

export const formatBytes= (bytes)=> {
  if (bytes=== null || bytes=== undefined) return "–";
  const units= ["B", "KB", "MB", "GB"];
  let value= bytes;
  let unit= 0;
  while (value>= 1024 && unit< units.length - 1){
    value/= 1024;
    unit++;
  }
  return `${value.toFixed(unit=== 0 ? 0 : 1)} ${units[unit]}`;
};

export const formatPercent= (part, total)=> total> 0 ? `${Math.round((part / total) * 100)}%` : "–";

export const capitalize= (text)=> text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
