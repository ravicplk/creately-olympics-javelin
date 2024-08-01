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
const gameOverDiv = document.getElementById('game-over');
const winnerDisplayDiv = document.getElementById('winner-display');
// const playAgainButton = document.getElementById('play-again');
const exitGameButton = document.getElementById('exit-game');
const exitGameOverButton = document.getElementById('exit-game-over');
const THROW_POWER_FACTOR = 0.8;
const MIN_ANGLE = Math.PI / 6; // 30 degrees
const MAX_ANGLE = Math.PI * 2 / 3; // 120 degrees

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

socket.on('error', (message) => {
    console.error('Game error:', message);
    alert(message);
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
    updateScores(scores);
    drawGame();

    gameContainer.style.display = 'none';
    gameOverDiv.style.display = 'block';
    winnerDisplayDiv.textContent = `${winner.name} wins!`;
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
    exitGameButton.style.display = 'block';
}

function updateInfoDiv(round = null) {
    infoDiv.textContent = '';
    if (round) {
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
    const lineLength = 50; // Length of the aim line
    const endLineX = startX + lineLength * Math.cos(angle);
    const endLineY = startY - lineLength * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endLineX, endLineY);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
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
    
    const velocityX = power * THROW_POWER_FACTOR * Math.cos(angle);
    const velocityY = power * THROW_POWER_FACTOR * Math.sin(angle);

    for (let i = 0; i < steps; i++) {
        const t = i * timeStep;
        const x = 90 + velocityX * t;
        const y = (canvas.height - 150) - (velocityY * t - 0.5 * gravity * t * t);
        
        if (x <= canvas.width && y <= canvas.height - 50) {
            ctx.lineTo(x, y);
        } else {
            break;
        }
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
    endX = Math.min(Math.max(event.clientX - rect.left, 0), canvas.width);
    endY = Math.min(Math.max(event.clientY - rect.top, 0), canvas.height);
    
    // Limit the drag to the left half of the canvas
    endX = Math.min(endX, canvas.width / 2);
    
    // Allow dragging below the start point, but limit it
    endY = Math.min(endY, startY + 100); // Allow up to 100 pixels below start point
    
    calculateThrow();
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
    const dy = startY - endY;
    
    // Calculate power based on drag distance
    power = Math.min(Math.sqrt(dx * dx + dy * dy), maxPower);
    
    // Calculate raw angle
    let rawAngle = Math.atan2(-dy, dx);
    
    // Map the raw angle to a range between MIN_ANGLE and MAX_ANGLE
    angle = MIN_ANGLE + (rawAngle / (Math.PI / 2)) * (MAX_ANGLE - MIN_ANGLE);
    
    // Ensure the angle is within bounds
    angle = Math.max(MIN_ANGLE, Math.min(angle, MAX_ANGLE));
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

        const velocityX = power * THROW_POWER_FACTOR * Math.cos(angle);
        const velocityY = power * THROW_POWER_FACTOR * Math.sin(angle);

        x = 90 + velocityX * t;
        y = (canvas.height - 150) - (velocityY * t - 0.5 * gravity * t * t);

        if (x <= canvas.width && y <= canvas.height - 50) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle - Math.PI / 2 + Math.atan2(gravity * t, velocityX));
            
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
            requestAnimationFrame(animate);
        } else {
            landSound.play();

            const distance = Math.round(Math.min(x - 90, canvas.width - 90));
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

function exitGame() {
    gameContainer.style.display = 'none';
    gameOverDiv.style.display = 'none';
    lobbyDiv.style.display = 'block';
    socket.emit('leave-lobby');
    // Reset game state
    players = [];
    isHost = false;
    updatePlayerList();
}

//playAgainButton.addEventListener('click', () => {
    //ocket.emit('restart-game', lobbyId);
//});

//socket.on('game-restarted', () => {
   //gameOverDiv.style.display = 'none';
   // gameContainer.style.display = 'block';
    //initializeGame();
//});

exitGameButton.addEventListener('click', exitGame);
exitGameOverButton.addEventListener('click', exitGame);

document.getElementById('leave-lobby').addEventListener('click', () => {
    socket.emit('leave-lobby');
    // Reset game state
    players = [];
    isHost = false;
    lobbyId = null;
    isMyTurn = false;
    isDragging = false;
    isAnimatingThrow = false;
    power = 0;
    angle = 0;
    
    // Reset UI
    updatePlayerList();
    startGameButton.style.display = 'none';
    lobbyDiv.style.display = 'block';
    gameContainer.style.display = 'none';
    gameOverDiv.style.display = 'none';
    scoreboardDiv.innerHTML = '';
    infoDiv.textContent = 'Waiting for players...';
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('mousemove', drag);
canvas.addEventListener('mouseup', endDrag);

window.onload = function() {
    Promise.all([
        new Promise(resolve => { backgroundImage.onload = resolve; }),
        new Promise(resolve => { throwerImage.onload = resolve; })
    ]).then(() => {
        console.log('Images loaded');
        drawGame();
    });
};

// Function to handle window resizing
function handleResize() {
    canvas.width = window.innerWidth * 0.8; // 80% of window width
    canvas.height = window.innerHeight * 0.7; // 70% of window height
    drawGame();
}

// Add event listener for window resize
window.addEventListener('resize', handleResize);

// Initial call to set canvas size
handleResize();