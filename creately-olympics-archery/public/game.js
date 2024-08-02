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
const exitGameButton = document.getElementById('exit-game');
const exitGameOverButton = document.getElementById('exit-game-over');

let playerName;
let players = [];
let isHost = false;
let isMyTurn = false;
let isDragging = false;
let isAnimatingShot = false;
let lobbyId;
let aimX = canvas.width / 2;
let aimY = canvas.height / 2;
let drawPower = 0;
const maxDrawPower = 100;
let windSpeed = 0;
let windDirection = 1; // 1 for right, -1 for left
const MAX_WIND_SPEED = 5;

// Load images
let backgroundImage = new Image();
let targetImage = new Image();
let archerImage = new Image();
let arrowImage = new Image();

let imagesLoaded = 0;
const totalImages = 4;

function loadImage(image, src) {
    image.onload = function() {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            initializeGame();
        }
    };
    image.src = src;
}

loadImage(backgroundImage, 'images/forest_background.png');
loadImage(targetImage, 'images/archery_target.png');
loadImage(archerImage, 'images/archer.png');
loadImage(arrowImage, 'images/arrow.png');

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
    if (imagesLoaded === totalImages) {
        initializeGame();
    } else {
        // If images aren't loaded yet, wait for them
        let checkInterval = setInterval(() => {
            if (imagesLoaded === totalImages) {
                clearInterval(checkInterval);
                initializeGame();
            }
        }, 100);
    }
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
    toggleScoreboard(true); // Ensure scoreboard is visible
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
    updateWind();
    setInterval(updateWind, 10000); // Update wind every 10 seconds
    document.getElementById('game-ui').style.display = 'flex';
    toggleScoreboard(true); // Show scoreboard when game starts
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
    
    drawTarget();
    drawArcher();
    
    if (isMyTurn && !isAnimatingShot) {
        drawAim();
        drawPowerMeter();
    }
}

function drawTarget() {
    const targetSize = 100;
    const targetX = canvas.width / 2 - targetSize / 2;
    const targetY = canvas.height / 2 - targetSize / 2;
    ctx.drawImage(targetImage, targetX, targetY, targetSize, targetSize);
}

function drawArcher() {
    const archerSize = 150;
    ctx.drawImage(archerImage, 0, canvas.height - archerSize, archerSize, archerSize);
    
    // Draw bowstring
    const bowstringStartX = archerSize - 20;
    const bowstringStartY = canvas.height - archerSize / 2;
    const bowstringPullX = bowstringStartX - drawPower / 2;
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bowstringStartX, bowstringStartY - 50);
    ctx.lineTo(bowstringPullX, bowstringStartY);
    ctx.lineTo(bowstringStartX, bowstringStartY + 50);
    ctx.stroke();
}

