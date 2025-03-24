// SignalR connection
let connection;

// Initialize the connection page
function initConnectPage() {
    // Initialize SignalR connection
    connection = new signalR.HubConnectionBuilder()
        .withUrl("/chathub")
        .withAutomaticReconnect()
        .build();
        
    // Start connection
    connection.start()
        .then(() => console.log("SignalR connection started"))
        .catch(err => console.error("SignalR connection error:", err));
        
    // Set up event handlers
    setupEventHandlers();
}

// Set up event handlers
function setupEventHandlers() {
    // Create room form
    document.getElementById('createRoomForm').addEventListener('submit', handleCreateRoom);
    
    // Copy invite code button
    document.getElementById('copyInviteCodeBtn').addEventListener('click', handleCopyInviteCode);
    
    // Enter room button
    document.getElementById('enterRoomBtn').addEventListener('click', handleEnterRoom);
    
    // Join with code form
    document.getElementById('joinWithCodeForm').addEventListener('submit', handleJoinWithCode);
}

// Handle create room form submission
function handleCreateRoom(e) {
    e.preventDefault();
    
    const password = document.getElementById('createPassword').value;
    if (!password) {
        alert("Please enter a password");
        return;
    }
    
    // Hash the password
    const passwordHash = CryptoJS.SHA256(password).toString();
    
    // Generate a unique connection ID
    const uniqueConnectionId = generateUniqueId();
    
    // Create room
    connection.invoke("CreateRoom", uniqueConnectionId, passwordHash)
        .then(inviteCode => {
            console.log("Room created, invite code:", inviteCode);
            
            // Show invite code
            document.getElementById('inviteCodeDisplay').value = inviteCode;
            document.getElementById('inviteCodeSection').classList.remove('d-none');
            
            // Hide create room form
            document.getElementById('createRoomForm').classList.add('d-none');
            
            // Store invite code and password
            sessionStorage.setItem('inviteCode', inviteCode);
            sessionStorage.setItem('roomPassword', password);
            sessionStorage.setItem('connectionId', uniqueConnectionId);
        })
        .catch(err => {
            console.error("Error creating room:", err);
            alert("An error occurred while creating the room");
        });
}

// Handle copy invite code button click
function handleCopyInviteCode() {
    const inviteCodeInput = document.getElementById('inviteCodeDisplay');
    inviteCodeInput.select();
    document.execCommand('copy');
    
    // Show copied notification
    this.innerHTML = '<i class="bi bi-clipboard-check"></i> Copied!';
    setTimeout(() => {
        this.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
    }, 2000);
}

// Handle enter room button click
function handleEnterRoom() {
    const inviteCode = document.getElementById('inviteCodeDisplay').value;
    const password = sessionStorage.getItem('roomPassword');
    const connectionId = sessionStorage.getItem('connectionId');
    
    // Create form for room entry
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/Chat/Chat';
    
    // Add invite code field
    const inviteCodeField = document.createElement('input');
    inviteCodeField.type = 'hidden';
    inviteCodeField.name = 'InviteCode';
    inviteCodeField.value = inviteCode;
    form.appendChild(inviteCodeField);
    
    // Add password field
    const passwordField = document.createElement('input');
    passwordField.type = 'hidden';
    passwordField.name = 'SharedPassword';
    passwordField.value = password;
    form.appendChild(passwordField);
    
    // Add connection ID field
    const connectionIdField = document.createElement('input');
    connectionIdField.type = 'hidden';
    connectionIdField.name = 'ConnectionId';
    connectionIdField.value = connectionId;
    form.appendChild(connectionIdField);
    
    // Submit form
    document.body.appendChild(form);
    form.submit();
}

// Handle join with code form submission
function handleJoinWithCode(e) {
    e.preventDefault();
    
    const inviteCode = document.getElementById('inviteCode').value;
    if (!inviteCode) {
        alert("Please enter an invite code");
        return;
    }
    
    console.log("Joining with invite code:", inviteCode);
    
    // Use SignalR connection to decode invite code
    connection.invoke("DecodeInviteCodeForClient", inviteCode)
        .then(result => {
            console.log("Decoded invite code:", result);
            
            if (result && result.roomCode && result.passwordHash) {
                // Generate a unique connection ID
                const uniqueConnectionId = generateUniqueId();
                
                // Create form
                const form = document.createElement('form');
                form.method = 'post';
                form.action = '/Chat/Chat';
                
                // Add invite code field
                const inviteCodeField = document.createElement('input');
                inviteCodeField.type = 'hidden';
                inviteCodeField.name = 'InviteCode';
                inviteCodeField.value = inviteCode;
                form.appendChild(inviteCodeField);
                
                // Add room code field
                const roomCodeField = document.createElement('input');
                roomCodeField.type = 'hidden';
                roomCodeField.name = 'RoomCode';
                roomCodeField.value = result.roomCode;
                form.appendChild(roomCodeField);
                
                // Add password hash field
                const passwordHashField = document.createElement('input');
                passwordHashField.type = 'hidden';
                passwordHashField.name = 'PasswordHash';
                passwordHashField.value = result.passwordHash;
                form.appendChild(passwordHashField);
                
                // Add connection ID field
                const connectionIdField = document.createElement('input');
                connectionIdField.type = 'hidden';
                connectionIdField.name = 'ConnectionId';
                connectionIdField.value = uniqueConnectionId;
                form.appendChild(connectionIdField);
                
                // Submit form
                document.body.appendChild(form);
                form.submit();
            } else {
                alert("Invalid invite code");
            }
        })
        .catch(err => {
            console.error("Error decoding invite code:", err);
            alert("An error occurred while decoding the invite code: " + err.toString());
        });
}

// Helper function to generate a unique ID
function generateUniqueId() {
    return 'user_' + Math.random().toString(36).substring(2, 12);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initConnectPage); 