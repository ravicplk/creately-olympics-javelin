let socket;
if (typeof io !== 'undefined') {
    socket = io();
} else {
    console.error('Socket.IO is not loaded. Check your script inclusions.');
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const infoDiv = document.getElementById('info');
const lobbyDiv = document.getElementById('lobby');
const gameContainer = document.getElementById('game-container');
const joinForm = document.getElementById('join-form');
const playerNameInput = document.getElementById('player-name');
const playerListDiv = document.getElementById('player-list');
const startGameButton = document.getElementById('start-game');
const scoreboardDiv = document.getElementById('scoreboard');

let playerName;
let players = [];
let isHost = false;
let isMyTurn = false;
let isDragging = false;
let isAnimatingThrow = false;
let startX, startY, endX, endY;
let power = 0;
let angle = 0;
let lobbyId;
const maxPower = 100;

// Load images
let backgroundImage = new Image();
backgroundImage.src = 'images/background.png';

let throwerImage = new Image();
throwerImage.src = 'images/thrower.png';

// Load sound effects
let throwSound = new Audio('sounds/throw.mp3');
let landSound = new Audio('sounds/land.mp3');

joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    playerName = playerNameInput.value.trim();
    if (playerName) {
        socket.emit('join-game', playerName);
    }
});

startGameButton.addEventListener('click', () => {
    socket.emit('start-game', lobbyId);
});

socket.on('lobby-joined', (data) => {
    console.log('Joined lobby:', data);
    lobbyId = data.lobbyId;
    players = data.players;
    updatePlayerList();
    if (players.length >= 2 && isHost) {
        startGameButton.style.display = 'block';
    }
});

socket.on('lobby-update', (updatedPlayers) => {
    console.log('Lobby updated:', updatedPlayers);
    players = updatedPlayers;
    updatePlayerList();
    if (players.length >= 2 && isHost) {
        startGameButton.style.display = 'block';
    } else {
        startGameButton.style.display = 'none';
    }
});

socket.on('game-starting', () => {
    console.log('Game starting');
    lobbyDiv.style.display = 'none';
    gameContainer.style.display = 'block';
    initializeGame();
});

socket.on('host-assigned', () => {
    console.log('Assigned as host');
    isHost = true;
    if (players.length >= 2) {
        startGameButton.style.display = 'block';
    }
});

socket.on('gameStart', ({ currentPlayer }) => {
    console.log('Game started, current player:', currentPlayer);
    isMyTurn = currentPlayer === socket.id;
    updateInfoDiv();
    drawGame();
});

socket.on('nextTurn', ({ currentPlayer, scores, round }) => {
    console.log('Next turn:', { currentPlayer, scores, round });
    isMyTurn = currentPlayer === socket.id;
    updateInfoDiv(round);
    updateScores(scores);
    drawGame();
});

socket.on('gameOver', ({ winner, scores }) => {
    console.log('Game over:', { winner, scores });
    isMyTurn = false;
    updateInfoDiv(null, winner);
    updateScores(scores);
    drawGame();
});

function updatePlayerList() {
    playerListDiv.innerHTML = '<h3>Players:</h3>';
    players.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.textContent = player.name + (player.isHost ? ' (Host)' : '');
        playerListDiv.appendChild(playerElement);
    });
}

function initializeGame() {
    drawGame();
}

function updateInfoDiv(round = null, winner = null) {
    infoDiv.textContent = '';
    if (winner) {
        infoDiv.textContent = `Game Over! ${winner.name} wins!`;
    } else if (round) {
        infoDiv.textContent = `Round ${round}: ${isMyTurn ? 'Your turn' : "Opponent's turn"}`;
    } else {
        infoDiv.textContent = isMyTurn ? 'Your turn' : "Opponent's turn";
    }
}

function drawGame() {
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    drawPlayer();
    
    if (!isDragging && !isAnimatingThrow) {
        drawStaticJavelin();
    }
    
    if (isDragging && isMyTurn) {
        drawAimLine();
        drawPowerMeter();
        drawAngleIndicator();
        drawProjectedPath();
    }
}

function drawPlayer() {
    const playerX = 20;
    const playerY = canvas.height - 240;
    ctx.drawImage(throwerImage, playerX, playerY);
}

