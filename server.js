const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let lobbies = [];

function createNewLobby() {
    return {
        id: Date.now().toString(),
        players: [],
        gameInProgress: false,
        currentPlayerIndex: 0,
        currentRound: 0
    };
}

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join-game', (playerName) => {
        let lobby = lobbies.find(l => l.players.length < 5 && !l.gameInProgress);
        if (!lobby) {
            lobby = createNewLobby();
            lobbies.push(lobby);
        }

        const player = {
            id: socket.id,
            name: playerName,
            score: 0,
            isHost: lobby.players.length === 0
        };

        lobby.players.push(player);
        socket.join(lobby.id);
        socket.emit('lobby-joined', { lobbyId: lobby.id, players: lobby.players });
        io.to(lobby.id).emit('lobby-update', lobby.players);

        if (player.isHost) {
            socket.emit('host-assigned');
        }
    });

    socket.on('start-game', (lobbyId) => {
        const lobby = lobbies.find(l => l.id === lobbyId);
        if (lobby && lobby.players.length >= 2 && lobby.players[0].id === socket.id) {
            lobby.gameInProgress = true;
            lobby.currentRound = 1;
            lobby.currentPlayerIndex = 0;
            io.to(lobby.id).emit('game-starting');
            io.to(lobby.id).emit('gameStart', { 
                currentPlayer: lobby.players[lobby.currentPlayerIndex].id 
            });
        }
    });

    socket.on('throwJavelin', (data) => {
        const lobby = lobbies.find(l => l.id === data.lobbyId);
        if (lobby) {
            const playerIndex = lobby.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1 && playerIndex === lobby.currentPlayerIndex) {
                lobby.players[playerIndex].score += data.distance;
                nextTurn(lobby);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        for (let lobby of lobbies) {
            const playerIndex = lobby.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                lobby.players.splice(playerIndex, 1);
                if (lobby.players.length > 0 && playerIndex === 0) {
                    lobby.players[0].isHost = true;
                    io.to(lobby.players[0].id).emit('host-assigned');
                }
                io.to(lobby.id).emit('lobby-update', lobby.players);
                if (lobby.gameInProgress && lobby.players.length < 2) {
                    endGame(lobby);
                } else if (lobby.gameInProgress) {
                    nextTurn(lobby);
                }
            }
        }
        // Remove empty lobbies
        lobbies = lobbies.filter(lobby => lobby.players.length > 0);
    });
});

function nextTurn(lobby) {
    lobby.currentPlayerIndex = (lobby.currentPlayerIndex + 1) % lobby.players.length;
    if (lobby.currentPlayerIndex === 0) {
        lobby.currentRound++;
    }

    if (lobby.currentRound <= 3) {
        io.to(lobby.id).emit('nextTurn', {
            currentPlayer: lobby.players[lobby.currentPlayerIndex].id,
            scores: lobby.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
            round: lobby.currentRound
        });
    } else {
        endGame(lobby);
    }
}

function endGame(lobby) {
    const winner = lobby.players.reduce((a, b) => a.score > b.score ? a : b);
    io.to(lobby.id).emit('gameOver', { 
        winner: { id: winner.id, name: winner.name }, 
        scores: lobby.players.map(p => ({ id: p.id, name: p.name, score: p.score }))
    });
    lobby.gameInProgress = false;
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});