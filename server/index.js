const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.static('dist'));
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const uuid = require('uuid').v4;
const Vector = require('@julian-wasmeier-titanom/vectors');

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

let players = [];
let gameState = { players };
let bulletInterval = 100;
let bulletVelocity = 0.01;

let playerRadius = 0.01;
let bulletRadius = 0.002;
let playerAcc = 0.005;

let width,
  height = undefined;

io.on('connection', (socket) => {
  const keys = {
    a: false,
    s: false,
    d: false,
    w: false,
    space: false,
    mousedown: false,
  };

  let bulletCount = 0;
  let bulletAvailable = true;
  let reloading = false;
  let interval = undefined;

  socket.on('keydown', (key) => {
    switch (key) {
      case 'a':
        keys.a = true;
        break;
      case 's':
        keys.s = true;
        break;
      case 'd':
        keys.d = true;
        break;
      case 'w':
        keys.w = true;
        break;
      case ' ':
        keys.space = true;
        break;
    }
  });

  socket.on('keyup', (key) => {
    switch (key) {
      case 'a':
        keys.a = false;
        break;
      case 's':
        keys.s = false;
        break;
      case 'd':
        keys.d = false;
        break;
      case 'w':
        keys.w = false;
        break;
      case ' ':
        keys.space = false;
        break;
    }
  });

  socket.on('mousedown', () => (keys.mousedown = true));
  socket.on('mouseup', () => (keys.mousedown = false));

  socket.on('resize', (window) => {
    width = window.width;
    height = window.height;
  });

  socket.on('init', ({ window, username, color, score }) => {
    width = window.width;
    height = window.height;

    const player = {
      x: Math.random() * (1 - playerRadius) + playerRadius,
      y: Math.random() * (1 - playerRadius) + playerRadius,
      dx: 0,
      dy: 0,
      mouse: { x: 0, y: 0 },
      bullets: [],
      lives: 3,
      radius: playerRadius,
      name: username,
      color,
      playing: true,
      score: 0,
      id: uuid(),
    };

    interval = setInterval(() => {
      if (player.playing) {
        if (keys.a) {
          player.dx = -playerAcc;
        } else if (keys.d) {
          player.dx = playerAcc;
        } else {
          player.dx = 0;
        }

        if (keys.w) {
          player.dy = -playerAcc;
        } else if (keys.s) {
          player.dy = playerAcc;
        } else {
          player.dy = 0;
        }

        if (keys.space || keys.mousedown) {
          if (bulletAvailable && !reloading) {
            const mousex = player.mouse.x;
            const mousey = player.mouse.y;

            const mouseVector = new Vector(mousex, mousey);
            const bulletVector = new Vector(player.x, player.y);

            const diffVector = mouseVector.subtract(bulletVector);
            const normDiffVector = diffVector.scalarMul(
              1 / diffVector.magnitude
            );

            const bullet = {
              x: player.x,
              y: player.y,
              dx: normDiffVector.x * bulletVelocity,
              dy: normDiffVector.y * bulletVelocity,
              radius: bulletRadius,
              isLive: true,
              id: uuid(),
            };
            player.bullets.push(bullet);
            bulletCount++;
            bulletAvailable = false;
            setTimeout(() => {
              bulletAvailable = true;
            }, bulletInterval);
            if (bulletCount >= 3) {
              reloading = true;
              bulletCount = 0;
              setTimeout(() => (reloading = false), 1000);
            }
          }
        }

        if (
          player.x + playerRadius + player.dx <= 1 &&
          player.x - playerRadius + player.dx > 0
        ) {
          player.x += player.dx;
        }
        if (
          player.y + playerRadius + player.dy <= 1 &&
          player.y - playerRadius + player.dy > 0
        ) {
          player.y += player.dy;
        }

        for (const bullet of player.bullets) {
          bullet.x += bullet.dx;
          bullet.y += bullet.dy;
          if (
            bullet.x - bulletRadius > 1 ||
            bullet.x + bulletRadius < 0 ||
            bullet.y - bulletRadius > 1 ||
            bullet.y + bulletRadius < 0
          ) {
            player.bullets = player.bullets.filter((b) => b.id !== bullet.id);
          }
        }
        for (const otherPlayer of gameState.players) {
          if (player.id !== otherPlayer.id && otherPlayer.playing) {
            for (const bullet of otherPlayer.bullets) {
              const bulletVector = new Vector(bullet.x, bullet.y);
              const playerVector = new Vector(player.x, player.y);

              const distance = bulletVector.subtract(playerVector).magnitude;

              if (distance < playerRadius + bulletRadius && bullet.isLive) {
                bullet.isLive = false;
                otherPlayer.bullets = otherPlayer.bullets.filter(
                  (b) => b.id !== bullet.id
                );
                if (player.lives > 1) {
                  player.lives -= 1;
                  if (otherPlayer.lives < 3) {
                    otherPlayer.lives += 1;
                  }
                } else {
                  player.score *= 0.5;
                  otherPlayer.score += 100;

                  socket.emit('gameover');
                  player.playing = false;
                }
              }
            }
          }
        }
        if (player.lives !== 0) {
        }
      }
      socket.emit('game-state', gameState);
    }, 1000 / 60);

    gameState.players.push(player);
    socket.emit('id', player.id);
    socket.emit('initalized', player.name);

    socket.on('mousemove', ({ x, y }) => {
      player.mouse.x = x;
      player.mouse.y = y;
    });

    socket.on('replay', ({ color, name }) => {
      player.x = Math.random() * (1 - playerRadius) + playerRadius;
      player.y = Math.random() * (1 - playerRadius) + playerRadius;
      player.playing = true;
      player.lives = 3;
      player.color = color;
      bulletAvailable = true;
      bulletCount = 0;
    });

    socket.on('disconnect', () => {
      gameState.players = gameState.players.filter((p) => p.id !== player.id);
      clearInterval(interval);
    });
  });
});

const port = 3000;

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/dist/index.html');
});

server.listen(port, () =>
  console.log(`Game server listening on port ${port}!`)
);
