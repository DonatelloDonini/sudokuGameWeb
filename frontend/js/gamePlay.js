console.log("gamePlay.js");

const DIFFICULTY= 6;

/**
 * Asks the backend for a new level.
 * @param {number} difficulty How many numbers to delete per row, column and quadrant (0-9).
 * @returns {Promise<{difficulty: number, puzzle: list[list[number|null]], solution: list[list[number]]}>}
 */
const fetchLevel= async (difficulty)=> {
  const response= await fetch(`/api/level?difficulty=${difficulty}`);
  if (! response.ok) throw new Error(`Could not load a level (HTTP ${response.status})`);

  return response.json();
};

/**
 * Draws the puzzle in the page: given numbers are shown as they are, empty cells get the number selection.
 * @param {HTMLElement} rootNode The HTML element where the grid will be appended.
 * @param {list[list[number|null]]} puzzle The level to draw, indexed as puzzle[y][x].
 */
const displayLevel= (rootNode, puzzle)=> {
  const guiGrid= new GUI_Grid(9, 9, rootNode, "sudokuGrid");
  for (let y=0; y<puzzle.length; y++){
    for (let x= 0; x<puzzle[y].length; x++){
      const elementToInsert= puzzle[y][x];

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
};


//////                  //////
////// main begins here //////
//////                  //////

const rootNode= document.getElementById("gamePlay");

fetchLevel(DIFFICULTY)
  .then(level=> displayLevel(rootNode, level.puzzle))
  .catch(error=> {
    console.error(error);
    const errorMessage= document.createElement("p");
    errorMessage.classList.add("errorMessage");
    errorMessage.innerText= "Could not load a new level, please try again later.";
    rootNode.appendChild(errorMessage);
  });

// tvb <3
