const Grid= require("./Grid");
const NumberPossibilities= require("./NumberPossibilities");
const CellPossibilities= require("./CellPossibilities");
const {hasUniqueSolution}= require("./SudokuSolver");
const {
  EmptyArgumentError,
  NumberNotInRangeError,
  NumberNotIntegerError,
  NumberNotPossibleError,
  OutOfOptionsGroupsError,
}= require("./CustomErrors");

/**
 * How many times a row can be restarted before the whole grid is generated again from scratch.
 */
const MAX_ROW_RESTARTS= 1000;

/**
 * Restarting rows is part of the normal generation: only log it when debugging the generator.
 */
const debugLog= process.env.DEBUG_SUDOKU_GENERATOR=== "true" ? console.debug : ()=> {};

/**
 * Class for managing and solving Sudoku puzzles.
 */
class SudokuGrid extends Grid{
  /**
   * Create a new SudokuGrid with a size of 9x9.
   */
  constructor(){
    super(9, 9);
    this.allPossibleDigits= new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }

  /**
   * Get the numbers in the same row as the given coordinate.
   * 
   * @param {[number, number]} coord The coordinate [x, y] within the grid.
   * @returns {Set<number>} A Set of numbers in the same row.
   * @throws {CoordOutOfBoundsError} If the coordinate is out of bounds.
   */
  getRowNumbers(coord){
    this.isCoordInRange(coord);

    const y= coord[1];
    const rowNumbers= new Set();
    for (let x = 0; x < this.width; x++) {
      if (this.get([x, y])!== null) rowNumbers.add(this.get([x, y]));
    }

    return rowNumbers;
  }

  /**
   * Get the numbers in the same column as the given coordinate.
   *
   * @param {[number, number]} coord The coordinate [x, y] within the grid.
   * @returns {Set<number>} A Set of numbers in the same column.
   * @throws {CoordOutOfBoundsError} If the coordinate is out of bounds.
   */
  getColumnNumbers(coord){
    this.isCoordInRange(coord);

    const x= coord[0];
    const columnNumbers= new Set();
    for (let y = 0; y < this.height; y++) {
      if (this.get([x, y])!== null) columnNumbers.add(this.get([x, y]));
    }

    return columnNumbers;
  }

 /**
  * Get the 2 vertices that delimit the area of a sudoku quadrant.
  * @private
  * 
  * @param {[number, number]} coord The coordinate that lays in the quadrant of which you want to find the boundaries.
  * @returns {[[number, number], [number, number]]} The top-left and bottom right coordinates at the edges of the quadrant.
  * @throws {CoordOutOfBoundsError} If the coordinate is out of bounds.
 */
  _getQuadrantBoundaries(coord){
    this.isCoordInRange(coord);
    const x= coord[0];
    const y= coord[1];

    const startCoord= [Math.floor(x/3)*3, Math.floor(y/3)*3];
    const endCoord= [startCoord[0]+3, startCoord[1]+3];

    return [startCoord, endCoord];
  }

  /**
   * Get the numbers in the same 3x3 quadrant as the given coordinate.
   *
   * @param {[number, number]} coord The coordinate [x, y] within the grid.
   * @returns {Set<number>} A Set of numbers in the same quadrant.
   * @throws {CoordOutOfBoundsError} If the coordinate is out of bounds.
   */
  getQuadrantNumbers(coord){
    this.isCoordInRange(coord);
    
    const [startCoord, endCoord]= this._getQuadrantBoundaries(coord);

    const quadrantNumbers= new Set();
    for (let y = startCoord[1]; y < endCoord[1]; y++) {
      for (let x = startCoord[0]; x < endCoord[0]; x++) {
        if (this.get([x, y])!== null) quadrantNumbers.add(this.get([x, y]));
      }
    }

    return quadrantNumbers;
  }

  /**
   * Generate a string representation of the Sudoku grid.
   *
   * @returns {string} A string representation of the Sudoku grid.
   */
  toString(){
    let refill= "";
    
    for (let y=0; y<this.height; y++){
      if (y%3=== 0){
        refill+= " ------- ------- ------- \n";
      }
      refill+= "| ";
      for (let x=0; x<this.width; x++){
        refill+= (this.get([x, y])=== null)? "0 ":this.get([x, y])+ " ";
        if ((x+1)%3=== 0){
          refill+= (x=== this.width-1)? "|\n":"| ";
        }
      }
    }
    refill+= " ------- ------- ------- \n";

    return refill;
  }

