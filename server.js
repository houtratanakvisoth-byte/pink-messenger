const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const Datastore = require('nedb-promises');

// Create/load the database file
const db = Datastore.create({ filename: 'chat_history.db', autoload: true });
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    
    // When a user joins a room, fetch their old history
    socket.on('join room', async (roomName) => {
        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });
        
        socket.join(roomName);
        
        // Find all past messages belonging to this room, sorted by time
        try {
            const history = await db.find({ room: roomName }).sort({ timestamp: 1 });
            // Send the history back ONLY to the user who just joined
            socket.emit('load history', history);
        } catch (err) {
            console.error("Error loading history:", err);
        }
    });

    // When a new message is sent, save it FIRST, then broadcast it
    socket.on('chat message', async (data) => {
        const messageToSave = {
            user: data.user,
            text: data.text,
            room: data.room,
            timestamp: Date.now()
        };

        try {
            // Save to our digital notebook
            await db.insert(messageToSave);
            // Broadcast to everyone in the room
            io.to(data.room).emit('chat message', messageToSave);
        } catch (err) {
            console.error("Error saving message:", err);
        }
    });
});

http.listen(PORT, () => {
    console.log(`Server is live on port ${PORT}`);
});
