const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const bodyParser = require('body-parser');

app.use(express.static('public'));
app.use(bodyParser.json());

const messages = [];
const userColors = {};
let users = new Set(); // Track connected users

const colors = [
    '#FF9B9B', '#9BFFA5', '#9BB5FF', '#E89BFF',
    '#FFE59B', '#9BFFF3', '#FF9BD7', '#B39BFF'
];

function getRandomColor() {
    // Get all currently used colors
    const usedColors = new Set(Object.values(userColors));
    // Find available colors (not yet used)
    const availableColors = colors.filter(color => !usedColors.has(color));
    
    // If no colors available, start reusing from the beginning
    if (availableColors.length === 0) {
        // If all colors are used, we'll start reusing them
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    // Return a random color from available colors
    return availableColors[Math.floor(Math.random() * availableColors.length)];
}

// GET request to fetch all messages with their indices
app.get('/messages', (req, res) => {
    console.log('[INFO] GET method was used ');
    // Add index to each message
    const messagesWithIndices = messages.map((message, index) => ({
        ...message,
        index
    }));
    res.json(messagesWithIndices);
});

// HEAD request to check server status
app.head('/status', (req, res) => {
    console.log('[INFO] HEAD method was used ');
    res.sendStatus(200);
});

// POST request to add new message
app.post('/message', (req, res) => {
    console.log('[INFO] POST method was used ');
    const message = req.body;
    message.color = req.body.color;
    // Store the index of the message for future reference
    const messageIndex = messages.length;
    messages.push(message);
    // Include the message index in the response
    const response = {...message, index: messageIndex};
    io.emit('new_message', response);
    res.status(201).json(response);
});

// DELETE request to delete a message
app.delete('/message/:id', (req, res) => {
    console.log(`[INFO] DELETE method was used for /message/${req.params.id}`);
    const id = parseInt(req.params.id);
    const { socketId } = req.body;
    
    if (messages[id]) {
        // Only allow deletion if the socket ID matches the original sender
        if (messages[id].socketId === socketId) {
            // Mark as deleted and clear the text
            messages[id].deleted = true;
            const originalText = messages[id].text;
            messages[id].text = 'deleted';
            
            // Immediately notify all clients about the deletion
            io.emit('message_deleted', { 
                id, 
                message: messages[id] 
            });
            
            res.status(200).json({ success: true });
            
            // Update the message in the server's storage
            messages[id].text = originalText; // Keep original text in server memory
        } else {
            console.log('Unauthorized delete attempt');
            res.status(403).json({ 
                error: 'Unauthorized: You can only delete your own messages'
            });
        }
    } else {
        res.status(404).json({ error: 'Message not found' });
    }
});

// PUT request to update a message
app.put('/message/:id', (req, res) => {
    console.log(`[INFO] PUT method was used ${req.params.id}`);
    const id = parseInt(req.params.id);
    const updatedMessage = req.body;
    
    if (messages[id]) {
        const originalMessage = messages[id];
        
        // Only allow updates if the socket ID matches the original sender
        if (originalMessage.socketId && updatedMessage.socketId && 
            originalMessage.socketId === updatedMessage.socketId) {
            
            // Create a new message object with only the allowed fields
            const finalMessage = {
                text: updatedMessage.text,
                timestamp: originalMessage.timestamp, // Keep original timestamp
                sender: originalMessage.sender,
                color: originalMessage.color, // Keep original color
                socketId: originalMessage.socketId // Keep original socket ID
            };
            
            messages[id] = finalMessage;
            io.emit('update_message', { id, message: finalMessage });
            res.json(finalMessage);
        } else {
            console.log('Unauthorized edit attempt');
            res.status(403).json({ 
                error: 'Unauthorized: You can only edit your own messages',
                originalSocketId: originalMessage.socketId,
                yourSocketId: updatedMessage.socketId
            });
        }
    } else {
        res.status(404).json({ error: 'Message not found' });
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    users.add(socket.id);
    
    const userColor = getRandomColor();
    userColors[socket.id] = userColor;
    
    // Send the socket ID to the client
    socket.emit('assign_socket_id', socket.id);
    socket.emit('assign_color', userColor);
    
    // Send existing messages with their indices
    messages.forEach((msg, index) => {
        socket.emit('new_message', {...msg, index});
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        users.delete(socket.id);
        delete userColors[socket.id];
        
        // If no users left, terminate Node.js process immediately
        if (users.size === 0) {
            console.log('No users connected. Terminating Node.js process...');
            process.exit(0);
        }
    });
});

const PORT = 3000;
// Listen on all network interfaces
http.listen(PORT, '0.0.0.0', (err) => {
    if (err) {
        console.error('Error starting server:', err);
        return;
    }
    console.log(`Server running on http://192.168.100.80:${PORT} (local network)`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please try a different port or close the application using this port.`);
    } else {
        console.error('Server error:', err);
    }
});