  /**
   * Compute the difference between two sets.
   *
   * @private
   * This method calculates the difference between two sets by removing elements from `setToSubtract`
   * that are also present in `setToSubtractFrom`.
   *
   * @param {Set} setToSubtractFrom The set from which elements will be subtracted.
   * @param {Set} setToSubtract The set of elements to be subtracted from the first set.
   * @returns {Set} A new Set containing the elements from `setToSubtractFrom` after the subtraction.
   */
  _setDifference(setToSubtractFrom, setToSubtract){
    const result= new Set(setToSubtractFrom);

    for (const element of setToSubtract){
      result.delete(element);
    }
    return result;
  }

  /**
   * Compute the union of multiple sets.
   *
   * @private
   * This method calculates the union of multiple sets by combining all the unique elements
   * from the input sets.
   *
   * @param {...Set} sets The sets to be combined into a single set.
   * @returns {Set} A new Set containing all unique elements from the input sets.
   * @throws {EmptyArgumentError} If no sets are provided as arguments.
   */
  _setSum(...sets){
    if (sets.length=== 0) throw new EmptyArgumentError();

    const mergedSet = new Set(sets[0]);

    for (let i = 1; i < sets.length; i++) {
      sets[i].forEach((element) => {
        mergedSet.add(element);
      });
    }

    return mergedSet;
  }

  /**
   * Compute the intersection of multiple sets.
   *
   * @private
   * This method calculates the intersection of multiple sets (all the elements that are common to all input sets).
   *
   * @param {...Set} sets The sets for which the intersection is to be determined.
   * @returns {Set} A new Set containing the elements common to all input sets.
   * @throws {EmptyArgumentError} If no sets are provided as arguments.
   */
  _setIntersection(...sets) {
    if (sets.length === 0) throw new EmptyArgumentError();
  
    const result = new Set();
  
    sets[0].forEach(element => {
      if (sets.every(set => set.has(element))) {
        result.add(element);
      }
    });
  
    return result;
  }

  /**
   * Get the possible numbers that can be placed in the given coordinate.
   *
   * @param {Array<number>} coord The coordinate [x, y] within the grid.
   * @returns {Set<number>} A Set of possible numbers for the coordinate.
   */
  getPossibleNumbers(coord){
    this.isCoordInRange(coord);
    if (this.get(coord)!== null) return new Set();

    const rowNumbers= this.getRowNumbers(coord);
    const columnNumbers= this.getColumnNumbers(coord);
    const quadrantNumbers= this.getQuadrantNumbers(coord);
    
    const possibleNumbers= new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const notPossibleNumbers= this._setSum(rowNumbers, columnNumbers, quadrantNumbers);

    return this._setDifference(possibleNumbers, notPossibleNumbers)
  }

  /**
   * Clear the entire row in the grid.
   *
   * @param {number} rowIndex The index of the row to clear.
   * @throws {CoordOutOfBoundsError} If the coordinate is out of bounds.
   */
  clearRow(rowIndex){
    this.isCoordInRange([0, rowIndex]);
    for (let x= 0; x<this.width; x++){
      this.deleteElement([x, rowIndex]);
    }
  }

  /**
   * Choose a random element from an iterable.
   *
   * @private
   * @param {Array|Set} iterable The iterable to choose from.
   * @returns {any|undefined} A randomly selected element from the iterable, or null if the iterable is empty.
   */
  _chooseRandomElement(iterable) {
    if (!Array.isArray(iterable) || iterable.length === 0) {
      return undefined; // Return undefined for empty or non-array iterables
    }
  
    const randomIndex = Math.floor(Math.random() * iterable.length);
    return iterable[randomIndex];
  }

  /**
   * Set a number at the specified coordinate.
   *
   * @param {number} number The number to set at the coordinate.
   * @param {[number, number]} coord The coordinate [x, y] within the grid.
   */
  set(number, coord){
    if (! (number>0 && number<10)) throw new NumberNotInRangeError(number, 0, 10);
    if (! Number.isInteger(number)) throw new NumberNotIntegerError(number);
    
    const possibleNumbers= this.getPossibleNumbers(coord);
    if (! possibleNumbers.has(number)) throw new NumberNotPossibleError(number, possibleNumbers);
    super.set(number, coord);
  }

