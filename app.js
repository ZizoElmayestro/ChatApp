const socket = io();
let userColor = '#4299e1'; // default color
let socketId = ''; // Will store the socket ID assigned by the server
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
let messages = []; // Store messages with their indices


// Listen for socket ID assignment from server
socket.on('assign_socket_id', (id) => {
    socketId = id;
    console.log('Assigned socket ID:', socketId);
    
    // Load messages after we have our socket ID
    loadMessages();
});

// Fetch existing messages using GET when page loads
function loadMessages() {
    fetch('/messages')
        .then(response => response.json())
        .then(loadedMessages => {
            // Clear existing messages
            messages = [];
            messagesDiv.innerHTML = '';
            
            // Add each message to the UI and store it
            loadedMessages.forEach(message => {
                messages[message.index] = message;
                addMessageToUI(message);
            });
        })
        .catch(error => {
            console.error('Error loading messages:', error);
        });
}


// Check server status using HEAD
function checkServerStatus() {
    fetch('/status', { method: 'HEAD' })
        .then(response => {
            console.log('Server status:', response.ok ? 'Online' : 'Offline');
        });
}

// Send message using POST
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const message = {
        text,
        timestamp: new Date().toISOString(),
        sender: 'user',
        color: userColor,
        socketId: socketId // Include the socket ID with each message
    };

    fetch('/message', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
    });

    messageInput.value = '';
}

// Update message using PUT
function updateMessage(id, newText) {

    fetch(`/message/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            text: newText, 
            socketId: socketId // Only send the socket ID for verification
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            console.error('Update failed:', data);
            throw new Error(data.error);
        }
        return data;
    })
    .catch(error => {
        console.error('Error updating message:', error);
        alert(error.message || 'Failed to update message');
        // Reload messages to ensure consistency
        loadMessages();
    });
}

function addMessageToUI(message, index) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(message.sender === 'user' ? 'sent' : 'received');
    
    // Add ID for reference
    const messageId = index !== undefined ? index : messagesDiv.children.length;
    messageElement.dataset.id = messageId;
    
    // Create message content container
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    
    // Create text element
    const textElement = document.createElement('div');
    textElement.classList.add('message-text');
    textElement.textContent = message.deleted ? 'deleted' : message.text;
    
    // Add delete button for user's own messages that aren't deleted
    if (message.socketId === socketId && !message.deleted) {
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '×';
        deleteBtn.classList.add('delete-btn');
        deleteBtn.title = 'Delete message';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteMessage(parseInt(messageElement.dataset.id));
        };
        messageContent.appendChild(deleteBtn);
    }
    
    messageContent.appendChild(textElement);
    
    // Store original text for canceling edit
    textElement.dataset.originalText = message.text;
    
    messageElement.appendChild(messageContent);
    messageElement.style.backgroundColor = message.color;
    messageElement.style.color = isLightColor(message.color) ? '#000' : '#fff';
    
    // Store the message data on the element
    messageElement.messageData = message;
    
    // Add double click handler for editing
    messageElement.ondblclick = function() {
        const messageData = this.messageData;
        // Only allow editing messages sent by the current user
        const isOwnMessage = messageData.socketId === socketId;
        
        if (!isOwnMessage) return; // Exit if not the message owner
        
        const messageId = parseInt(this.dataset.id);
        const textElement = this.querySelector('.message-text');
        const currentText = textElement.textContent;
        
        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.style.width = '100%';
        input.style.padding = '5px';
        input.style.border = '1px solid #ccc';
        input.style.borderRadius = '4px';
        
        // Replace text with input
        textElement.textContent = '';
        textElement.appendChild(input);
        input.focus();
        
        // Handle Enter key or blur to save
        const saveEdit = () => {
            const newText = input.value.trim();
            if (newText && newText !== textElement.dataset.originalText) {
                updateMessage(messageId, newText);
                textElement.textContent = newText;
                textElement.dataset.originalText = newText;
                // Update the stored message data
                this.messageData.text = newText;
            } else {
                textElement.textContent = textElement.dataset.originalText;
            }
        };
        
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                textElement.textContent = textElement.dataset.originalText;
            }
        };
        
        input.onblur = saveEdit;
    };
    
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return messageElement;
}

// Function to determine if a color is light or dark
function isLightColor(color) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return brightness > 155;
}

// Socket.io event listeners
socket.on('new_message', (message) => {
    // Store the message with its index
    if (message.index !== undefined) {
        messages[message.index] = message;
    }
    addMessageToUI(message);
});

// Handle message deletion from server
socket.on('message_deleted', ({ id, message: deletedMessage }) => {
    if (messages[id]) {
        messages[id] = { ...messages[id], ...deletedMessage, deleted: true };
        
        const messageElement = document.querySelector(`[data-id="${id}"]`);
        if (messageElement) {
            messageElement.classList.add('deleted');
            const textElement = messageElement.querySelector('.message-text');
            if (textElement) {
                textElement.textContent = 'deleted';
            }
            // Remove delete button if it exists
            const deleteBtn = messageElement.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.remove();
            }
        }
    }
});

// Function to delete a message
function deleteMessage(id) {
    if (confirm('Are you sure you want to delete this message?')) {
        // Immediately update the UI
        const messageElement = document.querySelector(`[data-id="${id}"]`);
        if (messageElement) {
            messageElement.classList.add('deleted');
            const textElement = messageElement.querySelector('.message-text');
            if (textElement) {
                textElement.textContent = 'deleted';
            }
            // Remove delete button if it exists
            const deleteBtn = messageElement.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.remove();
            }
        }
        
        // Send delete request to server
        fetch(`/message/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ socketId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Delete failed:', data.error);
                // Revert the UI if there was an error
                if (messageElement && messages[id]) {
                    messageElement.classList.remove('deleted');
                    const textElement = messageElement.querySelector('.message-text');
                    if (textElement) {
                        textElement.textContent = messages[id].text;
                    }
                }
                alert(data.error);
            }
        })
        .catch(error => {
            console.error('Error deleting message:', error);
            // Revert the UI on error
            if (messageElement && messages[id]) {
                messageElement.classList.remove('deleted');
                const textElement = messageElement.querySelector('.message-text');
                if (textElement) {
                    textElement.textContent = messages[id].text;
                }
            }
            alert('Failed to delete message');
        });
    }
}

