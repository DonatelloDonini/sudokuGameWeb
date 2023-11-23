console.log("NumberPossibilities.js");

/**
 * Class to associate at each number a set of cell X coords in which the number can be inserted.\
 * Structure:
 * ```
 * {
 *    "possibilitiesSet.size"<int>: {
 *      "number"<int>: "possibilitiesSet"<Set>,
 *      "number"<int>: "possibilitiesSet"<Set>,
 *      ...
 *    },
 *    ...
 * }
 * ```
*/
class NumberPossibilities extends Possibilities{
  /**
   * @param {SudokuGrid} sudokuGrid The sudokuGrid on which the CellPossibilities calculations will be applied on
   * @param {number} rowIndex The index of the sudokuGrid's row you want to analyze
   */
  constructor(sudokuGrid, rowIndex){
    super(sudokuGrid, rowIndex);
    this._initialize();
  }

  _initialize(){
    const numberPossibilities= {};

    for (const possibleDigit of sudokuGrid.allPossibleDigits) {
      numberPossibilities[possibleDigit]= new Set();
    }

    for (let x = 0; x < this.sudokuGrid.width; x++) {
      const cellPossibleNumbers= this.sudokuGrid.getPossibleNumbers([x, this.rowIndex]);
      cellPossibleNumbers.forEach(number => numberPossibilities[number].add(x));
    }

    this._possibilities= {};
    Object.entries(numberPossibilities).forEach(([number, possibilitiesSet]) => {
      number= Number(number);

      if (possibilitiesSet.size!== 0) {
        if (! this._possibilities[possibilitiesSet.size]) this._possibilities[possibilitiesSet.size]= {};
        this._possibilities[possibilitiesSet.size][number]= possibilitiesSet;
      }
    });
  }

  areEnough(){
    const digits= new Set(sudokuGrid.allPossibleDigits);
    sudokuGrid.getRowNumbers([0, this.rowIndex]).forEach(alreadyPresentDigit => digits.delete(alreadyPresentDigit));
    
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
    let refill= `NumberPossibilities: {\n`;
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