  /**
   * Choose the best number and cell to fill in a Sudoku puzzle based on possibilities.
   *
   * This method selects a number and a cell to place that number based on the Sudoku
   * puzzle's current possibilities.
   *
   * @param {NumberPossibilities} numberPossibilities The possibilities for numbers in the puzzle.
   * @param {CellPossibilities} cellPossibilities The possibilities for cells in the puzzle.
   * @returns {Object} An object containing the chosen cell's X-coordinate and the chosen number.
   */
  _getBestOption(numberPossibilities, cellPossibilities){
    let urgencyIndex= 0;
    let numbersPossibilitiesWithLeastOptions= numberPossibilities.getOptionsGroup(urgencyIndex);
    const cellsPossibilitiesWithLeastOptions= cellPossibilities.getOptionsGroup(urgencyIndex);
    
    //////               //////
    ////// number choice //////
    //////               //////

    let numbersWithLeastOptions= new Set(Object.keys(numbersPossibilitiesWithLeastOptions).map(number => Number(number)));

    const numbersFromCellsPossibilitiesWithLeastOptions= this._setSum(...Object.values(cellsPossibilitiesWithLeastOptions));
    let numbersToChooseFrom= this._setIntersection(numbersWithLeastOptions, numbersFromCellsPossibilitiesWithLeastOptions);
    
    while (numbersToChooseFrom.size=== 0) {
      urgencyIndex++;

      numbersPossibilitiesWithLeastOptions= numberPossibilities.getOptionsGroup(urgencyIndex);
      numbersWithLeastOptions= new Set(Object.keys(numbersPossibilitiesWithLeastOptions).map(key=> Number(key)));
      numbersToChooseFrom= this._setIntersection(numbersWithLeastOptions, numbersFromCellsPossibilitiesWithLeastOptions);
    }

    const chosenNumber= this._chooseRandomElement(Array.from(numbersToChooseFrom));

    //////             //////
    ////// cell choice //////
    //////             //////

    const cellsWithLeastOptions= new Set(Object.keys(cellsPossibilitiesWithLeastOptions).map(cellXCoord => Number(cellXCoord)));
    const cellsFromNumbersWithLeastOptions= this._setSum(...Object.values(numbersPossibilitiesWithLeastOptions));
    const cellsToChooseFrom= this._setIntersection(cellsWithLeastOptions, cellsFromNumbersWithLeastOptions, numbersPossibilitiesWithLeastOptions[chosenNumber]);

    if (cellsToChooseFrom.size=== 0) throw new OutOfOptionsGroupsError();

    const chosenCellX= this._chooseRandomElement(Array.from(cellsToChooseFrom));
    return {chosenCellX, chosenNumber};
  }

  /**
   * Generate a Sudoku puzzle level by filling in the grid.
   */
  generateLevel(){
    let y=0;
    let rowRestarts= 0;
    while (y<this.height) {
      // safety net: if the grid got stuck in a dead end, start over instead of looping forever
      if (rowRestarts> MAX_ROW_RESTARTS){
        console.warn("too many row restarts, generating the grid again from scratch");
        for (let rowIndex= 0; rowIndex<this.height; rowIndex++) this.clearRow(rowIndex);
        y= 0;
        rowRestarts= 0;
      }

      let numberPossibilities= new NumberPossibilities(this, y);
      let cellPossibilities= new CellPossibilities(this, y);

      // if there aren't enough possibilities for numbers or cells,
      // we try to fill the current line another time
      if (numberPossibilities.areEnough() && cellPossibilities.areEnough()){
        let x= this.getRowNumbers([0, y]).size;
        while (x<this.width) {
          try {
            const {chosenCellX, chosenNumber}= this._getBestOption(numberPossibilities, cellPossibilities);
            
            this.set(chosenNumber, [chosenCellX, y]);
            x++;

            numberPossibilities.update(chosenNumber, chosenCellX);
            cellPossibilities.update(chosenCellX, chosenNumber);

          } catch (error) {
            if (! (error instanceof OutOfOptionsGroupsError)) throw error;

            debugLog("restarting the row for shortage of number options");
            x= 0;
            rowRestarts++;
            
            this.clearRow(y);
            
            numberPossibilities= new NumberPossibilities(this, y);
            cellPossibilities= new CellPossibilities(this, y);
          }
        }
        y++;
      }
      else{
        debugLog(`For row ${y} there aren't enough possibilities.`);
        this.clearRow(y);
        rowRestarts++;

        // going up one row (the first row always has enough possibilities, but never go above it)
        if (y> 0){
          y--;
          this.clearRow(y);
        }
      }
    }
  }