function drawStaticJavelin() {
    const javelinStartX = 33;
    const javelinStartY = canvas.height - 130;
    const javelinLength = 60;
    const javelinAngle = -Math.PI / 4;

    ctx.save();
    ctx.translate(javelinStartX, javelinStartY);
    ctx.rotate(javelinAngle);

    ctx.fillStyle = "#8B4513";
    ctx.fillRect(0, -2, javelinLength, 4);

    ctx.fillStyle = "#C0C0C0";
    ctx.beginPath();
    ctx.moveTo(javelinLength, 0);
    ctx.lineTo(javelinLength - 10, -5);
    ctx.lineTo(javelinLength - 10, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function drawAimLine() {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'red';
    ctx.stroke();
}

function drawPowerMeter() {
    const meterWidth = 20;
    const meterHeight = 100;
    const meterX = canvas.width - 40;
    const meterY = canvas.height - meterHeight - 20;
    
    ctx.fillStyle = '#ddd';
    ctx.fillRect(meterX, meterY, meterWidth, meterHeight);
    
    const powerHeight = (power / maxPower) * meterHeight;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(meterX, meterY + meterHeight - powerHeight, meterWidth, powerHeight);
    
    ctx.strokeStyle = '#000';
    ctx.strokeRect(meterX, meterY, meterWidth, meterHeight);
    
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.fillText(`Power: ${Math.round(power)}`, meterX - 30, meterY + meterHeight + 15);
}

function drawAngleIndicator() {
    const centerX = 70;
    const centerY = canvas.height - 75;
    const radius = 50;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, angle - Math.PI / 2);
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    const angleInDegrees = Math.round((angle * 180) / Math.PI);
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    ctx.fillText(`Angle: ${angleInDegrees}°`, centerX - 30, centerY + radius + 20);
}

function drawProjectedPath() {
    const steps = 20;
    const gravity = 9.81;
    const timeStep = 0.1;
    
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.moveTo(90, canvas.height - 150);
    
    for (let i = 0; i < steps; i++) {
        const t = i * timeStep;
        const x = 90 + power * Math.cos(angle) * t;
        const y = (canvas.height - 150) - (power * Math.sin(angle) * t - 0.5 * gravity * t * t);
        
        ctx.lineTo(x, y);
        
        if (y > canvas.height - 50) break;
    }
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
}

function startDrag(event) {
    if (!isMyTurn) return;
    const rect = canvas.getBoundingClientRect();
    startX = event.clientX - rect.left;
    startY = event.clientY - rect.top;
    isDragging = true;
}

function drag(event) {
    if (!isMyTurn || !isDragging) return;
    const rect = canvas.getBoundingClientRect();
    endX = event.clientX - rect.left;
    endY = event.clientY - rect.top;
    
    const dx = endX - startX;
    const dy = startY - endY;
    power = Math.min(Math.sqrt(dx * dx + dy * dy), maxPower);
    angle = Math.atan2(dy, dx);
    
    drawGame();
}

function endDrag(event) {
    if (!isMyTurn || !isDragging) return;
    isDragging = false;
    const rect = canvas.getBoundingClientRect();
    endX = event.clientX - rect.left;
    endY = event.clientY - rect.top;
    calculateThrow();
    animateThrow();
}

function calculateThrow() {
    const dx = endX - startX;
    const dy = endY - startY;
    power = Math.min(Math.sqrt(dx * dx + dy * dy), maxPower);
    angle = Math.atan2(startY - endY, endX - startX);
}

function animateThrow() {
    isAnimatingThrow = true;
    let x = 90;
    let y = canvas.height - 150;
    let t = 0;
    const gravity = 9.81;
    const fps = 60;
    const timeStep = 1 / fps;

    throwSound.play();

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGame();

        x = 90 + power * Math.cos(angle) * t;
        y = (canvas.height - 150) - (power * Math.sin(angle) * t - 0.5 * gravity * t * t);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle - Math.PI / 2 + Math.atan2(gravity * t, power * Math.cos(angle)));
        
        ctx.fillStyle = "#8B4513";
        ctx.fillRect(-2, -30, 4, 60);
        
        ctx.fillStyle = "#C0C0C0";
        ctx.beginPath();
        ctx.moveTo(0, 35);
        ctx.lineTo(-5, 25);
        ctx.lineTo(5, 25);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();

        t += timeStep;

        if (y < canvas.height - 50) {
            requestAnimationFrame(animate);
        } else {
            landSound.play();

            const distance = Math.round(x - 90);
            socket.emit('throwJavelin', { lobbyId, distance });
            infoDiv.textContent = `You threw the javelin ${distance} meters!`;
            isAnimatingThrow = false;
            isMyTurn = false;
        }
    }

    animate();
}

function updateScores(scores) {
  console.log('Raw scores data:', scores);

  scoreboardDiv.innerHTML = '<h3>Scoreboard</h3>';

  if (!Array.isArray(scores)) {
      console.error('Scores is not an array:', scores);
      scoreboardDiv.innerHTML += '<p>Error: Invalid score data</p>';
      return;
  }

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  const headerRow = table.insertRow();
  ['Rank', 'Player', 'Score'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      th.style.border = '1px solid black';
      th.style.padding = '5px';
      headerRow.appendChild(th);
  });

  const sortedScores = scores.sort((a, b) => {
      const scoreA = typeof a.score === 'number' ? a.score : 0;
      const scoreB = typeof b.score === 'number' ? b.score : 0;
      return scoreB - scoreA;
  });

  sortedScores.forEach((score, index) => {
      console.log('Processing score:', score);
      const row = table.insertRow();
      [
          index + 1,
          score.name || 'Unknown',
          typeof score.score === 'number' ? score.score : 0
      ].forEach((value, colIndex) => {
          const cell = row.insertCell();
          cell.textContent = value;
          cell.style.border = '1px solid black';
          cell.style.padding = '5px';
          if (colIndex === 0) cell.style.textAlign = 'center';
          if (colIndex === 2) cell.style.textAlign = 'right';
      });
  });

  scoreboardDiv.appendChild(table);

  const currentPlayerScore = scores.find(score => score.id === socket.id);
  if (currentPlayerScore) {
      const scoreValue = typeof currentPlayerScore.score === 'number' ? currentPlayerScore.score : 0;
      infoDiv.textContent += ` Your score: ${scoreValue}`;
  }
}

canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('mousemove', drag);
canvas.addEventListener('mouseup', endDrag);

window.onload = function() {
    Promise.all([
        new Promise(resolve => { backgroundImage.onload = resolve; }),
        new Promise(resolve => { throwerImage.onload = resolve; })
    ]).then(() => {
        console.log('Images loaded');
    });
};