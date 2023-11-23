/**
 * Class representing a graphical grid.
 * @extends Grid
 */
class GUI_Grid extends Grid{
  /**
   * Create a GUI_Grid.
   * @param {number} width - The width of the grid.
   * @param {number} height - The height of the grid.
   * @param {HTMLElement} rootNode - The HTML element where the grid will be appended.
   * @param {string} id - The ID of the grid.
   */
  constructor(width, height, rootNode, id){
    super(width, height);
    this.rootNode= rootNode;
    this.id= id;
  }

  /**
   * Initializes the grid's structure by creating an HTML table with rows and cells.
   * @private
   */
  _initialize(){
    this._matrix= document.createElement("table");
    this._matrix.setAttribute("id", "sudokuGrid");
    const width= 9;
    const height= 9;
    for (let y= 0; y<height; y++){
      const row= document.createElement("tr");
  
      for (let x= 0; x<width; x++){
        row.appendChild(document.createElement("td"));
      }
  
      this._matrix.appendChild(row);
    }
  }

  /**
   * Displays the grid within the specified HTML element. Replaces an existing element with the same ID, if it exists.
   */
  display(){
    const elementToReplace= this.rootNode.querySelector(`#${this.id}`);
    elementToReplace? this.rootNode.replaceChild(elementToReplace, this._matrix) : this.rootNode.appendChild(this._matrix);
  }

  /**
   * Sets a value at a specified coordinate in the grid by replacing the content of the cell.
   * @param {string} value - The value to set in the cell.
   * @param {[number, number]} coord - The coordinates [x, y] where the value should be set.
   */
  set(value, coord){
    this._matrix.children[coord[1]].children[coord[0]].replaceChildren(value);
  }
}