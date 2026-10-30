const htmlTemplates= {
  "numberSelection": (attrs)=> {
    //////                 //////
    ////// defining styles //////
    //////                 //////

    const containerStyle= `
      width: inhert;
      height: inherit;
      line-height: inherit;
      position: relative;
    `;
    const numberOptionsContainerStyle= `
      width: 100%;
      height: 100%;
      position: relative;
      border-radius: 50%;
      display: none;
      justify-content: center;
      align-items: center;
    `;
    const selectedNumberStyle= `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-weight: 1000;
    `;

    //////                             //////
    ////// defining internal structure //////
    //////                             //////

    let {contents}= attrs;
    const container= document.createElement("div");
    container.style.cssText= containerStyle;

    const selectedNumberContainer= document.createElement("div");
    selectedNumberContainer.style.cssText= selectedNumberStyle;
    selectedNumberContainer.classList.add("selectedNumberContainer");

    container.appendChild(selectedNumberContainer);

    const numberOptionsContainer= document.createElement("div");
    numberOptionsContainer.style.cssText= numberOptionsContainerStyle;

    const progressiveAngle= 360/contents.length;
    const animationDurationMilliseconds= 300;
    for (let i= 0; i<contents.length; i++){
      const numberOptionStyle= `
        width: ${attrs["childrenDimensions"]};
        aspect-ratio: 1/1;
        background-color: ${attrs["childrenBackgroundColor"]};
        color: ${attrs["childrenTextColor"]};
        text-align: center;
        line-height: ${attrs["childrenDimensions"]};
        border-radius: 50%;
        position: absolute;
        font-size: ${attrs["childrenFontSize"]};
        transform: rotate(${progressiveAngle* i}deg) translate(${attrs["radius"]}) rotate(-${progressiveAngle* i}deg);
        animation: moveFromCenter ${animationDurationMilliseconds}ms forwards;
        cursor: pointer;
        user-select: none;
      `;

      const numberOption= document.createElement("div");
      numberOption.innerText= contents[i];
      numberOption.style.cssText= numberOptionStyle;
      numberOptionsContainer.appendChild(numberOption);
      numberOption.addEventListener("click", ()=> {
        selectedNumberContainer.innerText= contents[i];
      });
    }
    
    container.appendChild(numberOptionsContainer);

    //////                    //////
    ////// defining behaviour //////
    //////                    //////

    container.addEventListener("mouseover", ()=> {
      numberOptionsContainer.style.display= "flex";
    });
    
    container.addEventListener("mouseout", ()=> {
      numberOptionsContainer.style.display= "none";
    });

    return container;
  },
}
    
const getTemplate= (templateName, attrs)=> {
  const parser= new DOMParser();
  return htmlTemplates[templateName](attrs);
}