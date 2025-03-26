const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// Store messages and users
const messages = {
  general: [],
  random: [],
  support: [],
  gaming: [],
  music: []
};
const users = {};

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  socket.on('join', ({ username, room }) => {
    if (!username || !room || !messages[room]) {
      console.log('Invalid join attempt:', { username, room });
      return;
    }
    
    // Store user data
    users[socket.id] = { username, room };
    socket.join(room);
    
    // Update user list for the room
    updateUserList(room);
    
    // Send message history to the new user
    socket.emit('message_history', messages[room]);
    
    // Notify room about new user
    io.to(room).emit('system_message', `${username} has joined ${room}`);
    console.log(`${username} joined ${room}`);
  });

  socket.on('send_message', (messageText) => {
    const user = users[socket.id];
    if (!user || !messageText) {
      console.log('Invalid message attempt:', { user, messageText });
      return;
    }

    // Create complete message object
    const message = {
      username: user.username,
      text: messageText,
      room: user.room,
      timestamp: new Date().toISOString()
    };
    
    // Store message
    messages[user.room].push(message);
    console.log('New message stored:', message);
    
    // Broadcast to room (including sender)
    io.to(user.room).emit('receive_message', message);
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      const { username, room } = user;
      delete users[socket.id];
      updateUserList(room);
      io.to(room).emit('system_message', `${username} has left ${room}`);
      console.log(`${username} left ${room}`);
    }
  });

  function updateUserList(room) {
    const roomUsers = Object.values(users)
      .filter(user => user.room === room)
      .map(user => user.username);
    io.to(room).emit('user_list', Array.from(new Set(roomUsers)));
    console.log('Updated user list for', room, ':', roomUsers);
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));