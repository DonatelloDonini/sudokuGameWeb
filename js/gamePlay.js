console.log("gamePlay.js");


//////                  //////
////// main begins here //////
//////                  //////

const rootNode= document.getElementById("gamePlay");
const sudokuGrid= new SudokuGrid();
sudokuGrid.generateLevel();

const unsolvedLevel= sudokuGrid.copy();
unsolvedLevel.unsolve(6);


const guiGrid= new GUI_Grid(9, 9, rootNode, "sudokuGrid");
for (let y=0; y<unsolvedLevel.height; y++){
  for (let x= 0; x<unsolvedLevel.width; x++){
    const elementToInsert= unsolvedLevel.get([x, y]);

    if (elementToInsert!== null){
      guiGrid.set(elementToInsert, [x, y]);
    }
    else{
      const numberSelection= getTemplate("numberSelection", {
        "contents": [1, 2, 3, 4, 5, 6, 7, 8, 9],
        "radius": "30px",
        "childrenBackgroundColor": "#1282A2",
        "childrenTextColor": "#FEFCFB",
        "childrenDimensions": "20px",
        "childrenFontSize": ".8rem"
      });

      guiGrid.set(numberSelection, [x, y]);
    }
  }
}

guiGrid.display();

console.log(sudokuGrid.toString());

// tvb <3