function drawAim() {
    const crosshairSize = 30;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(aimX - crosshairSize / 2, aimY);
    ctx.lineTo(aimX + crosshairSize / 2, aimY);
    ctx.moveTo(aimX, aimY - crosshairSize / 2);
    ctx.lineTo(aimX, aimY + crosshairSize / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(aimX, aimY, crosshairSize / 2, 0, Math.PI * 2);
    ctx.stroke();
}

function drawPowerMeter() {
    const meterWidth = 30;
    const meterHeight = 150;
    const meterX = canvas.width - meterWidth - 20;
    const meterY = canvas.height - meterHeight - 20;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(meterX - 5, meterY - 5, meterWidth + 10, meterHeight + 10);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(meterX - 5, meterY - 5, meterWidth + 10, meterHeight + 10);
    
    const powerHeight = (drawPower / maxDrawPower) * meterHeight;
    const gradient = ctx.createLinearGradient(meterX, meterY + meterHeight, meterX, meterY + meterHeight - powerHeight);
    gradient.addColorStop(0, 'red');
    gradient.addColorStop(0.6, 'yellow');
    gradient.addColorStop(1, 'lime');
    ctx.fillStyle = gradient;
    ctx.fillRect(meterX, meterY + meterHeight - powerHeight, meterWidth, powerHeight);
    
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Power: ${Math.round(drawPower)}`, meterX + meterWidth / 2, meterY + meterHeight + 20);
}

function updateWind() {
    windSpeed = Math.random() * MAX_WIND_SPEED;
    windDirection = Math.random() < 0.5 ? -1 : 1;
    
    const windInfo = document.getElementById('wind-info');
    const windStrength = Math.abs(windSpeed);
    let windDescription;
    
    if (windStrength < 1) windDescription = "Calm";
    else if (windStrength < 2) windDescription = "Light breeze";
    else if (windStrength < 3) windDescription = "Gentle breeze";
    else if (windStrength < 4) windDescription = "Moderate breeze";
    else windDescription = "Strong breeze";
    
    const directionWord = windDirection === 1 ? "right" : "left";
    
    windInfo.innerHTML = `${windDescription}<br>${windSpeed.toFixed(1)} to the ${directionWord}`;
    windInfo.style.borderColor = windDirection === 1 ? '#3498db' : '#e74c3c';
    
    drawGame();
}

function shootArrow() {
    isAnimatingShot = true;
    let arrowX = 130 - drawPower / 2;
    let arrowY = canvas.height - 75;
    const targetX = aimX;
    const targetY = aimY;
    let time = 0;
    let angle = Math.atan2(targetY - arrowY, targetX - arrowX);
    
    function animate() {
        drawGame();
        
        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(angle);
        ctx.drawImage(arrowImage, 0, -5, 60, 10);
        ctx.restore();
        
        const dx = (targetX - arrowX) * 0.1;
        const dy = (targetY - arrowY) * 0.1;
        arrowX += dx + windSpeed * windDirection * 0.1;
        arrowY += dy;
        
        angle = Math.atan2(dy, dx);
        time += 0.1;
        
        if (Math.abs(arrowX - targetX) < 5 && Math.abs(arrowY - targetY) < 5 || time > 5) {
            isAnimatingShot = false;
            calculateScore(arrowX, arrowY);
        } else {
            requestAnimationFrame(animate);
        }
    }
    
    animate();
}

function calculateScore(x, y) {
    const targetCenterX = canvas.width / 2;
    const targetCenterY = canvas.height / 2;
    const distance = Math.sqrt(Math.pow(x - targetCenterX, 2) + Math.pow(y - targetCenterY, 2));
    const targetSize = 50;
    
    let score;
    if (distance < targetSize * 0.1) score = 10;
    else if (distance < targetSize * 0.3) score = 8;
    else if (distance < targetSize * 0.5) score = 6;
    else if (distance < targetSize * 0.7) score = 4;
    else if (distance < targetSize) score = 2;
    else score = 0;
    
    socket.emit('shootArrow', { lobbyId, score });
    infoDiv.textContent = `You scored ${score} points!`;
    isMyTurn = false;
}

function updateScores(scores) {
    console.log('Raw scores data:', scores);

    const scoreboard = document.getElementById('scoreboard');
    scoreboard.innerHTML = '<h3>Scoreboard</h3>';

    if (!Array.isArray(scores)) {
        console.error('Scores is not an array:', scores);
        scoreboard.innerHTML += '<p>Error: Invalid score data</p>';
        return;
    }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    const headerRow = table.insertRow();
    ['Rank', 'Player', 'Score'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
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
        });
    });

    scoreboard.appendChild(table);
    toggleScoreboard(true);
}

function toggleScoreboard(show) {
    const scoreboard = document.getElementById('scoreboard');
    scoreboard.style.display = show ? 'block' : 'none';
}

function exitGame() {
    gameContainer.style.display = 'none';
    gameOverDiv.style.display = 'none';
    lobbyDiv.style.display = 'block';
    toggleScoreboard(false);
    socket.emit('leave-lobby');
    players = [];
    isHost = false;
    updatePlayerList();
}

exitGameButton.addEventListener('click', exitGame);
exitGameOverButton.addEventListener('click', exitGame);

document.getElementById('leave-lobby').addEventListener('click', () => {
    socket.emit('leave-lobby');
    players = [];
    isHost = false;
    lobbyId = null;
    isMyTurn = false;
    isDragging = false;
    isAnimatingShot = false;
    drawPower = 0;
    
    updatePlayerList();
    startGameButton.style.display = 'none';
    lobbyDiv.style.display = 'block';
    gameContainer.style.display = 'none';
    gameOverDiv.style.display = 'none';
    scoreboardDiv.innerHTML = '';
    infoDiv.textContent = 'Waiting for players...';
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

canvas.addEventListener('mousemove', (event) => {
    if (!isMyTurn || isAnimatingShot) return;
    const rect = canvas.getBoundingClientRect();
    aimX = event.clientX - rect.left;
    aimY = event.clientY - rect.top;
    drawGame();
});

canvas.addEventListener('mousedown', () => {
    if (!isMyTurn || isAnimatingShot) return;
    isDragging = true;
});

canvas.addEventListener('mousemove', (event) => {
    if (!isMyTurn || !isDragging || isAnimatingShot) return;
    const rect = canvas.getBoundingClientRect();
    const mouseY = event.clientY - rect.top;
    drawPower = Math.min(maxDrawPower, Math.max(0, (canvas.height / 2 - mouseY) * 2));
    drawGame();
});

canvas.addEventListener('mouseup', () => {
    if (!isMyTurn || !isDragging || isAnimatingShot) return;
    isDragging = false;
    shootArrow();
});

function handleResize() {
    canvas.width = window.innerWidth * 0.8;
    canvas.height = window.innerHeight * 0.7;
    drawGame();
}

window.addEventListener('resize', handleResize);

handleResize();
if (imagesLoaded === totalImages) {
    drawGame();
}