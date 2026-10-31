import "./DashboardOption.js";
import { adminApi } from "./adminApi.js";
import { PAGES, ADMIN_ICONS } from "./pages.js";
import { el, icon, loadFromStorage, saveToStorage } from "../utils.js";

/**
 * The admin dashboard, built like the OpenCV Editor's: a side menu of pages (collapsible on desktop,
 * an accordion on mobile) and the opened page in <main>. The browser remembers the last opened page
 * and whether the sidebar is collapsed; admin.html#<page> opens a page directly.
 */

const STORAGE_KEYS= Object.freeze({
  lastOpenedPage: "sudoku-admin-last-page",
  sidebarCollapsed: "sudoku-admin-sidebar-collapsed",
});

document.addEventListener("DOMContentLoaded", async ()=> {
  const main= document.getElementById("dashboardMain");

  let user= null;
  try {
    user= (await adminApi.me()).user;
  }
  catch (error) {
    main.replaceChildren(el("p", {className: "errorText", text: error.message}));
    return;
  }

  if (! user || ! user.isAdmin){
    main.replaceChildren(el("div", {className: "accessDenied"},
      el("h1", {text: "Admins only"}),
      el("p", {text: user
        ? "Your account can't open the dashboard. An admin can give you access from the Users page."
        : "Log in on the game with an admin account, then come back."}),
      el("a", {className: "button button-primary", href: "/play/", text: "Go to the game"}),
    ));
    return;
  }

  buildSidebar(user);
  initMobileMenu();
  initSidebarToggle();

  document.addEventListener("dashboard-option-open", (event)=> {
    saveToStorage(STORAGE_KEYS.lastOpenedPage, event.detail.id);
    document.getElementById("dashboardSidebar").classList.remove("pagesOpen");
    document.getElementById("mobileAccordionMenu").setAttribute("aria-expanded", "false");
  });

  const lastOpened= loadFromStorage(STORAGE_KEYS.lastOpenedPage, PAGES[0].id);
  openPage(linkedPage() ?? (PAGES.some(page=> page.id=== lastOpened) ? lastOpened : PAGES[0].id));

  // links can open a page of the dashboard: admin.html#reports
  window.addEventListener("hashchange", ()=> {
    const page= linkedPage();
    if (page!== null) openPage(page);
  });
});

/**
 * Opens a page of the dashboard by its id (see pages.js).
 */
export const openPage= (id)=> document.getElementById(id)?.open();

/**
 * @returns {string|null} The dashboard page the URL's #fragment names, or null when it names none.
 */
const linkedPage= ()=> {
  const id= location.hash.slice(1);
  return PAGES.some(page=> page.id=== id) ? id : null;
};

const buildSidebar= (user)=> {
  const sidebar= document.getElementById("dashboardSidebar");
  document.getElementById("dashboardOptions").replaceChildren(...PAGES.map(page=> el("dashboard-option", {
    id: page.id,
    icon: page.icon,
    module: page.module,
  }, page.label)));

  // the profile box opens a menu with the links to the rest of the game
  const menu= el("div", {className: "profileMenuItems", role: "menu", hidden: true},
    el("a", {role: "menuitem", href: "/play/", text: "Play sudoku"}),
    el("a", {role: "menuitem", href: "/developers/", text: "Developers area"}),
    el("button", {role: "menuitem", type: "button", text: "Log out", onClick: async ()=> {
      await adminApi.logout().catch(()=> {});
      location.href= "/";
    }}),
  );
  const profileBox= el("button", {type: "button", id: "profileBox", "aria-haspopup": "menu", "aria-expanded": "false"},
    el("span", {className: "avatar", "aria-hidden": "true", text: user.username.charAt(0).toUpperCase()}),
    el("span", {className: "profileName", text: user.username}),
  );
  const toggleMenu= (open)=> {
    menu.hidden= ! open;
    profileBox.setAttribute("aria-expanded", String(open));
  };
  profileBox.addEventListener("click", (event)=> {
    event.stopPropagation();
    toggleMenu(menu.hidden);
  });
  document.addEventListener("click", ()=> toggleMenu(false));
  document.addEventListener("keydown", (event)=> {
    if (event.key=== "Escape") toggleMenu(false);
  });

  document.getElementById("profileMenu").replaceChildren(menu, profileBox);
  sidebar.hidden= false;
};

/**
 * On mobile the pages are an accordion under a "Pages" button.
 */
const initMobileMenu= ()=> {
  const sidebar= document.getElementById("dashboardSidebar");
  const button= document.getElementById("mobileAccordionMenu");
  button.replaceChildren(icon(ADMIN_ICONS.chevron), el("span", {text: "Pages"}));
  button.addEventListener("click", ()=> {
    const open= sidebar.classList.toggle("pagesOpen");
    button.setAttribute("aria-expanded", String(open));
  });
};

/**
 * The toggle at the top of the sidebar collapses it to the pages' icons, and expands it back (desktop only).
 * The browser remembers the choice.
 */
const initSidebarToggle= ()=> {
  const sidebar= document.getElementById("dashboardSidebar");
  const toggle= document.getElementById("sidebarToggle");
  toggle.replaceChildren(icon(ADMIN_ICONS.collapse));

  const setCollapsed= (collapsed)=> {
    sidebar.classList.toggle("collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(! collapsed));
    const action= collapsed ? "Expand the sidebar" : "Collapse the sidebar";
    toggle.setAttribute("aria-label", action);
    toggle.title= action;
  };

  setCollapsed(loadFromStorage(STORAGE_KEYS.sidebarCollapsed, false)=== true);

  toggle.addEventListener("click", ()=> {
    // animated from the first toggle on: a sidebar restored collapsed doesn't animate on load
    sidebar.classList.add("animated");
    const collapsed= ! sidebar.classList.contains("collapsed");
    setCollapsed(collapsed);
    saveToStorage(STORAGE_KEYS.sidebarCollapsed, collapsed);
  });
};
