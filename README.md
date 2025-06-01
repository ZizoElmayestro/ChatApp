# Real-Time Chat Application

A sophisticated real-time chat application built with Node.js and Socket.IO that supports message management, user identification, and real-time updates.

## Features

- Real-time message synchronization
- Color-coded user identification
- Message editing and deletion capabilities
- Secure message ownership verification
- Automatic server resource management
- RESTful API endpoints

## Prerequisites

- Node.js (v12 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/ZizoElmayestro/chat-app.git
cd chat-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
node server.js
```

The server will start running on `http://localhost:3000`

## API Endpoints

- `GET /messages` - Fetch all messages
- `POST /message` - Add new message
- `PUT /message/:id` - Update existing message
- `DELETE /message/:id` - Delete message
- `HEAD /status` - Check server status

## Technical Stack

- **Backend:**
  - Node.js
  - Express.js
  - Socket.IO
  - Body-parser

## Security Features

- Message ownership verification through socket IDs
- Prevention of unauthorized message modifications
- Secure message deletion process

## Acknowledgments

- Socket.IO for real-time communication capabilities
- Express.js for the robust web framework
- Node.js community for excellent documentation and support
