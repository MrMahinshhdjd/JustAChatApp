const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const path = require('path');

// ----- MongoDB Atlas Connection using your DB URL -----
mongoose
  .connect('mongodb+srv://MahinPro:mahin8890@mahindatabase.1o3vf.mongodb.net/', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'webgames' // specify the database here
  })
  .then(() => console.log('MongoDB Atlas connected'))
  .catch(err => console.error('MongoDB Atlas connection error:', err));

// ----- Define Mongoose Schema and Model -----
const messageSchema = new mongoose.Schema({
  room: { type: String, required: true },
  from: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// ----- Express Setup -----
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// ----- REST Endpoint: Load Message History -----
app.get('/messages', async (req, res) => {
  const room = req.query.room;
  try {
    const messages = await Message.find({ room }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading messages');
  }
});

// ----- Socket.IO Events -----
const users = {};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Register a user
  socket.on('register', (data) => {
    const { username } = data;
    users[username] = socket.id;
    console.log(`User registered: ${username}`);
  });

  // Join a group (room)
  socket.on('join-group', (data) => {
    const { room } = data;
    socket.join(room);
    console.log(`Socket ${socket.id} joined room ${room}`);
  });

  // Handle group messages
  socket.on('group-message', async (data) => {
    const { room, from, message } = data;
    console.log(`Message in ${room} from ${from}: ${message}`);
    try {
      const newMessage = new Message({ room, from, message });
      await newMessage.save();
    } catch (err) {
      console.error('Error saving message:', err);
    }
    io.to(room).emit('group-message', { from, message });
  });

  // Typing indicator
  socket.on('typing', (data) => {
    socket.to(data.room).emit('typing', data);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    for (const username in users) {
      if (users[username] === socket.id) {
        console.log(`User disconnected: ${username}`);
        delete users[username];
        break;
      }
    }
    console.log('Client disconnected:', socket.id);
  });
});

// ----- Start Server -----
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
