console.log("CellPossibilities.js");

/**
 * Class to associate at each cell the set of numbers that can be put in it.  
 * Structure:
 * ```
 * {
 *    "possibilitiesSet.size"<int>: {
 *      "cellXCoord"<int>: "possibilitiesSet"<Set>,
 *      "cellXCoord"<int>: "possibilitiesSet"<Set>,
 *      ...
 *    },
 *    ...
 * }
 * ```
 */
class CellPossibilities extends Possibilities{
  /**
   * @param {SudokuGrid} sudokuGrid The sudokuGrid on which the CellPossibilities calculations will be applied on
   * @param {number} rowIndex The index of the sudokuGrid's row you want to analyze
   */
  constructor(sudokuGrid, rowIndex){
    super(sudokuGrid, rowIndex);
    this._initialize();
  }

  _initialize(){
    this._possibilities= {};
    for (let x= 0; x<this.sudokuGrid.width; x++){
      const possibleNumbers= this.sudokuGrid.getPossibleNumbers([x, this.rowIndex]);
      const possibleNumbersNotEmpty= possibleNumbers.size!== 0;
      const possibilitiesGroupAlreadyInitiailzed= this._possibilities[possibleNumbers.size];

      if (possibleNumbersNotEmpty){
        if (!possibilitiesGroupAlreadyInitiailzed){
          this._possibilities[possibleNumbers.size]= {};
        }
        
        this._possibilities[possibleNumbers.size][x]= possibleNumbers;
      }
    }
  }

  areEnough(){
    const digits= new Set();
    for (let i= 0; i<this.sudokuGrid.width; i++){
      if (! sudokuGrid.get([i, this.rowIndex])) {
        digits.add(i);
      }
    }

    for (const numberOfOptions of Object.keys(this._possibilities)){
      if (numberOfOptions> 0){
        const possibilitiesGroup= this._possibilities[numberOfOptions];

        for (const subject of Object.keys(possibilitiesGroup)){
          digits.delete(Number(subject));
        }
      }
    }

    return digits.size=== 0;
  }

  toString(){
    let refill= `CellPossibilities: {\n`;
    for (const numberOfOptions of Object.keys(this._possibilities)) {
      const possibilitiesGroup= this._possibilities[numberOfOptions];
      refill+= `\t${numberOfOptions}{\n`;

      for (const [subject, possibilitiesSet] of Object.entries(possibilitiesGroup)) {
        refill+= `\t\t${subject}=> ${Array.from(possibilitiesSet)}\n`;
      }
      
      refill+= `\t}\n`;
    }
    refill+= `}\n`;
    
    return refill;
  }
}