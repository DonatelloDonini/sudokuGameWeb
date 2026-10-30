/**
 * Represents a grid with a specified width and height for managing and manipulating data.
 */
class Grid {
  /**
   * Create a new Grid with the specified width and height.
   *
   * @param {number} width The width of the grid.
   * @param {number} height The height of the grid.
   * @throws {InvalidDimensionError} if the dimensions passed are not right
   */
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this._initialize();
  }

  /**
   * Initialize the grid with null values.
   * @private
   * This method sets up the grid with the specified width and height, filling it with
   * null values.
   */
  _initialize() {
    Grid.isValidDimension(this.width);
    Grid.isValidDimension(this.height);

    this._matrix = [];
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        row.push(null);
      }

      this._matrix.push(row);
    }
  }

  /**
   * Get the value at the specified coordinate.
   *
   * @param {[number, number]} coord The coordinate [x, y] within the grid.
   * @returns {*} The value at the specified coordinate.
   * @throws {CoordOutOfBoundsError} If the coordinate is out of bounds.
   */
  get(coord) {
    this.isCoordInRange(coord);
    return this._matrix[coord[1]][coord[0]];
  }

  /**
   * Set a value at the specified coordinate.
   *
   * @param {*} value The value to set at the coordinate.
   * @param {[number, number]} coord The coordinate [x, y] within the grid.
   */
  set(value, coord) {
    this.isCoordInRange(coord);
    this._matrix[coord[1]][coord[0]] = value;
  }

  /**
   * Delete the element at the specified coordinate by setting it to null.
   *
   * @param {[number, number]} coord The coordinate [x, y] within the grid.
   */
  deleteElement(coord) {
    this.isCoordInRange(coord);
    this._matrix[coord[1]][coord[0]] = null;
  }

  /**
   * Check if a coordinate is within the valid range of the grid.
   *
   * @param {[number, number]} coord The coordinate [x, y] to be checked.
   * @throws {CoordOutOfBoundsError} If the coordinate is out of bounds.
   */
  isCoordInRange(coord) {
    const x = coord[0];
    const y = coord[1];

    if (!(x >= 0 && y >= 0 && x < this.width && y < this.height)) {
      throw new CoordOutOfBoundsError(coord, this.width, this.height);
    }
  }

  /**
   * Check if a dimension is valid (positive integer).
   *
   * @param {number} dimension The dimension to be checked.
   * @throws {InvalidDimensionError} If the dimension is not a positive integer.
   */
  static isValidDimension(dimension) {
    if (!Number.isInteger(dimension) || dimension <= 0) {
      throw new InvalidDimensionError(dimension);
    }
  }

  /**
   * Checks wether an array of arrays can be considered a matrix.
   * 
   * @private
   * @param {list[list[]]} matrix The matrix you want to check.
   * @throws {InvalidMatrixShapeError} If the lengths of the rows aren't all the same.
  */
 static isValidMatrix(matrix){
   Grid.isValidDimension(matrix.length);
   
   const firstRowLength= matrix[0].length;
   for (let y= 1; y<matrix.length; y++){
     if (firstRowLength!== matrix[y].length){
       throw new InvalidMatrixShapeError();
      }
    }
  }
  
  /**
   * Returns a copy of the current Grid.
   * @returns {Grid} A copy of the matrix passed wrapped by the Grid class.
   * @throws {InvalidMatrixShapeError} If the passed grid to copy has an invalid shape.
   */
  copy(){
    const gridCopy= new Grid(this.width, this.height);
    for (let y= 0; y<gridCopy.height; y++){
      for (let x= 0; x<gridCopy.width; x++){
        const currCord= [x, y];
        gridCopy.set(this.get(currCord), currCord);
      }
    }

    return gridCopy;
  }
}