import { el } from "../utils.js";

const SVG= "http://www.w3.org/2000/svg";

const svg= (tag, attributes= {})=> {
  const element= document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
};

/**
 * @returns {number[]} About `count` round values from 0 to at least `max`.
 */
const niceTicks= (max, count= 4)=> {
  if (max<= 0) return [0, 1];
  const rawStep= max / count;
  const magnitude= 10 ** Math.floor(Math.log10(rawStep));
  const step= [1, 2, 5, 10].map(factor=> factor * magnitude).find(candidate=> candidate>= rawStep);
  const ticks= [];
  for (let value= 0; value< max + step; value+= step) ticks.push(Math.round(value * 1e6) / 1e6);
  return ticks;
};

/**
 * @typedef {Object} Series
 * @property {string} label
 * @property {string} color A CSS color, from the validated categorical palette (admin.css: --series-n).
 * @property {{x: number, y: number}[]} points Sorted by x.
 */

/**
 * A line chart drawn in SVG, following the dataviz rules: one y axis, 2px lines, recessive grid, a legend and
 * direct labels at the line ends (identity is never color alone), a crosshair tooltip on hover or with the
 * arrow keys, and a table view of the same data.
 */
export default class LineChart{
  /**
   * @param {Object} options
   * @param {string} options.title Names the chart for screen readers and the table view.
   * @param {Series[]} options.series
   * @param {Function} options.formatX (x) => string, for the axis, the tooltip and the table.
   * @param {Function} [options.formatY] (y) => string.
   * @param {boolean} [options.step] Step lines (values that hold until the next point) instead of straight segments.
   * @param {number} [options.height]
   * @param {string} [options.xLabel] Header of the x column in the table view.
   * @param {"data"|"linear"} [options.xTicks] Label the x values of the data (evenly spaced ones, like days),
   *        or round values evenly spread over the axis (for times, where the points can bunch up).
   */
  constructor({title, series, formatX, formatY= String, step= false, height= 260, xLabel= "", xTicks= "data"}){
    this.xTicks= xTicks;
    this.title= title;
    this.series= series;
    this.formatX= formatX;
    this.formatY= formatY;
    this.step= step;
    this.height= height;
    this.xLabel= xLabel;
    this.hoverIndex= null;

    this.xs= [...new Set(series.flatMap(serie=> serie.points.map(point=> point.x)))].sort((a, b)=> a - b);

    this.area= el("div", {className: "chartArea", style: `height: ${height}px`});
    this.tooltip= el("div", {className: "chartTooltip", role: "status", hidden: true});
    this.tableView= el("div", {className: "chartTable", hidden: true});
    const tableToggle= el("button", {type: "button", className: "button", text: "Show as table", "aria-expanded": "false"});
    tableToggle.addEventListener("click", ()=> {
      const showing= this.tableView.hidden;
      this.tableView.hidden= ! showing;
      if (showing && ! this.tableView.firstChild) this.tableView.appendChild(this.#table());
      tableToggle.textContent= showing ? "Hide the table" : "Show as table";
      tableToggle.setAttribute("aria-expanded", String(showing));
    });

    this.DOMElement= el("figure", {className: "lineChart"},
      series.length>= 2 ? el("ul", {className: "chartLegend", "aria-label": "Legend"},
        ...series.map(serie=> el("li", {}, el("span", {className: "swatch", style: `background-color: ${serie.color}`}), serie.label)),
      ) : null,
      el("div", {className: "chartFrame"}, this.area, this.tooltip),
      el("div", {className: "chartTools"}, tableToggle),
      this.tableView,
    );

    // drawn at the size it gets once in the page, and again when that size changes
    this.resizeObserver= new ResizeObserver(()=> this.#draw());
    this.resizeObserver.observe(this.area);
  }

  /** The value of a series at x: the last point at or before x for step lines, the point at x otherwise. */
  #valueAt(serie, x){
    if (this.step){
      let value= null;
      for (const point of serie.points){
        if (point.x> x) break;
        value= point.y;
      }
      return value;
    }
    return serie.points.find(point=> point.x=== x)?.y ?? null;
  }

  #draw(){
    // the page changed: the chart is gone
    if (this.drawn && ! this.area.isConnected){
      this.resizeObserver.disconnect();
      return;
    }

    const width= this.area.clientWidth;
    if (width=== 0) return;
    this.drawn= true;

    const margin= {top: 12, right: 112, bottom: 28, left: 44};
    const plotWidth= Math.max(40, width - margin.left - margin.right);
    const plotHeight= this.height - margin.top - margin.bottom;

    const maxY= Math.max(1, ...this.series.flatMap(serie=> serie.points.map(point=> point.y)));
    const ticks= niceTicks(maxY);
    const topY= ticks.at(-1);
    const minX= this.xs[0] ?? 0;
    const maxX= this.xs.at(-1) ?? 1;

    const scaleX= (x)=> margin.left + (maxX=== minX ? plotWidth / 2 : ((x - minX) / (maxX - minX)) * plotWidth);
    const scaleY= (y)=> margin.top + plotHeight - (y / topY) * plotHeight;
    this.scaleX= scaleX;
    this.scaleY= scaleY;

    const root= svg("svg", {width, height: this.height, viewBox: `0 0 ${width} ${this.height}`, role: "img", "aria-label": this.title});

    // recessive grid and y axis
    for (const tick of ticks){
      root.appendChild(svg("line", {class: "gridLine", x1: margin.left, x2: margin.left + plotWidth, y1: scaleY(tick), y2: scaleY(tick)}));
      const label= svg("text", {class: "axisLabel", x: margin.left - 8, y: scaleY(tick), "text-anchor": "end", "dominant-baseline": "middle"});
      label.textContent= this.formatY(tick);
      root.appendChild(label);
    }

    // one x label every ~90px: picked among the x values, or round values over the axis
    const labelCount= Math.max(2, Math.floor(plotWidth / 90));
    const labelEvery= Math.max(1, Math.ceil(this.xs.length / labelCount));
    const xLabels= this.xTicks=== "linear"
      ? niceTicks(maxX - minX, labelCount).map(tick=> minX + tick).filter(tick=> tick<= maxX)
      : this.xs.filter((_, i)=> i % labelEvery=== 0);
    for (const x of xLabels){
      const label= svg("text", {class: "axisLabel", x: scaleX(x), y: this.height - 8, "text-anchor": "middle"});
      label.textContent= this.formatX(x);
      root.appendChild(label);
    }

    // the lines, 2px, with markers when there are few points
    const showMarkers= this.xs.length<= 31;
    const endLabels= [];
    for (const serie of this.series){
      if (serie.points.length=== 0) continue;

      let path= "";
      serie.points.forEach((point, i)=> {
        const x= scaleX(point.x);
        const y= scaleY(point.y);
        if (i=== 0) path+= `M${x},${y}`;
        else path+= this.step ? `H${x}V${y}` : `L${x},${y}`;
      });
      // a style, not the stroke attribute: the colors are CSS variables
      root.appendChild(svg("path", {class: "seriesLine", d: path, style: `stroke: ${serie.color}`}));

      if (showMarkers){
        for (const point of serie.points){
          root.appendChild(svg("circle", {class: "seriesMarker", cx: scaleX(point.x), cy: scaleY(point.y), r: 4, style: `fill: ${serie.color}`}));
        }
      }

      const last= serie.points.at(-1);
      endLabels.push({serie, x: scaleX(last.x), y: scaleY(last.y)});
    }

    // direct labels at the end of the lines, moved apart when they would overlap
    endLabels.sort((a, b)=> a.y - b.y);
    for (let i= 1; i<endLabels.length; i++){
      endLabels[i].y= Math.max(endLabels[i].y, endLabels[i - 1].y + 16);
    }
    for (const {serie, x, y} of endLabels){
      const label= svg("text", {class: "directLabel", x: x + 10, y, "dominant-baseline": "middle"});
      label.textContent= serie.label;
      root.appendChild(label);
    }

    // the crosshair, following the pointer or the arrow keys
    this.crosshair= svg("line", {class: "crosshair", y1: margin.top, y2: margin.top + plotHeight, visibility: "hidden"});
    this.hoverMarkers= this.series.map(serie=> svg("circle", {class: "hoverMarker", r: 5, style: `fill: ${serie.color}`, visibility: "hidden"}));
    root.append(this.crosshair, ...this.hoverMarkers);

    const overlay= svg("rect", {class: "chartOverlay", x: margin.left - 8, y: margin.top, width: plotWidth + 16, height: plotHeight, tabindex: 0, "aria-label": `${this.title}: use the arrow keys to read the values`});
    overlay.addEventListener("pointermove", (event)=> {
      const bounds= root.getBoundingClientRect();
      const pointerX= event.clientX - bounds.left;
      let nearest= 0;
      this.xs.forEach((x, i)=> {
        if (Math.abs(scaleX(x) - pointerX)< Math.abs(scaleX(this.xs[nearest]) - pointerX)) nearest= i;
      });
      this.#hover(nearest);
    });
    overlay.addEventListener("pointerleave", ()=> this.#hover(null));
    overlay.addEventListener("blur", ()=> this.#hover(null));
    overlay.addEventListener("keydown", (event)=> {
      if (! ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const last= this.xs.length - 1;
      const current= this.hoverIndex ?? (event.key=== "ArrowLeft" ? last + 1 : -1);
      const next= {ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: last}[event.key];
      this.#hover(Math.max(0, Math.min(last, next)));
    });
    root.appendChild(overlay);

    this.area.replaceChildren(root);
    if (this.hoverIndex!== null) this.#hover(this.hoverIndex);
  }

  #hover(index){
    this.hoverIndex= index;
    if (index=== null || this.xs.length=== 0){
      this.crosshair?.setAttribute("visibility", "hidden");
      this.hoverMarkers?.forEach(marker=> marker.setAttribute("visibility", "hidden"));
      this.tooltip.hidden= true;
      return;
    }

    const x= this.xs[index];
    const left= this.scaleX(x);
    this.crosshair.setAttribute("x1", left);
    this.crosshair.setAttribute("x2", left);
    this.crosshair.setAttribute("visibility", "visible");

    const rows= this.series.map((serie, i)=> {
      const value= this.#valueAt(serie, x);
      const marker= this.hoverMarkers[i];
      if (value=== null){
        marker.setAttribute("visibility", "hidden");
      }
      else{
        marker.setAttribute("cx", left);
        marker.setAttribute("cy", this.scaleY(value));
        marker.setAttribute("visibility", "visible");
      }
      return el("div", {className: "tooltipRow"},
        el("span", {className: "swatch", style: `background-color: ${serie.color}`}),
        el("span", {text: serie.label}),
        el("strong", {text: value=== null ? "–" : this.formatY(value)}),
      );
    });

    this.tooltip.replaceChildren(el("div", {className: "tooltipTitle", text: this.formatX(x)}), ...rows);
    this.tooltip.hidden= false;

    // on the side of the crosshair with more room
    const areaWidth= this.area.clientWidth;
    const tooltipWidth= this.tooltip.offsetWidth;
    const placeLeft= left + 16 + tooltipWidth> areaWidth;
    this.tooltip.style.left= `${placeLeft ? Math.max(0, left - 16 - tooltipWidth) : left + 16}px`;
  }

  #table(){
    return el("table", {},
      el("caption", {className: "visuallyHidden", text: this.title}),
      el("thead", {}, el("tr", {},
        el("th", {scope: "col", text: this.xLabel}),
        ...this.series.map(serie=> el("th", {scope: "col", className: "numeric", text: serie.label})),
      )),
      el("tbody", {}, ...this.xs.map(x=> el("tr", {},
        el("th", {scope: "row", text: this.formatX(x)}),
        ...this.series.map(serie=> {
          const value= this.#valueAt(serie, x);
          return el("td", {className: "numeric", text: value=== null ? "–" : this.formatY(value)});
        }),
      ))),
    );
  }
}
