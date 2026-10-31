/**
 * The developers area: examples with the address of this server, and the "Try it" form.
 */
for (const element of document.querySelectorAll("[data-base-url]")){
  element.innerHTML= element.innerHTML.replaceAll("https://your-server", location.origin);
}

const output= document.getElementById("try-output");
document.getElementById("try-form").addEventListener("submit", async (event)=> {
  event.preventDefault();
  const form= new FormData(event.target);
  const url= `/api/v1/puzzles?difficulty=${form.get("difficulty")}&format=${form.get("format")}`;
  output.textContent= `GET ${url}\n\nLoading…`;
  try {
    const response= await fetch(url);
    output.textContent= `GET ${url}\n\n${JSON.stringify(await response.json(), null, 2)}`;
  }
  catch (error) {
    output.textContent= `GET ${url}\n\n${error.message}`;
  }
});