  /**
   * Check the validity of the Sudoku grid by verifying that each row, column, and quadrant contains
   * all the numbers from 1 to 9 without repetition.
   *
   * @returns {boolean} True if the Sudoku grid is valid; false otherwise.
   */
  isValid(){
    for (let i= 0; i<9; i++){
      const rowNumbersToAnalyze= this.getRowNumbers([0, i]);
      const columnNumbersToAnalyze= this.getColumnNumbers([i, 0]);
      const quadrantNumbersToAnalyze= this.getQuadrantNumbers([(i*3)%9, Math.floor(i/3)*3]);

      const rowHasAllNumbers= this._setDifference(this.allPossibleDigits, rowNumbersToAnalyze).size=== 0;
      const columnHasAllNumbers= this._setDifference(this.allPossibleDigits, columnNumbersToAnalyze).size=== 0;
      const quadrantHasAllNumbers= this._setDifference(this.allPossibleDigits, quadrantNumbersToAnalyze).size=== 0;
      
      if (
        (! rowHasAllNumbers) ||
        (! columnHasAllNumbers) ||
        (! quadrantHasAllNumbers)
      ){
        return false;
      }
    }

    return true;
  }

  /**
   * Returns a copy of the current Grid.
   * @returns {SudokuGrid} A copy of the matrix passed wrapped by the Grid class.
   * @throws {InvalidMatrixShapeError} If the passed grid to copy has an invalid shape.
   */
  copy(){
    const gridCopy= new SudokuGrid();
    for (let y= 0; y<gridCopy.height; y++){
      for (let x= 0; x<gridCopy.width; x++){
        const currCord= [x, y];
        // empty cells are already null in the copy, and SudokuGrid.set only accepts digits
        if (this.get(currCord)!== null) gridCopy.set(this.get(currCord), currCord);
      }
    }

    return gridCopy;
  }

  /**
   * Shuffles a copy of an array (Fisher-Yates).
   *
   * @private
   * @param {Array} array The array to shuffle.
   * @returns {Array} A new array with the same elements in random order.
   */
  _shuffle(array){
    const shuffled= [...array];
    for (let i= shuffled.length-1; i>0; i--){
      const j= Math.floor(Math.random()*(i+1));
      [shuffled[i], shuffled[j]]= [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  /**
   * Turns the solved grid into a ready-to-play level by emptying cells in random order.\
   * A cell is only emptied if the level keeps a single solution, so the target might not be reached:
   * the cells that can't be emptied anymore are kept.
   *
   * @param {number} numberOfCellsToEmpty How many cells you want to empty (0-81).
   * @returns {number} How many cells were actually emptied.
   * @throws {NumberNotInRangeError} If the number of cells is not between 0 and 81.
   */
  unsolve(numberOfCellsToEmpty){
    const totalCells= this.width*this.height;
    if (
      (! Number.isInteger(numberOfCellsToEmpty)) ||
      (numberOfCellsToEmpty< 0) ||
      (numberOfCellsToEmpty> totalCells)
    ) throw new NumberNotInRangeError(numberOfCellsToEmpty, 0, totalCells);

    const coords= [];
    for (let y= 0; y<this.height; y++){
      for (let x= 0; x<this.width; x++){
        coords.push([x, y]);
      }
    }

    let emptiedCells= 0;
    const matrix= this.toArray();
    for (const [x, y] of this._shuffle(coords)){
      if (emptiedCells>= numberOfCellsToEmpty) break;

      const removedNumber= matrix[y][x];
      matrix[y][x]= null;

      if (hasUniqueSolution(matrix)){
        this.deleteElement([x, y]);
        emptiedCells++;
      }
      else{
        matrix[y][x]= removedNumber;
      }
    }

    return emptiedCells;
  }
}

module.exports= SudokuGrid;
