/**
 * The websocket connection to the battle server. It reconnects by itself when the connection drops,
 * so a battle survives a network hiccup or a page reload (the server waits a few seconds before declaring a forfeit).
 *
 * Every server message is dispatched as an event named after its type (e.g. "battle-start"), with the message as detail.
 * "open" and "close" are dispatched when the connection opens and drops.
 */
export default class BattleClient extends EventTarget{
  static MAX_RECONNECT_DELAY_MS= 10 * 1000;

  /** @type {WebSocket|null} */
  #socket= null;
  #shouldReconnect= false;
  #reconnectDelayMs= 1000;
  #reconnectTimer= null;

  get connected(){
    return this.#socket?.readyState=== WebSocket.OPEN;
  }

  connect(){
    this.#shouldReconnect= true;
    if (this.#socket) return;

    const protocol= location.protocol=== "https:" ? "wss:" : "ws:";
    const socket= new WebSocket(`${protocol}//${location.host}/ws`);
    this.#socket= socket;

    socket.addEventListener("open", ()=> {
      this.#reconnectDelayMs= 1000;
      this.dispatchEvent(new Event("open"));
    });

    socket.addEventListener("message", (event)=> {
      let message;
      try {
        message= JSON.parse(event.data);
      }
      catch {
        return;
      }

      // another window took over: don't fight it by reconnecting
      if (message.type=== "replaced") this.#shouldReconnect= false;
      this.dispatchEvent(new CustomEvent(message.type, {detail: message}));
    });

    socket.addEventListener("close", ()=> {
      this.#socket= null;
      this.dispatchEvent(new Event("close"));

      if (this.#shouldReconnect){
        this.#reconnectTimer= setTimeout(()=> this.connect(), this.#reconnectDelayMs);
        this.#reconnectDelayMs= Math.min(this.#reconnectDelayMs * 2, BattleClient.MAX_RECONNECT_DELAY_MS);
      }
    });
  }

  disconnect(){
    this.#shouldReconnect= false;
    clearTimeout(this.#reconnectTimer);
    this.#socket?.close();
    this.#socket= null;
  }

  /**
   * @param {Object} message
   * @returns {boolean} Whether the message could be sent.
   */
  send(message){
    if (! this.connected) return false;

    this.#socket.send(JSON.stringify(message));
    return true;
  }
}
