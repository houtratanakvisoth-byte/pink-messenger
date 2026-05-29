const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { maxHttpBufferSize: 1e7 });
const Datastore = require('nedb-promises');

// Databases
const db = Datastore.create({ filename: 'chat_history.db', autoload: true });
const userDb = Datastore.create({ filename: 'users.db', autoload: true });

const PORT = process.env.PORT || 3000;
app.use(express.static(__dirname));

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

io.on('connection', (socket) => {
    
    // Login & Register Logic
    socket.on('verify user', async (data) => {
        const existingUser = await userDb.findOne({ username: data.username });

        if (!existingUser) {
            await userDb.insert({ username: data.username, password: data.password });
            socket.emit('login success', { username: data.username });
        } else {
            if (existingUser.password === data.password) {
                socket.emit('login success', { username: data.username });
            } else {
                socket.emit('login fail', "Wrong password for this name!");
            }
        }
    });

    // Room Joining Logic
    socket.on('join room', async (roomName) => {
        // Leave all previous rooms first
        socket.rooms.forEach(room => { if (room !== socket.id) socket.leave(room); });
        
        socket.join(roomName);
        
        // Fetch and send history for the specific room
        const history = await db.find({ room: roomName }).sort({ timestamp: 1 });
        socket.emit('load history', history);
    });

    // Messaging Logic
    socket.on('chat message', async (data) => {
        const messageToSave = {
            user: data.user,
            avatar: data.avatar,
            text: data.text || null,
            image: data.image || null,
            room: data.room,
            timestamp: Date.now()
        };
        await db.insert(messageToSave);
        
        // Send ONLY to the specific room
        io.to(data.room).emit('chat message', messageToSave);
    });
});

http.listen(PORT, () => { console.log(`Pink Messenger Live at http://localhost:${PORT}`); });
