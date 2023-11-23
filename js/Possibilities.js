console.log("Possibilities.js");

/**
 * @abstract 
 * Class to represent the possibilities of a subject.\
 * A subject is either a number of a cell coordinate.\
 * For numbers, their possibilities are a set of cell X coords they can be put into (the Y is passed in the constructor).\
 * For cell X coordinates, their possibilities are the set of numbers that can be inserted in a specific moment in the cell itself.
*/
class Possibilities{
  /**
   * @param {SudokuGrid} sudokuGrid The sudoku grid on which the possibilities calculations with be applied to
   * @param {number} rowIndex The index of the sudokuGrid's row you want to analyze
   */
  constructor(sudokuGrid, rowIndex){
    this.sudokuGrid= sudokuGrid;
    this.rowIndex= rowIndex;
    this._initialize();
  }

  /**
   * Initializes the possibilities.
   */
  _initialize() {
    if (typeof this._possibilities === 'undefined') {
      throw new NotImplementedError("Subclasses should define '_possibilities' in the '_initialize' method.");
    }
  }
  
  /**
   * Get a string representation of the class instance.
   * @return {string} a string that shows in which group the subject falls into, the subject itself and the possibilities it has
   */
  toString(){
    throw new NotImplementedError();
  }
  
  /**
   * Checks wether the current possibilities in the sudoku grid are enough to fill the entire row.
   * @returns {boolean}
   */
  areEnough(){
    throw new NotImplementedError();
  }

  /**
   * Checks wether 2 coords are the same
   * @param {[Number, Number]} coord1 the first coordinate
   * @param {[Number, Number]} coord2 the second coordinate
   * @returns {boolean}
   */
  _isSameCoord(coord1, coord2){
    return (coord1[0]=== coord2[0]) && (coord1[1]=== coord2[2]);
  }

  /**
   * Returns an object containing the subjects of the possibilities along with the associated possibilities.\
   * The number of possibilities is the same for each subject in the group.
   * @param {number} groupIndex the index of the numbers'group you want to retrieve
   * @returns {Object}
   */
  getOptionsGroup(groupIndex){
    const keys= Object.keys(this._possibilities);
    if (groupIndex>= keys.length) throw new OutOfOptionsGroupsError();

    const sortedKeys= keys.sort();
    return this._possibilities[sortedKeys[groupIndex]];
  }

  /**
   * Removes a group if it doesn't contain any subject, therefore any possibility.
   * @param {number} numberOfOptions The length a possibilities group refers to
   */
  _removeGroupIfEmpty(numberOfOptions){
    if (Object.keys(this._possibilities[numberOfOptions]).length=== 0){
      delete this._possibilities[numberOfOptions]
    }
  }

  /**
   * Removes a subject and an options from every subject without breaking the grouping part
   * @param {number} subjectToRemove The subject you want to remove
   * @param {number} optionToRemove The option you want to remove from all the subjects
   */
  update(subjectToRemove, optionToRemove){
    for (let numberOfOptions of Object.keys(this._possibilities)) {
      numberOfOptions= Number(numberOfOptions);
      const optionsGroup= this._possibilities[numberOfOptions];
      //////                          //////
      ////// removing subjectToRemove //////
      //////                          //////
      
      delete optionsGroup[subjectToRemove];
      this._removeGroupIfEmpty(numberOfOptions);
      
      for (const [subject, optionsSet] of Object.entries(optionsGroup)){
        if (optionsSet.has(optionToRemove)){
          //////                         //////
          ////// removing optionToRemove //////
          //////                         //////

          optionsSet.delete(optionToRemove);
  
          const previousGroupAlreadyExists= (
            (this._possibilities[numberOfOptions-1]!== null) &&         // already defined
            (typeof this._possibilities[numberOfOptions-1]=== "object") // right type
          );
          
          // putting the possibility from the group with n options to the group with n-1 options
          if (! previousGroupAlreadyExists) {
            this._possibilities[numberOfOptions-1]= {};
          }
          delete this._possibilities[numberOfOptions][subject];
          this._possibilities[numberOfOptions-1][subject]= optionsSet;
  
          this._removeGroupIfEmpty(numberOfOptions);
        }
      }
    }
  }
}