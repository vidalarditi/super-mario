//Helper Functions
function loadImage(url){
  return new Promise(resolve => {
    const image = new Image();
    image.addEventListener("load", () => {
      resolve(image);
    });
    image.src = url;
  })
}

function drawBackground(name, context, sprites) {
  const test = name.get("tile");
  const ranges = name.get("ranges");
  for (let x = ranges[0]; x < ranges[1]; ++x) {
      for (let y = ranges[2]; y < ranges[3]; ++y) {
          sprites.drawTile(test, context, x, y);
      }
  }
}

function loadBackgroundSprites(){
  return loadImage("../tiles.png").then(image => {
  const sprites = new SpritesSheet(image, 16, 16);
  
  sprites.defineTile("sky", 3, 23);
  sprites.addRanges("sky", [0, 25, 0, 14]);
  sprites.defineTile("ground", 0, 0);
  sprites.addRanges("ground", [0, 25, 12, 14]);
  return sprites;
});
}

function loadMarioSprites(){
  return loadImage("../characters.gif").then( image => {
  const sprites = new SpritesSheet(image, 16, 16);
  sprites.define("idle", 276, 44, 16, 16);
  return sprites;
});
}

function createBackgroundLayer(backgrounds, sprites){
  const buffer = document.createElement("canvas");
  buffer.width = 256;
  buffer.height = 240;
  backgrounds.forEach(background => {
    drawBackground(background, buffer.getContext("2d"), sprites);
  });
  return function drawBackgroundLayer(context){
    context.drawImage(buffer, 0, 0); 
  };

}

function createSpriteLayer(entity){
  return function drawSpriteLayer(context){
    entity.draw(context);
  };
}

function createMario(){
  return loadMarioSprites().then(sprite => {
    const mario = new Entity();
    mario.addTrait(new Velocity());

    mario.draw = function drawMario(context){
      sprite.draw("idle", context, this.pos.x, this.pos.y);
    }

    return mario;
  });
}

//Classes
class SpritesSheet{
   constructor(image, width, heigth){
     this.image = image;
     this.width = width;
     this.heigth = heigth;
     this.tiles = new Map();
     this.backgrounds = new Map();
   }

   define(name, x, y, width, height){
     const buffer = document.createElement('canvas');
     buffer.width = width;
     buffer.height = height;
     buffer.getContext("2d").
      drawImage(this.image,
        x,
        y,
        height,
        width,
        0,
        0,
        width,
        height);
    this.tiles.set(name, buffer);
   }

   defineTile(name, x, y){
     this.define(name, x*this.width, y*this.heigth, this.width, this.heigth);
   }

   draw(name, context, x, y){
    const buffer = this.tiles.get(name);
    context.drawImage(buffer, x, y);
   }

   drawTile(name, context, x, y){
    this.draw(name, context, x*this.width, y*this.heigth);
   }

   addRanges(name, ranges){
     var background = new Map()
     background.set("ranges", ranges);
     background.set("tile", name);
     this.backgrounds.set(name, background);
   }
}

class Compositor{
  constructor(){
    this.layers = [];
  }
  draw(context){
    this.layers.forEach(layer => {
      layer(context)
    })
  }
}

class Vector{
  constructor(x, y){
    this.set(x, y);
  }
  set(x, y){
    this.x = x;
    this.y = y;
  }
}

class Entity {
  constructor(){
    this.pos = new Vector(0, 0);
    this.vlcity = new Vector(0, 0);

    this.traits = [];
  }
  addTrait(trait){
    this.traits.push(trait);
    this[trait.NAME] = trait;
  }

  update(deltaTime) {
    this.traits.forEach(trait => {
      trait.update(this, deltaTime);
    });
  }
}

class Trait{
  constructor (name){
    this.NAME = name;
  }
  update(){
    console.warn("Unhandled Update Call"); 
  }
}

class Velocity extends Trait{
  constructor(){
    super("velocity");
  }

  update(entity, deltaTime){
    entity.pos.x += entity.vlcity.x*deltaTime;
    entity.pos.y += entity.vlcity.y*deltaTime;
  }
}

class Timer{
  constructor(deltaTime = 1/60){
    let accumulatedTime = 0;
    let lastTime = 0;

    this.updateProxy = (time) => {
      accumulatedTime += (time - lastTime)/1000;
      while(accumulatedTime > deltaTime){
        this.update(deltaTime)
        accumulatedTime -= deltaTime;
      }
      lastTime = time;
      this.enqueue(); 
    }
  }
  enqueue(){
    requestAnimationFrame(this.updateProxy);
  }
  start(){
    this.enqueue();
  }
}
//Keyboard Input
class KeyboardState {
  constructor(){
    //Holds the current state of a given key
    this.keyStates = new Map();
    //Holds the callback functions for a keycode
    this.keyMap = new Map();
    this.PRESSED = 1;
    this.RELEASED = 0;
  }
  addMapping(keyCode, callback){
    this.keyMap.set(keyCode, callback);
  }
  handleEvent(event){
    const {keyCode} = event;
    if(!this.keyMap.has(keyCode)){
      return;
    }
    event.preventDefault();
    const keyState = event.type === "keydown" ? this.PRESSED : this.RELEASED;
    if(this.keyStates.get(keyCode) === keyState){
      return;
    }
    this.keyStates.set(keyCode, keyState);
    console.log(this.keyStates);
    this.keyMap.get(keyCode)(keyState);
  }
  listenTo(window){
    ["keydown", "keyup"].forEach(eventName => {
      window.addEventListener(eventName, event => {
        this.handleEvent(event);
      });
    })
  }
}

//HTML Canvas Joining
const canvas = document.getElementById("screen");
const context = canvas.getContext("2d");


//Main Function
Promise.all([
  createMario(), 
  loadBackgroundSprites()
]).then(([mario, backgroundSprites]) => {
  const comp = new Compositor();
  const backgroundLayer = createBackgroundLayer(backgroundSprites.backgrounds, backgroundSprites);
  comp.layers.push(backgroundLayer);
  const gravity = 2000;
  mario.pos.set(64, 180);
  
  mario.vlcity.set(200, -600);

  //Create Keyboard Input Class
  const SPACE = 32;
  const keyboardInput = new KeyboardState();
  keyboardInput.addMapping(SPACE, keyState => {
    if(keyState){
      mario.jump.star();
    } else {
      mario.jump.cancel();
    }
    console.log(keyState);
  }); 
  keyboardInput.listenTo(window);

  const spriteLayer = createSpriteLayer(mario);
  comp.layers.push(spriteLayer);

  const timer = new Timer(1/60);
  timer.update = function update(deltaTime){
    mario.update(deltaTime);
    comp.draw(context);
    mario.vlcity.y += gravity*deltaTime;
  }

  timer.start();
})