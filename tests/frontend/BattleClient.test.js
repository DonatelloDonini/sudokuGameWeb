import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import BattleClient from "../../frontend/js/BattleClient.js";

/** A WebSocket the tests drive by hand. */
class FakeWebSocket extends EventTarget{
  static CONNECTING= 0;
  static OPEN= 1;
  static CLOSED= 3;
  static instances= [];

  constructor(url){
    super();
    this.url= url;
    this.readyState= FakeWebSocket.CONNECTING;
    this.sent= [];
    FakeWebSocket.instances.push(this);
  }

  send(data){
    this.sent.push(JSON.parse(data));
  }

  close(){
    this.serverClose();
  }

  serverOpen(){
    this.readyState= FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  serverSend(message){
    const event= new Event("message");
    event.data= typeof message=== "string" ? message : JSON.stringify(message);
    this.dispatchEvent(event);
  }

  serverClose(){
    if (this.readyState=== FakeWebSocket.CLOSED) return;
    this.readyState= FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }
}

describe("BattleClient", ()=> {
  beforeEach((context)=> {
    FakeWebSocket.instances= [];
    globalThis.WebSocket= FakeWebSocket;
    globalThis.location= {protocol: "https:", host: "sudoku.example"};
    context.mock.timers.enable({apis: ["setTimeout"]});
  });

  afterEach(()=> {
    delete globalThis.WebSocket;
    delete globalThis.location;
  });

  test("connects to /ws with the page's protocol", ()=> {
    new BattleClient().connect();
    assert.equal(FakeWebSocket.instances[0].url, "wss://sudoku.example/ws");
  });

  test("dispatches every server message as an event named after its type", ()=> {
    const client= new BattleClient();
    const received= [];
    client.addEventListener("battle-start", (event)=> received.push(event.detail));
    client.connect();

    const socket= FakeWebSocket.instances[0];
    socket.serverOpen();
    socket.serverSend({type: "battle-start", battleId: "b1"});
    socket.serverSend("not json");

    assert.deepEqual(received, [{type: "battle-start", battleId: "b1"}]);
  });

  test("sends only while connected", ()=> {
    const client= new BattleClient();
    client.connect();
    assert.equal(client.send({type: "join-queue"}), false);

    FakeWebSocket.instances[0].serverOpen();
    assert.equal(client.connected, true);
    assert.equal(client.send({type: "join-queue"}), true);
    assert.deepEqual(FakeWebSocket.instances[0].sent, [{type: "join-queue"}]);
  });

  test("reconnects after a dropped connection, waiting longer each time", (context)=> {
    const client= new BattleClient();
    client.connect();
    FakeWebSocket.instances[0].serverClose();

    context.mock.timers.tick(999);
    assert.equal(FakeWebSocket.instances.length, 1);
    context.mock.timers.tick(1);
    assert.equal(FakeWebSocket.instances.length, 2, "first retry after 1 s");

    FakeWebSocket.instances[1].serverClose();
    context.mock.timers.tick(1999);
    assert.equal(FakeWebSocket.instances.length, 2);
    context.mock.timers.tick(1);
    assert.equal(FakeWebSocket.instances.length, 3, "then after 2 s");

    // a successful connection resets the delay
    FakeWebSocket.instances[2].serverOpen();
    FakeWebSocket.instances[2].serverClose();
    context.mock.timers.tick(1000);
    assert.equal(FakeWebSocket.instances.length, 4);
  });

  test("doesn't reconnect after disconnect() or when another window took over", (context)=> {
    const client= new BattleClient();
    client.connect();
    client.disconnect();
    context.mock.timers.tick(20_000);
    assert.equal(FakeWebSocket.instances.length, 1);

    const other= new BattleClient();
    other.connect();
    const socket= FakeWebSocket.instances[1];
    socket.serverOpen();
    socket.serverSend({type: "replaced"});
    socket.serverClose();
    context.mock.timers.tick(20_000);
    assert.equal(FakeWebSocket.instances.length, 2);
  });
});
