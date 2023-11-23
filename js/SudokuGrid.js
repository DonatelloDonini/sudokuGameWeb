console.log("SudokuGrid.js");

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
    if (! Number.isInteger(number)) throw new NumberNotIngerError(number);
    
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

    const chosenCellX= this._chooseRandomElement(Array.from(cellsToChooseFrom));
    return {chosenCellX, chosenNumber};
  }

  /**
   * Generate a Sudoku puzzle level by filling in the grid.
   */
  generateLevel(){
    let y=0;
    while (y<this.height) {
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

          } catch (OutOfOptionsGroupsError) {
            console.warn("going up one row for shortage of number options");
            x= 0;
            
            this.clearRow(y);
            
            numberPossibilities= new NumberPossibilities(this, y);
            cellPossibilities= new CellPossibilities(this, y);
          }
        }
        y++;
      }
      else{
        console.warn(`For row ${y} there aren't enough possibilities.`);
        this.clearRow(y);
        y--;
        this.clearRow(y);
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
      const rowNumbersToAnalyze= this.getRowNumbers([i, 0]);
      const columnNumbersToAnalyze= this.getColumnNumbers([0, i]);
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
        gridCopy.set(this.get(currCord), currCord);
      }
    }

    return gridCopy;
  }

  /**
   * Get the string representation of how many numbers can still be removed from each area of the grid (row, column and quadrant).
   * 
   * @private
   * @param {list[number]} rowCounts A list containing how many numbers can be removed from each row.
   * @param {list[number]} columnCounts A list containing how many numbers can be removed from each column.
   * @param {list[number]} quadrantCounts A list containing how many numbers can be removed from each quadrant.
   * @returns {string} A string representation of how many numbers can be inserted in the grid.
   */
  _displayUnsolvedLevelCounts(rowCounts, columnCounts, quadrantCounts) {
    let refill= "  ";
    // displaying the column counts
    for (let x= 0; x<this.width; x++){
      refill+= (x%3=== 0) ? `   ${columnCounts[x]}` : ` ${columnCounts[x]}`;
    }

    refill+= "  \n";
    refill+= "    ------- ------- ------- \n";
    
    // display row and quadrant counts
    for (let y= 0; y<this.width; y++){
      refill+= ((y-1)%3=== 0) ? ` ${rowCounts[y]} |   ${quadrantCounts[y-1]}   |   ${quadrantCounts[y]}   |   ${quadrantCounts[y+1]}   |\n` : ` ${rowCounts[y]} |       |       |       |\n`;
      
      if ((y+1)%3=== 0) refill+= "    ------- ------- ------- \n";
    }
    return refill;
  }

  /**
   * Get the list of the numbers you can delete from a row
   * 
   * @private
   * @param {number} rowIndex The index of the row you want to know the list of removable indexes
   * @param {list[number]} rowCounts A list containing how many numbers can be removed from each row
   * @param {list[number]} columnCounts A list containing how many numbers can be removed from each column
   * @param {list[number]} quadrantCounts A list containing how many numbers can be removed from each quadrant
   * @param {list[number]} alreadyRemovedIndexes A list containing all the x-coordinates of the cells that have already been emptied
   */
  _getPossibleIndexesToDelete(rowIndex, rowCounts, columnCounts, quadrantCounts, alreadyRemovedIndexes){
    const possibleIndexesToDelete= [];
    for (let x= 0; x<this.width; x++){
      const hasCoordAlreadyBeenRemoved= alreadyRemovedIndexes.has(x);
      const isRowFull= rowCounts[rowIndex]<= 0;
      const isColumnFull= columnCounts[x]<= 0;
      const isQuadrantFull= quadrantCounts[Math.floor(rowIndex/3)*3+Math.floor(x/3)]<= 0;

      if (
        ! (hasCoordAlreadyBeenRemoved) &&
        ! (isRowFull) &&
        ! (isColumnFull) &&
        ! (isQuadrantFull)
      ) possibleIndexesToDelete.push(x)
    }

    return possibleIndexesToDelete;
  }

  /**
   * Returns a ready-to-play level of sudoku.
   * @param {number} numberOfNumbersToDelete How many numbers you want to delete per row, column and quadrant.
   */
  unsolve(numberOfNumbersToDelete){
    if (
      (numberOfNumbersToDelete< 0) || // number is negative
      (numberOfNumbersToDelete> this.width)    // no numbers are displayed on the grid
    ) throw new NumberNotInRangeError(numberOfNumbersToDelete, 0, 9);

    const rowCounts= [];
    const columnCounts= [];
    const quadrantCounts= [];

    for (let i= 0; i<this.width; i++){
      rowCounts.push(numberOfNumbersToDelete);
      columnCounts.push(numberOfNumbersToDelete);
      quadrantCounts.push(numberOfNumbersToDelete);
    }
    
    for (let y= 0; y<this.height; y++){
      const alreadyRemovedIndexes= new Set();
      
      for (let x= 0; x<numberOfNumbersToDelete; x++){
        
        // looking for possible indexes to remove
        const possibleIndexesToDelete= this._getPossibleIndexesToDelete(y, rowCounts, columnCounts, quadrantCounts, alreadyRemovedIndexes);
        if (possibleIndexesToDelete.length=== 0) break
        // removing a random index from the available ones
        const randomIndex= this._chooseRandomElement(possibleIndexesToDelete);
        alreadyRemovedIndexes.add(randomIndex);

        // updating the counts
        rowCounts[y]--;
        columnCounts[randomIndex]--;
        quadrantCounts[Math.floor(y/3)*3+Math.floor(randomIndex/3)]--;

        this.deleteElement([randomIndex, y]);
      }
    }
  }
}