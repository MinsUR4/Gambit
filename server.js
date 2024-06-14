const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = 3000;
const USERS_DB = 'users.json';

// Sample shop items
let shopItems = [
  { id: 1, name: 'Leaderboard', price: 10 },
  { id: 2, name: 'Item 2', price: 10 },
  { id: 3, name: 'Item 3', price: 15 }
];

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key', // Change this to a secure key
  resave: false,
  saveUninitialized: true
}));

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve other HTML files based on session
app.get('/dashboard', (req, res) => {
  if (req.session.username) {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
  } else {
    res.redirect('/');
  }
});

app.get('/coingame.html', (req, res) => {
  if (req.session.username) {
    res.sendFile(path.join(__dirname, 'public', 'coingame.html'));
  } else {
    res.redirect('/');
  }
});

// Endpoint to get user info
app.get('/get-user-info', (req, res) => {
  if (!req.session.username) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  const users = readUsers();
  const user = users[req.session.username];
  res.json({ username: req.session.username, money: user.money, inventory: user.inventory || [] });
});

// Helper function to read users database
const readUsers = () => {
  if (!fs.existsSync(USERS_DB)) {
    fs.writeFileSync(USERS_DB, JSON.stringify({}));
  }
  const data = fs.readFileSync(USERS_DB);
  return JSON.parse(data);
};

// Helper function to write to users database
const writeUsers = (users) => {
  fs.writeFileSync(USERS_DB, JSON.stringify(users, null, 2));
};

// Endpoint to handle user signup
app.post('/signup', (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();

  if (users[username]) {
    res.json({ message: 'Username already exists.' });
  } else if (username.toLowerCase() === 'admin') {
    res.json({ message: 'Cannot use username Admin.' });
  } else {
    users[username] = { password, money: 0, inventory: [] }; // Initialize money and inventory at signup
    writeUsers(users);
    res.json({ message: 'Account created successfully.' });
  }
});

// Endpoint to handle user login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();

  if (users[username] && users[username].password === password) {
    req.session.username = username;
    res.json({ message: 'Login successful.' });
  } else {
    res.status(401).json({ message: 'Invalid username or password.' });
  }
});


// Endpoint to increment user money
app.post('/increment-money', (req, res) => {
  if (!req.session.username) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  const users = readUsers();
  const username = req.session.username;
  users[username].money += 0.01; // Increment money by 0.1 cents
  writeUsers(users); // Save updated money to database
  res.json({ success: true }); // Respond with success message
});

// Endpoint to handle user logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Command to list shop items
app.get('/shop', (req, res) => {
  res.json(shopItems);
});

