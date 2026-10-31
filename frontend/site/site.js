import { applyRandomPalette } from "../js/Palette.js";

/**
 * The landing page and the developers area: same random palette as the game, and the menu on small screens.
 */
applyRandomPalette();

const menuButton= document.querySelector(".site-menu-button");
const navigation= document.getElementById("site-navigation");

menuButton?.addEventListener("click", ()=> {
  const open= menuButton.getAttribute("aria-expanded")!== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  navigation.classList.toggle("open", open);
});

navigation?.addEventListener("click", (event)=> {
  if (event.target.closest("a")){
    menuButton?.setAttribute("aria-expanded", "false");
    navigation.classList.remove("open");
  }
});

/**
 * The sudoku drawn in the hero of the landing page: a real puzzle being solved, with notes in a few cells.
 */
const heroBoard= document.getElementById("hero-board");
if (heroBoard){
  const puzzle= "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
  const solution= "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
  const filled= new Set([2, 3, 11, 12, 20, 21, 22]);
  const notes= {5: "12", 23: "47", 31: "59"};
  const selected= 22;

  for (let index= 0; index<81; index++){
    const x= index % 9;
    const y= Math.floor(index / 9);
    const cell= document.createElement("span");
    cell.className= "hero-cell";
    if (x % 3=== 2 && x< 8) cell.classList.add("box-right");
    if (y % 3=== 2 && y< 8) cell.classList.add("box-bottom");
    if (Math.floor(selected / 9)=== y || selected % 9=== x) cell.classList.add("peer");
    if (index=== selected) cell.classList.add("selected");

    if (puzzle[index]!== "."){
      cell.textContent= puzzle[index];
      cell.classList.add("given");
    }
    else if (filled.has(index)){
      cell.textContent= solution[index];
    }
    else if (notes[index]){
      cell.textContent= notes[index];
      cell.classList.add("notes");
    }
    heroBoard.appendChild(cell);
  }
}
