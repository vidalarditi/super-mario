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

function createTiles(level, backgrounds){
  backgrounds.forEach(background => {
    const tile = background.get("tile");
    const ranges = background.get("ranges");
    ranges.forEach(range => {
      for (let x = range[0]; x < range[1]; ++x) {
        for (let y = range[2]; y < range[3]; ++y) {
          level.tiles.set(x, y, {
            name: tile,
          });
        }
      }
    })
  });
}


function levelInfo(){
  const backgrounds = new Map()
  const backgroundSky = new Map();
  const backgroundGround = new Map();
  backgroundSky.set("tile", "sky");
  backgroundSky.set("ranges", [[0, 25, 0, 14]]);
  backgrounds.set("sky", backgroundSky);
  backgroundGround.set("tile", "ground");
  backgroundGround.set("ranges", [[0, 25, 12, 14], [5, 8, 9, 10], [12, 18, 11, 12], [2, 3, 11, 12], [2, 3, 11, 12], [10, 12, 10, 11], [9, 10, 0, 7]]);
  backgrounds.set("ground", backgroundGround);
  return backgrounds;
}

function loadLevel(){
  return Promise.all([
    levelInfo(), 
    loadBackgroundSprites()
  ]).then(([LevelSpec, backgroundSprites]) => {
    const level = new Level();

    createTiles(level, LevelSpec);

    const backgroundLayer = createBackgroundLayer(level, backgroundSprites);
    level.comp.layers.push(backgroundLayer);
    const spriteLayer = createSpriteLayer(level.entities);
    level.comp.layers.push(spriteLayer);
    return level;
  })
}

function loadBackgroundSprites(){
  return loadImage("../tiles.png").then(image => {
  const sprites = new SpritesSheet(image, 16, 16);
  
  sprites.defineTile("sky", 3, 23);
  sprites.defineTile("ground", 0, 0);
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

function createBackgroundLayer(level, sprites){
  const buffer = document.createElement("canvas");
  buffer.width = 256;
  buffer.height = 240;

  const context = buffer.getContext("2d");

  level.tiles.forEach((tile, x, y) => {
      sprites.drawTile(tile.name, context, x, y);
    });

  return function drawBackgroundLayer(context){
    context.drawImage(buffer, 0, 0); 
  };

}

function createSpriteLayer(entities){
  return function drawSpriteLayer(context){
    entities.forEach(entity => {
      entity.draw(context);
    });
  };
}

function createMario(){
  return loadMarioSprites().then(sprite => {
    const mario = new Entity();
    mario.addTrait(new Velocity());
    mario.addTrait(new Jump());

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

class Jump extends Trait{
  constructor(){
    super("jump");
    this.duration = 0.5;
    this.velocity = 200;
    this.engageTime = 0;
  }
  start(){
    this.engageTime = this.duration;
  }
  cancel(){
    this.engageTime = 0;
  }

  update(entity, deltaTime){
    if(this.engageTime > 0){
      entity.vlcity.y = -this.velocity;
      this.engageTime -= deltaTime;
    }
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

//Level Class (Cleanup)
class Level{
  constructor(){
    this.comp = new Compositor();
    this.entities = new Set();
    this.tiles = new Matrix();

    this.tileCollider = new TileCollider(this.tiles);
  }

  update(deltaTime){
    this.entities.forEach(entity => {
      entity.update(deltaTime);
      this.tileCollider.test(entity);
    });
  }
}

//Collission Matrix
class Matrix {
  constructor(){
    this.grid = [];
  }
  forEach(callback){
    this.grid.forEach((column, x) => {
      column.forEach((value, y) => {
        callback(value, x, y);
      });
    });
  }

  get(x, y){
    const col = this.grid[x];
    if(col){
      return col[y];
    }
    return undefined;
  }

  set(x, y, value){
    if(!this.grid[x]){
      this.grid[x] = [];
    }
    this.grid[x][y] = value;
  }
}
// window.Matrix = Matrix;


//Colission checking and resolving
class TileResolver{
  constructor(matrix, tileSize = 16){
    this.matrix = matrix;
    this.tileSize = tileSize;
  }
  toIndex(pos){
    return Math.floor(pos / this.tileSize);
  }
  getByIndex(indexX, indexY){
    const tile = this.matrix.get(indexX, indexY);
    if(tile){
      return {
        tile, 
      };
    }
  }
  matchByPosition(posX, posY){
    return this.getByIndex(
      this.toIndex(posX),
      this.toIndex(posY));
  }
}

class TileCollider{
  constructor(tileMatrix){
    this.tiles = new TileResolver(tileMatrix);
  }
  test(entity){
    const match = this.tiles.matchByPosition(entity.pos.x, entity.pos.y);
    if(match){
      console.log("Matched tile", match, match.tile);
    }
  }
}

//HTML Canvas Joining
const canvas = document.getElementById("screen");
const context = canvas.getContext("2d");


//Main Function
Promise.all([
  createMario(), 
  loadLevel()
]).then(([mario, level]) => {
  // const comp = new Compositor();
  const gravity = 2000;
  mario.pos.set(64, 64);
  level.entities.add(mario);

  //Create Keyboard Input Class
  const SPACE = 32;
  const keyboardInput = new KeyboardState();
  keyboardInput.addMapping(SPACE, keyState => {
    if(keyState){
      mario.jump.start();
    } else {
      mario.jump.cancel();
    }
  }); 
  keyboardInput.listenTo(window);

  ["mousedown", "mousemove"].forEach(eventName => {
    canvas.addEventListener(eventName, event => {
      if(event.buttons === 1){
        mario.vlcity.set(0, 0);
        mario.pos.set(event.offsetX, event.offsetY);
      }
    });
  });

  const timer = new Timer(1/60);
  timer.update = function update(deltaTime){
    level.update(deltaTime);
    level.comp.draw(context);
    mario.vlcity.y += gravity*deltaTime;
  }

  timer.start();
})