// Handle message updates from server
socket.on('update_message', ({ id, message: updatedMessage }) => {
    if (messages[id]) {
        // Update the message in our local store
        messages[id] = updatedMessage;
        
        // Update the UI
        const messageElement = document.querySelector(`[data-id="${id}"]`);
        if (messageElement) {
            const textElement = messageElement.querySelector('.message-text');
            if (textElement) {
                if (updatedMessage.deleted) {
                    textElement.textContent = 'deleted';
                    textElement.dataset.originalText = 'deleted';
                    messageElement.classList.add('deleted');
                    // Remove delete button if it exists
                    const deleteBtn = messageElement.querySelector('.delete-btn');
                    if (deleteBtn) {
                        deleteBtn.remove();
                    }
                } else {
                    textElement.textContent = updatedMessage.text;
                    textElement.dataset.originalText = updatedMessage.text;
                }
            }
        }
    }
});

// Handle message deletion from server
socket.on('message_deleted', ({ id }) => {
    if (messages[id]) {
        messages[id].deleted = true;
        messages[id].text = 'deleted';
        
        const messageElement = document.querySelector(`[data-id="${id}"]`);
        if (messageElement) {
            messageElement.classList.add('deleted');
            const textElement = messageElement.querySelector('.message-text');
            if (textElement) {
                textElement.textContent = 'deleted';
                textElement.dataset.originalText = 'deleted';
            }
            // Remove delete button if it exists
            const deleteBtn = messageElement.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.remove();
            }
        }
    }
});

// Function to delete a message
function deleteMessage(id) {
    if (confirm('Are you sure you want to delete this message?')) {
        // Immediately update the UI
        const messageElement = document.querySelector(`[data-id="${id}"]`);
        if (messageElement) {
            const textElement = messageElement.querySelector('.message-text');
            if (textElement) {
                textElement.textContent = 'deleted';
                textElement.dataset.originalText = 'deleted';
                messageElement.classList.add('deleted');
                
                // Remove delete button if it exists
                const deleteBtn = messageElement.querySelector('.delete-btn');
                if (deleteBtn) {
                    deleteBtn.remove();
                }
            }
        }
        
        // Send delete request to server
        fetch(`/message/${id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ socketId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Delete failed:', data.error);
                // Revert the UI if there was an error
                if (messageElement && messages[id]) {
                    const textElement = messageElement.querySelector('.message-text');
                    if (textElement) {
                        textElement.textContent = messages[id].text;
                        textElement.dataset.originalText = messages[id].text;
                        messageElement.classList.remove('deleted');
                    }
                }
                alert(data.error);
            }
        })
        .catch(error => {
            console.error('Error deleting message:', error);
            // Revert the UI on error
            if (messageElement && messages[id]) {
                const textElement = messageElement.querySelector('.message-text');
                if (textElement) {
                    textElement.textContent = messages[id].text;
                    textElement.dataset.originalText = messages[id].text;
                    messageElement.classList.remove('deleted');
                }
            }
            alert('Failed to delete message');
        });
    }
}

// Handle color assignment
socket.on('assign_color', (color) => {
    userColor = color;
    console.log('Assigned color:', color);
});
socket.on('update_message', ({ id, message }) => {
    // Update the message in UI if needed
});

// Event listeners
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Check server status every 30 seconds
checkServerStatus();
setInterval(checkServerStatus, 30000);