// Command for admin bot to add new shop item
app.post('/admin/add-item', (req, res) => {
  const { id, name, price } = req.body;
  if (id && name && price) {
    shopItems.push({ id, name, price });
    res.json({ success: true, message: 'Item added successfully.' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid item data.' });
  }
});

// Socket.io chat functionality
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('login', (username) => {
    socket.username = username; // Set username on socket
  });

  socket.on('chat message', (msg) => {
    const username = socket.username || 'Anonymous'; // Use 'Anonymous' if username not set
    io.emit('chat message', { username, message: msg }); // Emit username and message object

    if (msg.trim() === '!shop') {
      const shopMessage = shopItems.map(item => `${item.name}: $${item.price}`).join(', ');
      io.emit('chat message', { username: 'Admin Bot', message: shopMessage, isBot: true });
    }

    if (msg.startsWith('!buy ')) {
      const itemName = msg.substring(5).trim();
      const item = shopItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
      if (item) {
        const users = readUsers();
        const user = users[username];
        if (user.money >= item.price) {
          user.money -= item.price;
          user.inventory = user.inventory || [];
          user.inventory.push(item.name); // Add item to user's inventory
          writeUsers(users);
          io.emit('chat message', { username: 'Admin Bot', message: `${username} successfully bought ${item.name} for $${item.price}`, isBot: true });
        } else {
          io.emit('chat message', { username: 'Admin Bot', message: `${username} does not have enough money to buy ${item.name}`, isBot: true });
        }
      } else {
        io.emit('chat message', { username: 'Admin Bot', message: `Item ${itemName} not found`, isBot: true });
      }
    }

    if (msg.startsWith('!use ')) {
      const itemName = msg.substring(5).trim();
      if (itemName.toLowerCase() === 'leaderboard' || itemName.toLowerCase() === 'lb') {
        const users = readUsers();
        const topPlayers = getTopPlayers(users, 50); // Function to get top 50 richest players
        const userIndex = topPlayers.findIndex(player => player.username === username);
        const startIdx = Math.max(0, userIndex - 9); // Start index for displaying 10 players

        let leaderboardMessage = `Top 50 Richest Players:\n`;
        for (let i = startIdx; i < Math.min(startIdx + 10, topPlayers.length); i++) {
          leaderboardMessage += `${i + 1}. ${topPlayers[i].username} - $${topPlayers[i].money.toFixed(2)}\n`;
        }

        // Check if navigation arrows are needed
        if (startIdx > 0) {
          leaderboardMessage += `\nUse '!lb back' to view previous players`;
        }
        if (startIdx + 10 < topPlayers.length) {
          leaderboardMessage += `\nUse '!lb next' to view next players`;
        }

        // Emit a private message to the user who requested the leaderboard
        socket.emit('chat message', { username: 'Admin Bot', message: `(Only you can see this message.) ${leaderboardMessage}`, isBot: true, private: true });
      }
    }

    // Handle navigation commands for leaderboard
    if (msg.trim() === '!lb back' || msg.trim() === '!lb next') {
      const users = readUsers();
      const topPlayers = getTopPlayers(users, 50); // Function to get top 50 richest players
      const userIndex = topPlayers.findIndex(player => player.username === username);
      let startIdx = Math.max(0, userIndex - 9); // Start index for displaying 10 players

      if (msg.trim() === '!lb next') {
        startIdx = Math.min(startIdx + 10, topPlayers.length - 10);
      } else if (msg.trim() === '!lb back') {
        startIdx = Math.max(0, startIdx - 10);
      }

      let leaderboardMessage = `Top 50 Richest Players:\n`;
      for (let i = startIdx; i < Math.min(startIdx + 10, topPlayers.length); i++) {
        leaderboardMessage += `${i + 1}. ${topPlayers[i].username} - $${topPlayers      .money.toFixed(2)}\n`;
      }

      // Check if navigation arrows are needed
      if (startIdx > 0) {
        leaderboardMessage += `\nUse '!lb back' to view previous players`;
      }
      if (startIdx + 10 < topPlayers.length) {
        leaderboardMessage += `\nUse '!lb next' to view next players`;
      }

      // Emit a private message to the user who requested the leaderboard navigation
      socket.emit('chat message', { username: 'Admin Bot', message: `(Only you can see this message.) ${leaderboardMessage}`, isBot: true, private: true });
    }

    // Handle inventory command
    if (msg.trim() === '!inv') {
      const users = readUsers();
      const user = users[username];
      const inventoryMessage = user.inventory && user.inventory.length > 0
        ? user.inventory.reduce((acc, item) => {
          acc[item] = (acc[item] || 0) + 1;
          return acc;
        }, {})
        : 'Your inventory is empty.';
      const inventoryList = typeof inventoryMessage === 'string' ? inventoryMessage : Object.entries(inventoryMessage).map(([item, count]) => `${item} (${count})`).join(', ');

      // Emit a private message to the user who requested their inventory
      socket.emit('chat message', { username: 'Admin Bot', message: `(Only you can see this message.) Your inventory: ${inventoryList}`, isBot: true, private: true });
    }
  });

  
 socket.on('place bet', ({ username, betAmount, betChoice }) => {
    console.log('Bet placed by:', username, 'Amount:', betAmount, 'Choice:', betChoice);
    const users = readUsers();
    const user = users[username];
    if (user && betAmount > 0 && betAmount <= user.money) {
      const isHeads = Math.random() >= 0.5;
      const userChoiceHeads = betChoice === 'heads';
      const userWon = (isHeads && userChoiceHeads) || (!isHeads && !userChoiceHeads);

      if (userWon) {
        user.money += betAmount;
        if (betAmount >= 50) {
          io.emit('chat message', { username: 'Admin Bot', message: `${username} just won $${betAmount.toFixed(2)}!`, isBot: true });
        }
      } else {
        user.money -= betAmount;
        if (betAmount >= 50) {
          io.emit('chat message', { username: 'Admin Bot', message: `${username} just lost $${betAmount.toFixed(2)}.`, isBot: true });
        }
      }
      
      writeUsers(users);
      socket.emit('bet result', { isHeads, newAmount: user.money });
    } else {
      socket.emit('bet result', { error: 'Invalid bet or insufficient funds.' });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});



// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
// Function to get top richest players
function getTopPlayers(users, count) {
  const sortedPlayers = Object.entries(users)
    .map(([username, userData]) => ({ username, money: userData.money }))
    .sort((a, b) => b.money - a.money);
  
  return sortedPlayers.slice(0, count);
}