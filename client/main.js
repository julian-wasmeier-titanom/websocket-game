/** @type {HTMLCanvasElement} */
import { io } from 'socket.io-client';
const socket = io({ autoConnect: false });

const canvas = document.getElementById('canvas');
const modal = document.getElementById('modal');
const usernameInput = document.getElementById('username-input');
const playButton = document.getElementById('play-button');
const colorContainer = document.getElementById('color-container');
const scoreboard = document.getElementById('scoreboard');

const ctx = canvas.getContext('2d');

let width = (canvas.width = window.innerWidth);
let height = (canvas.height = window.innerHeight);
canvas.style.width = width;
canvas.style.height = height;

let mouse = { x: undefined, y: undefined };
let id = undefined;
let initalized = false;
let lastUserName = undefined;
let prevPlayerScores = undefined;

const colors = ['#DB488B', '#1F1A70', '#1A0E3E', '#3337C0', '#D854C2'];

colors.forEach((color, i) => {
  const colorElement = document.createElement('input');
  colorElement.type = 'radio';
  colorElement.name = 'colors';
  colorElement.value = color;
  colorElement.checked = i === 0;
  colorElement.style.backgroundColor = color;
  colorElement.classList.add('color');
  colorContainer.appendChild(colorElement);
});

window.addEventListener('keypress', (e) => {
  socket.emit('keydown', e.key);
});

window.addEventListener('keyup', (e) => {
  socket.emit('keyup', e.key);
});

window.addEventListener('resize', (e) => {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  // canvas.style.width = width;
  // canvas.style.height = height;
  // socket.emit('resize', { width, height });
});

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  socket.emit('mousemove', { x: e.clientX / width, y: e.clientY / height });
});

window.addEventListener('mousedown', (e) => {
  socket.emit('mousedown');
});

window.addEventListener('mouseup', (e) => {
  socket.emit('mouseup');
});

playButton.addEventListener('click', (e) => {
  const username = usernameInput.value || 'Unnamed';
  if (!initalized || username !== lastUserName) {
    socket.disconnect();
    socket.connect();
    socket.emit('init', {
      window: { width, height },
      username,
      color: colorContainer['colors'].value,
    });
  } else {
    socket.emit('replay', { color: colorContainer['colors'].value });
  }
  modal.style.display = 'none';
});

function clearCanvas() {
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, width, height);
}

function drawPlayer(player) {
  const realX = player.x * width;
  const realY = player.y * height;
  const realRadius = player.radius * width;

  const liveGap = 5;
  const liveWidth = 5;
  //rendering the player

  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(realX, realY, player.radius * width, 0, Math.PI * 2);
  ctx.fill();

  //rendering the lives
  for (let i = 0; i < player.lives; i++) {
    if (player.lives >= 3) {
      ctx.fillStyle = '#9be5aa';
    } else if (player.lives >= 2) {
      ctx.fillStyle = '#FEDD00';
    } else if (player.lives >= 1) {
      ctx.fillStyle = '#ce2029';
    }

    const totalLength = player.lives * 5 + (player.lives - 1) * 5;
    ctx.fillRect(
      realX + i * (liveGap + liveWidth) - totalLength / 2,
      realY - realRadius - 10,
      liveWidth,
      liveWidth
    );

    //rendering the player name
    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.font = '20px Bebas Neue';
    ctx.fontWeight = 400;
    ctx.color = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(player.name, realX, realY - realRadius - 20);
  }

  //rendering the bullets
  for (const bullet of player.bullets) {
    ctx.fillStyle = 'rgba(255,255,255)';
    ctx.beginPath();
    ctx.arc(
      bullet.x * width,
      bullet.y * height,
      bullet.radius * width,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
}

function drawScoreBoard(players) {
  const sortedPlayers = players.sort((a, b) => b.score - a.score);

  const scoreboardItems = sortedPlayers.map((player, i) => {
    const scoreboardItem = document.createElement('li');
    scoreboardItem.classList.add('scoreboard-item');
    scoreboardItem.innerHTML = `<span style='font-size: 35px; margin-right:10px;'>${
      i + 1
    }.</span> ${player.name}: ${player.score}`;
    return scoreboardItem;
  });

  scoreboard.innerHTML = '';
  scoreboard.append(...scoreboardItems);
}

let gameState = undefined;
function animate() {
  if (gameState) {
    const playerScores = gameState.players.map((player) => player.score);
    //only rerender scoreboard if values have changed
    if (
      prevPlayerScores === undefined ||
      playerScores.some((playerScore, i) => playerScore !== prevPlayerScores[i])
    ) {
      drawScoreBoard(gameState.players);
    }
    prevPlayerScores = playerScores;

    clearCanvas();
    for (const player of gameState.players.filter((player) => player.playing)) {
      drawPlayer(player);
    }
  }
  requestAnimationFrame(animate);
}
animate();

function handleGameOver() {
  modal.style.display = 'flex';
}

socket.on('game-state', (state) => {
  gameState = state;
});

socket.on('id', (ourId) => (id = ourId));
socket.on('initalized', (username) => {
  console.log(username);
  initalized = true;
  lastUserName = username;
});

socket.on('gameover', handleGameOver);
