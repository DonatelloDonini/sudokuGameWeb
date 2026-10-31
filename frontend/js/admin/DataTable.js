import { el, fill } from "../utils.js";

/**
 * @typedef {Object} Column
 * @property {string} key The row property shown.
 * @property {string} label
 * @property {Function} [format] (value, row) => string | Node.
 * @property {Function} [sortValue] (row) => what the column is sorted by (default: the value).
 * @property {boolean} [numeric] Right aligned.
 */

/**
 * A table with sortable columns, a search box and pages (the AG Grid of the OpenCV Editor's dashboard, in small).
 */
export default class DataTable{
  /**
   * @param {Object} options
   * @param {Column[]} options.columns
   * @param {Object[]} options.rows
   * @param {string[]} [options.searchKeys] The properties the search box looks into (none: no search box).
   * @param {Function} [options.actions] (row) => Node[] shown in a last column.
   * @param {Function} [options.onRowClick] (row) => void, makes the rows clickable.
   * @param {string} [options.emptyText]
   * @param {number} [options.pageSize]
   * @param {string} [options.caption] Read by screen readers.
   */
  constructor({columns, rows, searchKeys= [], actions= null, onRowClick= null, emptyText= "Nothing here yet.", pageSize= 25, caption= ""}){
    this.columns= columns;
    this.rows= rows;
    this.searchKeys= searchKeys;
    this.actions= actions;
    this.onRowClick= onRowClick;
    this.emptyText= emptyText;
    this.pageSize= pageSize;
    this.caption= caption;

    this.search= "";
    this.sort= {key: null, direction: 1};
    this.page= 0;

    this.DOMElement= el("div", {className: "dataTable"});
    this.#build();
  }

  #build(){
    this.searchInput= this.searchKeys.length> 0
      ? el("input", {type: "search", className: "input", placeholder: "Search…", "aria-label": "Search the table"})
      : null;
    this.searchInput?.addEventListener("input", ()=> {
      this.search= this.searchInput.value.trim().toLowerCase();
      this.page= 0;
      this.#render();
    });

    this.tableBody= el("tbody");
    this.headerCells= this.columns.map(column=> {
      const button= el("button", {type: "button", className: "sortButton", text: column.label, onClick: ()=> this.#sortBy(column.key)});
      return el("th", {scope: "col", className: column.numeric ? "numeric" : "", "aria-sort": "none"}, button);
    });

    this.footer= el("div", {className: "tableFooter"});

    fill(this.DOMElement,
      this.searchInput ? el("div", {className: "tableToolbar"}, this.searchInput) : null,
      el("div", {className: "tableScroll"},
        el("table", {},
          this.caption ? el("caption", {className: "visuallyHidden", text: this.caption}) : null,
          el("thead", {}, el("tr", {}, ...this.headerCells, this.actions ? el("th", {scope: "col", className: "actionsColumn"}, el("span", {className: "visuallyHidden", text: "Actions"})) : null)),
          this.tableBody,
        ),
      ),
      this.footer,
    );
    this.#render();
  }

  /**
   * Replaces the rows, keeping the search, the sorting and (when possible) the page.
   */
  setRows(rows){
    this.rows= rows;
    this.#render();
  }

  #sortBy(key){
    this.sort= this.sort.key=== key ? {key, direction: -this.sort.direction} : {key, direction: 1};
    this.#render();
  }

  /**
   * @returns {Object[]} The rows matching the search, sorted.
   */
  visibleRows(){
    let rows= this.rows;
    if (this.search){
      rows= rows.filter(row=> this.searchKeys.some(key=> String(row[key] ?? "").toLowerCase().includes(this.search)));
    }

    if (this.sort.key!== null){
      const column= this.columns.find(candidate=> candidate.key=== this.sort.key);
      const valueOf= column.sortValue ?? ((row)=> row[column.key]);
      rows= [...rows].sort((a, b)=> {
        const left= valueOf(a);
        const right= valueOf(b);
        if (left=== right) return 0;
        if (left=== null || left=== undefined) return 1;
        if (right=== null || right=== undefined) return -1;
        return (typeof left=== "number" && typeof right=== "number" ? left - right : String(left).localeCompare(String(right))) * this.sort.direction;
      });
    }
    return rows;
  }

  #render(){
    const rows= this.visibleRows();
    const pages= Math.max(1, Math.ceil(rows.length / this.pageSize));
    this.page= Math.min(this.page, pages - 1);
    const pageRows= rows.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize);

    this.headerCells.forEach((cell, i)=> {
      const key= this.columns[i].key;
      cell.setAttribute("aria-sort", this.sort.key!== key ? "none" : this.sort.direction> 0 ? "ascending" : "descending");
    });

    if (pageRows.length=== 0){
      const columnCount= this.columns.length + (this.actions ? 1 : 0);
      this.tableBody.replaceChildren(el("tr", {}, el("td", {colspan: columnCount, className: "emptyRow", text: this.search ? "No match." : this.emptyText})));
    }
    else{
      this.tableBody.replaceChildren(...pageRows.map(row=> this.#row(row)));
    }

    const first= rows.length=== 0 ? 0 : this.page * this.pageSize + 1;
    const last= Math.min(rows.length, (this.page + 1) * this.pageSize);
    fill(this.footer,
      el("span", {className: "muted", text: `${first}–${last} of ${rows.length}`}),
      pages> 1 ? el("div", {className: "pager"},
        el("button", {type: "button", className: "button", text: "Previous", disabled: this.page=== 0, onClick: ()=> this.#goTo(this.page - 1)}),
        el("span", {className: "muted", text: `Page ${this.page + 1} of ${pages}`}),
        el("button", {type: "button", className: "button", text: "Next", disabled: this.page=== pages - 1, onClick: ()=> this.#goTo(this.page + 1)}),
      ) : null,
    );
  }

  #goTo(page){
    this.page= page;
    this.#render();
  }

  #row(row){
    const cells= this.columns.map(column=> {
      const formatted= column.format ? column.format(row[column.key], row) : row[column.key];
      const content= formatted instanceof Node ? formatted : document.createTextNode(String(formatted ?? ""));
      return el("td", {className: column.numeric ? "numeric" : ""}, content);
    });
    if (this.actions) cells.push(el("td", {className: "actionsColumn"}, el("div", {className: "rowActions"}, ...this.actions(row))));

    const tableRow= el("tr", {}, ...cells);
    if (this.onRowClick){
      tableRow.classList.add("clickable");
      tableRow.tabIndex= 0;
      tableRow.addEventListener("click", (event)=> {
        if (! event.target.closest("button, a, input")) this.onRowClick(row);
      });
      tableRow.addEventListener("keydown", (event)=> {
        if (event.key=== "Enter" && event.target=== tableRow) this.onRowClick(row);
      });
    }
    return tableRow;
  }
}
