// API Configuration
const apiConfig = {
    baseUrl: window.location.hostname === "localhost" ? "http://localhost:10002" : window.location.origin.replace(/^https?/, 'http'),
    wsUrl: window.location.hostname === "localhost" ? "ws://localhost:10002/api/v1/ws" : window.location.origin.replace(/^https?/, 'ws') + "/api/v1/ws"
};

// Güvenlik kontrolü - HTTPS önerisi
(function checkSecureConnection() {
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        console.warn("⚠️ Bu site HTTPS üzerinden erişilmiyor! Tüm iletişim güvenli olmayabilir.");
        
        // Güvenli sürüme yönlendirme önerisi
        setTimeout(() => {
            if (confirm("Güvenli olmayan bir bağlantı kullanıyorsunuz. Güvenli sürüme geçmek ister misiniz?")) {
                window.location.href = window.location.href.replace('http:', 'https:');
            } else {
                appendSystemMessage("⚠️ Güvenli olmayan bir bağlantı kullanıyorsunuz. Hassas bilgiler paylaşmayın!", true);
            }
        }, 1000);
    }
})();

// Global variables
let connection = null;
let sharedPassword = "";
let connectionIdentifier = "";
let joinWithInviteCode = false;
let inviteCode = "";
let roomCode = "";

// WebRTC variables
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let canvas = null;
let ctx = null;
let localProcessedCanvas = null;
let localProcessedCtx = null;
let remoteProcessedCanvas = null;
let remoteProcessedCtx = null;
let wsConnection = null;
let iceCandidatesQueue = []; // Queue to store ICE candidates
let isRemoteDescriptionSet = false; 
let isProcessing = false;

// Image processing settings
let imageProcessingSettings = {
    faceDetection: false,
    objectDetection: false,
    backgroundRemoval: false,
    activeFilter: "edge-detection",
    brightness: 0,
    contrast: 0
};

// Görüşme sonlandırma mesajının bir kez gösterilmesini sağlamak için flag
let callEndMessageShown = false;

// Utility functions
const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isLocalProcessingEnabled = () => document.getElementById("useLocalProcessing")?.checked || false;

// Güçlü oda şifresi oluşturma fonksiyonu
function generateStrongRoomPassword(length = 32) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";
    let password = "";
    // Cryptographically secure random number generator kullanmak daha iyi
    const randomValues = new Uint32Array(length);
    window.crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < length; i++) {
        const randomIndex = randomValues[i] % charset.length;
        password += charset[randomIndex];
    }
    return password;
}

// Initialize with values from the view
function initChatValues(values) {
    sharedPassword = values.sharedPassword || "";
    connectionIdentifier = values.connectionId || "";
    joinWithInviteCode = values.joinWithInviteCode || false;
    inviteCode = values.inviteCode || "";
    roomCode = values.roomCode || "";
    
    console.log("Room password defined:", !!sharedPassword, "Length:", sharedPassword.length);
    
    // Şifre güvenliğini yalnızca şifre varsa kontrol et
    if (sharedPassword && sharedPassword.trim().length > 0) {
        checkPasswordStrength(sharedPassword);
    } else if (!joinWithInviteCode) {
        // Davet kodu ile giriş yapmıyorsa ve şifre yoksa uyarı göster
        console.warn("Oda şifresi tanımlanmamış!");
        appendSystemMessage("⚠️ Oda şifresi tanımlanmamış! Güvenli iletişim sağlanamayabilir.", true);
    }
    
    // Dosya mesaj kutuları için CSS stillerini ekle
    addFileMessageStyles();
    
    // Dosya yükleme elementlerini DOM yüklendikten sonra oluştur
    // Sayfa yüklendikten sonra veya belirli bir süre sonra deneyelim
    if (document.readyState === 'complete') {
        // Sayfa zaten tamamen yüklenmişse hemen oluştur
        console.log("Document already loaded, creating file input elements");
        ensureFileInputElementsExist();
    } else {
        // Sayfa henüz yüklenmemişse, DOMContentLoaded event'ini bekleyelim
        console.log("Waiting for document to load before creating file input elements");
        window.addEventListener('DOMContentLoaded', function() {
            console.log("Document loaded, creating file input elements");
            ensureFileInputElementsExist();
        });
        
        // Ek olarak, kısa bir bekleme süresi ekleyerek de deneyelim (bazı framework'ler DOM'u daha geç oluşturabilir)
        setTimeout(function() {
            console.log("Timeout: trying to create file input elements");
            ensureFileInputElementsExist();
        }, 2000);
    }
    
    // Initialize UI elements
    canvas = document.getElementById("processedVideoCanvas");
    ctx = canvas?.getContext("2d");
    localProcessedCanvas = document.getElementById("localProcessedCanvas");
    localProcessedCtx = localProcessedCanvas?.getContext("2d");
    
    // İşlenmiş video için görüntü işleme işlevini başlat
    // Bu fonksiyonu burada çağırarak, görüntülü görüşme başlatıldığında
    // işlenmiş görüntünün hemen hazır olmasını sağlıyoruz
    setTimeout(() => {
        // Biraz gecikme ekleyerek sayfanın tam olarak yüklenmesini bekle
        captureAndProcess();
    }, 1000);
}

// Dosya seçme ve gönderme arayüz elementlerini kontrol et ve oluştur
function ensureFileInputElementsExist() {
    // Chat container'ı bul (farklı uygulamalarda farklı class/id kullanılabilir)
    const chatContainer = document.querySelector('.chat-container, .chat-area, #chatArea, #messageContainer, #messagesContainer, .messages-container');
    
    if (!chatContainer) {
        console.warn("Chat container not found for adding file input elements, will add file input to body");
        // Hata vermek yerine uyarı ver ve devam et
    }
    
    // Dosya input elementi kontrolü
    let fileInput = document.getElementById('fileInput');
    if (!fileInput) {
        console.log("Creating fileInput element");
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'fileInput';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
    }
    
    // Mesaj gönderme butonunu bul
    const sendButton = document.getElementById('sendButton');
    // Eğer sendButton yoksa ve chatContainer varsa, alternatif bir element bulmayı dene
    const buttonContainer = sendButton ? sendButton.parentElement : 
                             chatContainer ? chatContainer.querySelector('.input-area, .message-input-container, .message-controls') : null;
    
    // Dosya butonu kontrolü
    if (!document.getElementById('fileButton')) {
        console.log("Creating fileButton element");
        
        // Yeni dosya butonu oluştur
        const fileButton = document.createElement('button');
        fileButton.id = 'fileButton';
        fileButton.innerHTML = '<i class="fas fa-paperclip"></i>'; // Font Awesome ikon
        fileButton.title = 'Dosya Gönder';
        fileButton.style.marginRight = '5px';
        
        // Stil uygula
        if (sendButton) {
            // SendButton varsa onun stilini kopyala
            fileButton.className = sendButton.className;
        } else {
            // Yoksa basit bir stil uygula
            fileButton.style.padding = '8px 12px';
            fileButton.style.background = '#3498db';
            fileButton.style.color = 'white';
            fileButton.style.border = 'none';
            fileButton.style.borderRadius = '4px';
            fileButton.style.cursor = 'pointer';
        }
        
        // Font Awesome yüklenmemişse yedek metin
        if (!document.querySelector('link[href*="font-awesome"]')) {
            fileButton.textContent = '📎';
        }
        
        // Butonu ekle
        if (buttonContainer) {
            // Varsa sendButton'dan önce ekle
            if (sendButton) {
                buttonContainer.insertBefore(fileButton, sendButton);
            } else {
                // sendButton yoksa container'a ekle
                buttonContainer.appendChild(fileButton);
            }
        } else if (chatContainer) {
            // Chat container varsa ama buton container yoksa, chat container'a ekle
            chatContainer.appendChild(fileButton);
        } else {
            // Hiçbir uygun yer bulunamadıysa, body'ye ekle ve sağ alt köşede konumlandır
            document.body.appendChild(fileButton);
            
            // Pozisyon ve stil
            fileButton.style.position = 'fixed';
            fileButton.style.bottom = '20px';
            fileButton.style.right = '20px';
            fileButton.style.zIndex = '9999';
            fileButton.style.fontSize = '18px';
            fileButton.style.width = '50px';
            fileButton.style.height = '50px';
            fileButton.style.borderRadius = '50%';
            fileButton.style.display = 'flex';
            fileButton.style.alignItems = 'center';
            fileButton.style.justifyContent = 'center';
            fileButton.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        }
        
        // Dosya seçme olayını dinle
        fileButton.addEventListener('click', function() {
            fileInput.click();
        });
    }
    
    // Dosya input'unu kontrol et ve eventListener'ı temizle
    if (fileInput) {
        // Önceki event listener'ları temizle (çoklu çağrı durumunda)
        const newFileInput = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(newFileInput, fileInput);
        
        // Tekrar referans al
        fileInput = document.getElementById('fileInput');
        
        // Yeni event listener ekle
        fileInput.addEventListener('change', function(e) {
            if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                console.log("Dosya seçildi:", file.name, "Boyut:", file.size, "Tip:", file.type);
                
                // Dosya gönderme işlemi
                if (typeof chatApp !== 'undefined' && chatApp.sendFile) {
                    appendSystemMessage(`"${file.name}" dosyası gönderiliyor...`);
                    
                    chatApp.sendFile(file).finally(() => {
                        // İşlem bitince dosya seçme input'unu temizle
                        fileInput.value = '';
                    });
                } else {
                    console.error("chatApp.sendFile fonksiyonu bulunamadı");
                    appendSystemMessage("Dosya gönderilemedi: Sistem hazır değil", true);
                    fileInput.value = '';
                }
            }
        });
    }
    
    return true;
}

// Dosya mesajları için CSS stillerini ekle
function addFileMessageStyles() {
    // Stil zaten eklenmiş mi kontrol et
    if (document.getElementById('file-message-styles')) {
        return;
    }
    
    // CSS stil elemanı oluştur
    const styleElement = document.createElement('style');
    styleElement.id = 'file-message-styles';
    styleElement.innerHTML = `
        .message-file {
            display: flex;
            flex-direction: column;
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 8px;
            background-color: #f0f0f0;
            max-width: 80%;
        }
        
        .message-file.message-outgoing {
            align-self: flex-end;
            background-color: #dcf8c6;
        }
        
        .file-container {
            display: flex;
            align-items: center;
            background-color: rgba(255, 255, 255, 0.7);
            border-radius: 8px;
            padding: 10px;
            margin-top: 5px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .file-icon {
            font-size: 24px;
            margin-right: 10px;
        }
        
        .file-info {
            flex: 1;
            overflow: hidden;
        }
        
        .file-name {
            font-weight: bold;
            margin-bottom: 3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .file-size {
            font-size: 12px;
            color: #666;
        }
        
        .file-download-btn {
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 5px 10px;
            cursor: pointer;
            font-size: 14px;
            margin-left: 10px;
            transition: background-color 0.2s;
        }
        
        .file-download-btn:hover {
            background-color: #45a049;
        }
        
        .image-preview {
            margin-top: 10px;
            display: flex;
            justify-content: center;
        }
        
        .image-preview img {
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            transition: transform 0.2s;
        }
        
        .image-preview img:hover {
            transform: scale(1.05);
        }
    `;
    
    // Stil elemanını sayfaya ekle
    document.head.appendChild(styleElement);
}

// Şifre güvenliğini kontrol et ve uyarı göster
function checkPasswordStrength(password) {
    if (!password || password.trim().length === 0) {
        console.warn("Oda şifresi tanımlanmamış!");
        appendSystemMessage("⚠️ Oda şifresi tanımlanmamış! Güvenli iletişim sağlanamayabilir.", true);
        return;
    }
    
    const minLength = 8;
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    let isStrong = password.length >= minLength;
    isStrong = isStrong && ((hasLower && hasUpper && hasNumber) || (hasLower && hasSpecial) || (hasUpper && hasSpecial));
    
    if (!isStrong) {
        console.warn("Oda şifresi zayıf ve kolayca kırılabilir!");
        appendSystemMessage("⚠️ Oda şifresi yeterince güçlü değil! En az 8 karakter, büyük/küçük harf, rakam ve özel karakter içeren bir şifre kullanmanız önerilir.", true);
    }
}

// WebSocket initialization
async function initializeWebSocket() {
    return new Promise(async (resolve) => {
        // Don't initialize WebSocket if local processing is selected
        if (isLocalProcessingEnabled()) {
            console.log("Local processing selected, WebSocket connection not initialized");
            resolve(false);
            return;
        }
        
        // Close existing connection
        if (wsConnection) {
            try {
                wsConnection.close();
            } catch (err) {
                console.error("Error closing WebSocket:", err);
            }
            wsConnection = null;
        }
        
        // Create WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const apiHost = "localhost";
        const apiPort = "10002";
        const apiKey = "X-API-Key";
        const wsEndpoint = "/ws";
        const wsUrl = `${protocol}//${apiHost}:${apiPort}${wsEndpoint}?api_key=${apiKey}`;
        
        console.log("Initializing WebSocket connection:", wsUrl);
        
        // Güvenlik uyarısı
        if (protocol === 'ws:' && window.location.hostname !== 'localhost') {
            console.warn("⚠️ WebSocket bağlantısı güvenli değil (WSS kullanılmıyor)! Yalnızca geliştirme amaçlı kullanın.");
            appendSystemMessage("⚠️ Bağlantı şifreli değil! Hassas bilgiler paylaşmayın.", true);
        }
        
        // Connection attempts
        let connectAttempts = 0;
        const maxConnectAttempts = 3; // Maximum 3 attempts
        
        // Connection attempt function
        const attemptConnection = async () => {
            // Increment connection count
            connectAttempts++;
            console.log(`WebSocket connection attempt ${connectAttempts}/${maxConnectAttempts}...`);
            
            try {
                // Close existing connection if any
                if (wsConnection) {
                    try {
                        wsConnection.close();
                    } catch (error) {
                        console.error("Error closing existing WebSocket connection:", error);
                    }
                    wsConnection = null;
                }
                
                // Create WebSocket connection
                wsConnection = new WebSocket(wsUrl);
                
                // Wait for connection to be established before sending data
                const connectionTimeout = setTimeout(() => {
                    console.log("WebSocket connection timed out");
                    if (wsConnection && wsConnection.readyState !== WebSocket.OPEN) {
                        try {
                            wsConnection.close();
                        } catch (error) {
                            console.error("Error closing WebSocket:", error);
                        }
                        wsConnection = null;
                        
                        // If maximum attempts reached
                        if (connectAttempts >= maxConnectAttempts) {
                            console.log("Maximum connection attempts reached, switching to local processing");
                            // Switch to local processing
                            switchToLocalProcessing();
                            resolve(false);
                        } else {
                            // New connection attempt
                            setTimeout(attemptConnection, 1000);
                        }
                    }
                }, 5000);
                
                // When connection is open
                wsConnection.onopen = () => {
                    console.log("WebSocket connection successfully established");
                    clearTimeout(connectionTimeout);
                    
                    // Send authorization message immediately after connection is open
                    try {
                        // Send authorization information according to API documentation
                        const authMessage = {
                            type: "authorization",
                            api_key: apiKey,
                            client_info: {
                                name: "Browser Client",
                                version: "1.0",
                                type: isMobile() ? "mobile" : "desktop"
                            }
                        };
                        wsConnection.send(JSON.stringify(authMessage));
                        console.log("Authorization information sent");
                    } catch (authError) {
                        console.error("Error sending authorization message:", authError);
                    }
                    
                    // Set up WebSocket event listeners
                    setupWebSocketEventListeners(wsConnection);
                    
                    resolve(true);
                };
                
                // When connection error occurs
                wsConnection.onerror = (err) => {
                    console.error("WebSocket connection error:", err);
                    clearTimeout(connectionTimeout);
                    
                    // If maximum attempts reached
                    if (connectAttempts >= maxConnectAttempts) {
                        console.log("Maximum connection attempts reached, switching to local processing");
                        // Switch to local processing
                        switchToLocalProcessing();
                        resolve(false);
                    } else {
                        // New connection attempt
                        setTimeout(attemptConnection, 1000);
                    }
                };
            } catch (err) {
                console.error("WebSocket connection error:", err);
                
                // If maximum attempts reached
                if (connectAttempts >= maxConnectAttempts) {
                    console.log("Maximum connection attempts reached, switching to local processing");
                    // Switch to local processing
                    switchToLocalProcessing();
                    resolve(false);
                } else {
                    // New connection attempt
                    setTimeout(attemptConnection, 1000);
                }
            }
        };
        
        // First connection attempt
        attemptConnection();
    });
}

// Function to switch to local processing
function switchToLocalProcessing() {
    console.log("Switching to local processing due to API connection failure");
    
    // Set the useLocalProcessing checkbox to checked
    const useLocalProcessingCheckbox = document.getElementById('useLocalProcessing');
    if (useLocalProcessingCheckbox) {
        useLocalProcessingCheckbox.checked = true;
    }
    
    // Show API connection error popup
    showApiErrorPopup();
    
    // Start local processing - captureAndProcess zaten çalışmaktadır, açıkça çağırmaya gerek yok
}

// Show API connection error popup
function showApiErrorPopup() {
    const popup = document.getElementById('apiErrorPopup');
    if (popup) {
        // Show popup
        popup.classList.add('show-popup');
        
        // Hide popup after 2 seconds
        setTimeout(() => {
            popup.classList.add('hide-popup');
            
            // Remove popup after fade-out animation
            setTimeout(() => {
                popup.classList.remove('show-popup');
                popup.classList.remove('hide-popup');
            }, 500);
        }, 2000);
    }
}

// Set up WebSocket event listeners
function setupWebSocketEventListeners(ws) {
    if (!ws) return;
    
    // Message event
    ws.onmessage = (event) => {
        try {
            // Process the received message
            const message = JSON.parse(event.data);
            
            // Handle different message types
            switch(message.type) {
                case "pong":
                    console.log("Pong received from server");
                    break;
                case "processed_frame":
                    handleProcessedFrame(message);
                    break;
                case "error":
                    console.error("Error from server:", message.error);
                    break;
                default:
                    console.log("Unknown message type:", message.type);
            }
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    };
    
    // Close event
    ws.onclose = (event) => {
        console.log("WebSocket connection closed:", event.code, event.reason);
        // Attempt to reconnect after a delay
        setTimeout(() => initializeWebSocket(), 5000);
    };
    
    // Set ping interval
    setInterval(() => sendPingMessage(), 30000);
}

// Send ping message
function sendPingMessage() {
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
        console.log("WebSocket connection closed, cannot send ping");
        return;
    }
    
    // Don't send ping if local processing is active
    if (isLocalProcessingEnabled()) {
        console.log("Local processing active, not sending ping");
        return;
    }
    
    try {
        // Create ping message
        const pingData = {
            type: "ping",
            timestamp: new Date().toISOString()
        };
        
        // Send ping message
        wsConnection.send(JSON.stringify(pingData));
        console.log("Ping message sent");
    } catch (err) {
        console.error("Error sending ping:", err);
    }
}

// Handle processed frame from server
function handleProcessedFrame(message) {
    isProcessing = false;
    
    // Şifrelenmiş veri kontrolü
    if (message.frame_base64_encrypted) {
        try {
            // Şifrelenmiş veriyi çöz
            const encryptionKey = chatApp.getEncryptionKey();
            const bytes = CryptoJS.AES.decrypt(
                message.frame_base64_encrypted,
                encryptionKey,
                {
                    keySize: 256 / 32,
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                }
            );
            const decryptedBase64 = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decryptedBase64) {
                console.warn("Decryption failed for processed frame");
                return;
            }
            
            // İşlenmiş görüntüyü oluştur
            createProcessedImage(decryptedBase64);
        } catch (error) {
            console.error("Error decrypting processed frame:", error);
        }
    } 
    // Eski şifrelenmemiş veri formatı için geriye dönük uyumluluk
    else if (message.frame_base64) {
        console.warn("Received unencrypted frame - consider upgrading server");
        createProcessedImage(message.frame_base64);
    }
    else {
        console.warn("No processed frame data received");
    }
}

// Şifresi çözülmüş görüntü verisinden işlenmiş görüntüyü oluştur
function createProcessedImage(base64Data) {
    try {
        // Create image from base64 data
        const img = new Image();
        img.onload = () => {
            if (!remoteProcessedCanvas) {
                remoteProcessedCanvas = document.createElement('canvas');
                remoteProcessedCanvas.width = img.width;
                remoteProcessedCanvas.height = img.height;
                remoteProcessedCtx = remoteProcessedCanvas.getContext('2d');
            }
            
            // Draw processed image to canvas
            remoteProcessedCtx.drawImage(img, 0, 0);
            
            // Update the video stream
            updateProcessedVideoStream();
        };
        img.src = "data:image/jpeg;base64," + base64Data;
    } catch (error) {
        console.error("Error creating processed image:", error);
    }
}

// Process video frame
async function processVideoFrame() {
    try {
        // If local processing is active, skip API processing
        if (isLocalProcessingEnabled()) {
            return;
        }
        
        // Check elements required for API processing
        const video = document.getElementById("localVideo");
        if (!video || video.readyState < 2) {
            console.log("Video not ready");
            return;
        }
        
        // Check WebSocket connection
        if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
            console.log("WebSocket connection closed, cannot send frame");
            return;
        }
        
        // Create canvas (temporary)
        if (!canvas) {
            canvas = document.createElement("canvas");
            ctx = canvas.getContext("2d");
        }
        
        // Adjust canvas dimensions based on video size
        const qualityScale = isMobile() ? 0.6 : 0.8;
        
        // Get video dimensions
        const videoWidth = video.videoWidth || 640;
        const videoHeight = video.videoHeight || 480;
        
        // Set canvas dimensions
        canvas.width = videoWidth * qualityScale;
        canvas.height = videoHeight * qualityScale;
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas image to base64
        const imageQuality = isMobile() ? 0.75 : 0.85;
        const imageData = canvas.toDataURL("image/jpeg", imageQuality);
        const base64Data = imageData.split(",")[1];
        
        // If no base64 data, warn and skip
        if (!base64Data) {
            console.warn("No base64 data generated, skipping frame");
            return;
        }
        
        // Görüntü verisini şifrele
        const encryptionKey = chatApp.getEncryptionKey();
        const encryptedData = CryptoJS.AES.encrypt(
            base64Data,
            encryptionKey,
            {
                keySize: 256 / 32,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            }
        ).toString();
        
        // Send data in JSON format according to API documentation
        const requestData = {
            frame_base64_encrypted: encryptedData,
            is_encrypted: true,
            encryption_method: "aes-256-cbc",
            session_id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
            processing_type: "default",
            options: {
                face_detection: true,
                object_detection: false,
                background_removal: true
            }
        };
        
        // Send data in JSON format over WebSocket
        wsConnection.send(JSON.stringify(requestData));
        console.log("Encrypted frame sent to API", new Date().toISOString());
    } catch (error) {
        console.error("Error processing frame:", error);
    }
}

// Update processed video stream
function updateProcessedVideoStream() {
    // Implementation depends on how you want to display the processed video
    // This would typically involve creating a MediaStream from the canvas
}

// Capture and process
function captureAndProcess() {
    console.log("Capture and processing started");
    
    // Yerel işleme aktif olup olmadığını izleyen değişken
    let localProcessingActive = false;
    
    function processFrame() {
        const video = document.getElementById("localVideo");
        if (video && video.readyState >= 2) {
            try {
                // Geçici canvas oluştur
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = video.videoWidth || 640;
                tempCanvas.height = video.videoHeight || 480;
                const tempCtx = tempCanvas.getContext('2d');
                
                // Video karesini tempCanvas'a çiz
                tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
                
                // localProcessedCanvas'a işlenmiş görüntüyü çiz (her zaman kenar tespiti kullan)
                const localCanvas = document.getElementById("localProcessedCanvas");
                if (localCanvas) {
                    const localCtx = localCanvas.getContext('2d');
                    
                    // Canvas boyutlarını ayarla
                    if (localCanvas.width !== video.videoWidth || localCanvas.height !== video.videoHeight) {
                        localCanvas.width = video.videoWidth || 640;
                        localCanvas.height = video.videoHeight || 480;
                    }
                    
                    // Video karesini canvas'a çiz
                    localCtx.drawImage(video, 0, 0, localCanvas.width, localCanvas.height);
                    
                    // İşlenecek görüntüyü al
                    const imageData = localCtx.getImageData(0, 0, localCanvas.width, localCanvas.height);
                    
                    // Kenar tespiti algortimasını her zaman uygula
                    const processedData = simpleEdgeDetection(imageData);
                    localCtx.putImageData(processedData, 0, 0);
                }
                
                // API sunucusu sadece yerel işleme seçili DEĞİLSE ve WebSocket bağlantısı varsa kullanılır
                if (wsConnection && wsConnection.readyState === WebSocket.OPEN && !isLocalProcessingEnabled()) {
                    if (!isProcessing) {
                        isProcessing = true;
                        console.log("Sending frame for server processing");
                        
                        // Encode as base64 and send to server
                        const imageData = tempCanvas.toDataURL('image/jpeg', 0.7);
                        const base64Data = imageData.split(',')[1];
                        
                        // Send to server
                        wsConnection.send(base64Data);
                    }
                }
            } catch (error) {
                console.error("Error processing frame:", error);
                isProcessing = false;
            }
        }
        
        // Request next frame
        requestAnimationFrame(processFrame);
    }
    
    // Start processing frames
    processFrame();
}

// Basit kenar tespiti algoritması
function simpleEdgeDetection(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    // Çıkış için yeni ImageData oluştur
    const output = new ImageData(width, height);
    const outputData = output.data;
    
    // İlk aşama: Tüm pikselleri beyaz yap
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            // Her pikselin başlangıçta beyaz olmasını sağla (arka plan varsayılanı)
            outputData[idx] = 255;     // R
            outputData[idx + 1] = 255; // G
            outputData[idx + 2] = 255; // B
            outputData[idx + 3] = 255; // A
        }
    }
    
    // İkinci aşama: Hareket algılama ve ön planı çıkarma
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            
            // Hareket algılama: Merkez piksel ile çevresindeki pikselleri karşılaştır
            let motionDetected = false;
            const centerValue = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            
            // Çevredeki pikselleri kontrol et
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    if (kx === 0 && ky === 0) continue; // Merkez piksel
                    
                    const neighborIdx = ((y + ky) * width + (x + kx)) * 4;
                    const neighborValue = (data[neighborIdx] + data[neighborIdx + 1] + data[neighborIdx + 2]) / 3;
                    
                    // Eğer merkez piksel ile komşu piksel arasında belirli bir fark varsa
                    if (Math.abs(centerValue - neighborValue) > 35) {
                        motionDetected = true;
                        break;
                    }
                }
                if (motionDetected) break;
            }
            
            // Hareket algılandıysa orijinal renkleri koru, algılanmadıysa beyaz yap
            if (motionDetected) {
                // Orijinal piksel renklerini koru (ön plan)
                outputData[idx] = data[idx];         // R
                outputData[idx + 1] = data[idx + 1]; // G
                outputData[idx + 2] = data[idx + 2]; // B
                outputData[idx + 3] = 255;           // A
            }
            // Hareket algılanmadıysa zaten beyaz (arka plan)
        }
    }
    
    // Üçüncü aşama: Renkleri ters çevir
    for (let i = 0; i < outputData.length; i += 4) {
        outputData[i] = 255 - outputData[i];         // R ters
        outputData[i + 1] = 255 - outputData[i + 1]; // G ters
        outputData[i + 2] = 255 - outputData[i + 2]; // B ters
        // Alpha kanalını değiştirmiyoruz
    }
    
    return output;
}

// Initialize SignalR connection
async function initSignalRConnection() {
    try {
        console.log("Initializing SignalR connection");
        
        // Check if we have the required connection parameters
        if (!connectionIdentifier) {
            console.error("Missing connection identifier");
            document.getElementById("connectionStatus").textContent = "Connection Error: Missing ID";
            document.getElementById("connectionStatus").className = "badge bg-danger me-2";
            return false;
        }
        
        // Davet koduyla giriş
        if (joinWithInviteCode) {
            if (!inviteCode || inviteCode.trim().length === 0) {
                console.error("Missing invite code while joinWithInviteCode is true");
                document.getElementById("connectionStatus").textContent = "Connection Error: Missing Invite Code";
                document.getElementById("connectionStatus").className = "badge bg-danger me-2";
                return false;
            }
            console.log("Connection with invite code:", inviteCode);
        } 
        // Şifreyle giriş
        else {
            if (!sharedPassword || sharedPassword.trim().length === 0) {
                console.error("Missing shared password while joinWithInviteCode is false");
                document.getElementById("connectionStatus").textContent = "Connection Error: Missing Password";
                document.getElementById("connectionStatus").className = "badge bg-danger me-2";
                appendSystemMessage("⚠️ Oda şifresi eksik olduğu için bağlantı kurulamadı!", true);
                return false;
            }
            console.log("Connection with password, length:", sharedPassword.length);
        }
        
        // Create SignalR connection with more detailed logging and timeout
        connection = new signalR.HubConnectionBuilder()
            .withUrl("/chathub", {
                transport: signalR.HttpTransportType.WebSockets,
                skipNegotiation: true,
                accessTokenFactory: () => null
            })
            .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
            .configureLogging(signalR.LogLevel.Information)
            .build();
            
        // Set up connection event handlers
        setupSignalREventHandlers();
        
        // Listen for connection close or reconnecting events
        connection.onclose((error) => {
            console.error("Connection closed with error:", error);
            document.getElementById("connectionStatus").textContent = "Disconnected";
            document.getElementById("connectionStatus").className = "badge bg-danger me-2";
        });
        
        connection.onreconnecting((error) => {
            console.warn("Connection reconnecting due to error:", error);
            document.getElementById("connectionStatus").textContent = "Reconnecting...";
            document.getElementById("connectionStatus").className = "badge bg-warning me-2";
        });
        
        connection.onreconnected((connectionId) => {
            console.log("Connection reconnected with ID:", connectionId);
            document.getElementById("connectionStatus").textContent = "Connected";
            document.getElementById("connectionStatus").className = "badge bg-success me-2";
        });
        
        // Set connection timeout
        const connectionPromise = connection.start();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Connection timeout")), 15000);
        });
        
        // Wait for connection or timeout
        await Promise.race([connectionPromise, timeoutPromise]);
        console.log("SignalR connection started");
        
        // Update connection status
        document.getElementById("connectionStatus").textContent = "Connected";
        document.getElementById("connectionStatus").className = "badge bg-success me-2";
        
        // Try to join chat based on mode
        try {
            if (joinWithInviteCode) {
                console.log("Attempting to join with invite code:", inviteCode);
                await connection.invoke("JoinWithInviteCode", inviteCode, connectionIdentifier);
                console.log("Successfully joined with invite code:", inviteCode);
            } else {
                console.log("Attempting to join chat with connection ID and password:", connectionIdentifier);
                await connection.invoke("JoinChat", connectionIdentifier, sharedPassword);
                console.log("Successfully joined chat with password");
            }
            
            return true;
        } catch (joinError) {
            console.error("Error joining chat:", joinError);
            document.getElementById("connectionStatus").textContent = "Join Failed";
            document.getElementById("connectionStatus").className = "badge bg-danger me-2";
            return false;
        }
    } catch (error) {
        console.error("Error initializing SignalR connection:", error);
        document.getElementById("connectionStatus").textContent = "Connection Failed: " + (error.message || "Unknown error");
        document.getElementById("connectionStatus").className = "badge bg-danger me-2";
        return false;
    }
}

// Set up SignalR event handlers
function setupSignalREventHandlers() {
    if (!connection) return;
    
    // Alınan dosya parçaları için geçici depolama
    let fileChunks = {};
    
    // User joined event
    connection.on("UserJoined", (userId) => {
        console.log("User joined:", userId);
        appendSystemMessage(`User ${userId} joined the chat`);
    });
    
    // Receive message event
    connection.on("ReceiveMessage", (userId, message, encryptedMessage) => {
        console.log("Encrypted message received from:", userId);
        
        // Decrypt message if encrypted
        let decryptedMessage = "";
        try {
            // Decrypt using CryptoJS with improved security options
            const encryptionKey = chatApp.getEncryptionKey();
            const bytes = CryptoJS.AES.decrypt(
                encryptedMessage,
                encryptionKey,
                {
                    keySize: 256 / 32,
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                }
            );
            decryptedMessage = bytes.toString(CryptoJS.enc.Utf8);
            
            // Şifre çözme başarısız olursa veya boş gelirse hata fırlat
            if (!decryptedMessage) {
                throw new Error("Mesaj şifresi çözülemedi");
            }
            
            // Özel mesaj tiplerini kontrol et - dosya mesajı olabilir
            try {
                const jsonMessage = JSON.parse(decryptedMessage);
                
                // Özel dosya mesajlarını işle
                if (jsonMessage.type) {
                    console.log("Özel mesaj tipi algılandı:", jsonMessage.type);
                    
                    // Dosya başlığı
                    if (jsonMessage.type === "file") {
                        console.log("Dosya başlığı alındı:", jsonMessage.name);
                        
                        // Dosya parçaları için container oluştur
                        fileChunks[jsonMessage.name] = {
                            name: jsonMessage.name,
                            size: jsonMessage.size,
                            fileType: jsonMessage.fileType,
                            parts: jsonMessage.parts,
                            receivedParts: 0,
                            chunks: []
                        };
                        
                        // Dosya alımı başladı mesajı
                        appendSystemMessage(`"${jsonMessage.name}" dosyası alınıyor...`);
                        return;
                    }
                    
                    // Dosya parçası
                    if (jsonMessage.type === "file_chunk" && jsonMessage.name) {
                        // Dosya chunk'ını kontrol et
                        if (fileChunks[jsonMessage.name]) {
                            // Parçayı kaydet
                            fileChunks[jsonMessage.name].chunks[jsonMessage.part - 1] = jsonMessage.data;
                            fileChunks[jsonMessage.name].receivedParts++;
                            
                            console.log(`Dosya parçası alındı: ${jsonMessage.name} - ${fileChunks[jsonMessage.name].receivedParts}/${fileChunks[jsonMessage.name].parts}`);
                            
                            // İlerleme mesajı (1/4, 2/4 gibi)
                            if (fileChunks[jsonMessage.name].parts > 1) {
                                appendSystemMessage(`"${jsonMessage.name}" dosyası alınıyor: ${fileChunks[jsonMessage.name].receivedParts}/${fileChunks[jsonMessage.name].parts}`);
                            }
                        }
                        return;
                    }
                    
                    // Dosya tamamlandı
                    if (jsonMessage.type === "file_complete" && jsonMessage.name) {
                        if (fileChunks[jsonMessage.name]) {
                            console.log(`Dosya tamamlandı: ${jsonMessage.name}`);
                            
                            // Tüm parçaları birleştir
                            const completeFileData = fileChunks[jsonMessage.name].chunks.join('');
                            
                            // Dosya verisi oluştur
                            const fileInfo = {
                                name: fileChunks[jsonMessage.name].name,
                                size: fileChunks[jsonMessage.name].size,
                                type: fileChunks[jsonMessage.name].fileType,
                                data: ""
                            };
                            
                            try {
                                // Dosya verisi şifresini çöz
                                const fileBytes = CryptoJS.AES.decrypt(
                                    completeFileData,
                                    encryptionKey,
                                    {
                                        keySize: 256 / 32,
                                        mode: CryptoJS.mode.CBC,
                                        padding: CryptoJS.pad.Pkcs7
                                    }
                                );
                                
                                // JSON verisini parse et
                                const parsedFileInfo = JSON.parse(fileBytes.toString(CryptoJS.enc.Utf8));
                                
                                // Dosyayı işle
                                handleReceivedFile(userId, parsedFileInfo.name, parsedFileInfo);
                                
                                // Temizle
                                delete fileChunks[jsonMessage.name];
                            } catch (decryptError) {
                                console.error("Dosya şifresi çözülemedi:", decryptError);
                                appendSystemMessage("Dosya alınırken hata oluştu: Şifre çözülemedi", true);
                            }
                        }
                        return;
                    }
                    
                    // Tek parça dosya
                    if (jsonMessage.type === "file_single" && jsonMessage.fileInfo) {
                        console.log("Tek parça dosya alındı");
                        
                        try {
                            // Dosya verisi şifresini çöz
                            const fileBytes = CryptoJS.AES.decrypt(
                                jsonMessage.fileInfo,
                                encryptionKey,
                                {
                                    keySize: 256 / 32,
                                    mode: CryptoJS.mode.CBC,
                                    padding: CryptoJS.pad.Pkcs7
                                }
                            );
                            
                            // JSON verisini parse et
                            const parsedFileInfo = JSON.parse(fileBytes.toString(CryptoJS.enc.Utf8));
                            
                            // Dosyayı işle
                            handleReceivedFile(userId, parsedFileInfo.name, parsedFileInfo);
                        } catch (decryptError) {
                            console.error("Dosya şifresi çözülemedi:", decryptError);
                            appendSystemMessage("Dosya alınırken hata oluştu: Şifre çözülemedi", true);
                        }
                        return;
                    }
                }
            } catch (jsonError) {
                // JSON olarak parse edilemeyen normal metin mesajı
                console.log("Normal metin mesajı alındı");
            }
        } catch (error) {
            console.error("Error decrypting message:", error);
            decryptedMessage = "⚠️ [Şifreli Mesaj - Çözülemedi]";
        }
        
        // Append message to chat
        appendMessage(userId, decryptedMessage);
    });
    
    // Receive file event
    connection.on("ReceiveFile", (userId, fileName, encryptedFileInfo) => {
        console.log("Encrypted file received from:", userId);
        
        // Decrypt file info
        let fileData = "";
        try {
            // Geliştirilmiş şifre çözme
            const encryptionKey = chatApp.getEncryptionKey();
            const bytes = CryptoJS.AES.decrypt(
                encryptedFileInfo, 
                encryptionKey,
                {
                    keySize: 256 / 32,
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                }
            );
            fileData = bytes.toString(CryptoJS.enc.Utf8);
            
            // Çözülen veriyi kontrol et
            if (!fileData) {
                throw new Error("Dosya şifresi çözülemedi");
            }
            
            // Parse file data
            const fileInfo = JSON.parse(fileData);
            
            // Handle file based on type
            handleReceivedFile(userId, fileName, fileInfo);
        } catch (error) {
            console.error("Error processing file:", error);
            appendSystemMessage("Alınan dosya işlenemedi: " + error.message, true);
        }
    });
    
    // Video call events
    connection.on("ReceiveVideoCallOffer", handleVideoCallOffer);
    connection.on("ReceiveVideoCallAnswer", handleVideoCallAnswer);
    connection.on("ReceiveIceCandidate", handleIceCandidate);
    connection.on("ReceiveCallRejected", handleCallRejected);
    connection.on("ReceiveCallEnded", handleCallEnded);
    connection.on("ReceiveLeaveCall", handleLeaveCall);
}

// Video call handlers
function handleVideoCallOffer(offer) {
    console.log("Received video call offer");
    
    // Only process if we have proper WebRTC support
    if (!chatApp.isWebRTCSupported()) {
        console.error("WebRTC is not supported in this browser");
        connection.invoke("SendCallRejected", "").catch(err => console.error("Error sending call rejection:", err));
        return;
    }
    
    // Show incoming call modal
    const incomingCallModal = new bootstrap.Modal(document.getElementById('incomingCallModal'));
    incomingCallModal.show();
    
    // Accept call button
    document.getElementById('acceptCallButton').onclick = () => {
        incomingCallModal.hide();
        chatApp.acceptIncomingCall(offer).then(() => {
            console.log("Call accepted");
            
            // Arayanın kabul ettiği durumda da hızlı sonlandırma butonunu ve ayrılma butonunu göster
            const quickEndCallButton = document.getElementById('quickEndCallButton');
            const leaveCallButton = document.getElementById('leaveCallButton');
            
            if (quickEndCallButton) {
                quickEndCallButton.style.display = 'flex';
                quickEndCallButton.style.opacity = '1';
                quickEndCallButton.style.visibility = 'visible';
            }
            
            if (leaveCallButton) {
                leaveCallButton.style.display = 'flex';
                leaveCallButton.style.opacity = '1';
                leaveCallButton.style.visibility = 'visible';
            }
            
            // Butonların görünürlüğünü garantilemek için bir timeout ekleyelim
            setTimeout(() => {
                if (quickEndCallButton) {
                    quickEndCallButton.style.display = 'flex';
                    quickEndCallButton.style.opacity = '1';
                    quickEndCallButton.style.visibility = 'visible';
                }
                
                if (leaveCallButton) {
                    leaveCallButton.style.display = 'flex';
                    leaveCallButton.style.opacity = '1';
                    leaveCallButton.style.visibility = 'visible';
                }
            }, 500);
        }).catch(err => {
            console.error("Error accepting call:", err);
            connection.invoke("SendCallRejected", "").catch(err => console.error("Error sending call rejection:", err));
        });
    };
    
    // Reject call button
    document.getElementById('rejectCallButton').onclick = () => {
        incomingCallModal.hide();
        console.log("Call rejected by user");
        connection.invoke("SendCallRejected", "").catch(err => console.error("Error sending call rejection:", err));
    };
}

function handleVideoCallAnswer(answer) {
    console.log("Received video call answer");
    chatApp.handleCallAnswer(answer).catch(err => {
        console.error("Error handling call answer:", err);
    });
}

function handleIceCandidate(candidate) {
    console.log("Received ICE candidate");
    chatApp.addIceCandidate(candidate).catch(err => {
        console.error("Error adding ICE candidate:", err);
    });
}

function handleCallRejected() {
    console.log("Call was rejected");
    
    // Çağrı reddedildiğinde sadece bir kez mesaj göster
    const wasCallInProgress = chatApp.callInProgress;
    
    // Görüşmeyi sonlandır
    chatApp.endCall();
    
    // Eğer reddedilme mesajı gösterilmemişse göster
    if (wasCallInProgress && !callEndMessageShown) {
        console.log("Adding call rejected message");
        appendSystemMessage("Görüntülü arama reddedildi.");
        callEndMessageShown = true;
        
        // Sonraki görüşme için flag'i 5 saniye sonra sıfırla
        setTimeout(() => {
            callEndMessageShown = false;
        }, 5000);
    }
}

function handleCallEnded() {
    console.log("Call was ended by remote peer");
    
    // Eğer mesaj zaten gösterilmişse, tekrar mesaj eklemesin
    const wasCallInProgress = chatApp.callInProgress;
    
    // Görüşmeyi sonlandır
    chatApp.endCall();
    
    // endCall içinde mesaj gösterilmemiş ve görüşme aktifti ise mesaj göster
    if (wasCallInProgress && !callEndMessageShown) {
        console.log("Adding call ended by remote peer message");
        appendSystemMessage("Karşı taraf görüntülü görüşmeyi sonlandırdı.");
        callEndMessageShown = true;
        
        // Sonraki görüşme için flag'i 5 saniye sonra sıfırla
        setTimeout(() => {
            callEndMessageShown = false;
        }, 5000);
    }
    
    // Kırımızı ve gri butonu kesinlikle gizle
    const quickEndCallButton = document.getElementById('quickEndCallButton');
    const leaveCallButton = document.getElementById('leaveCallButton');
    
    if (quickEndCallButton) {
        console.log("Hiding quick end call button because call was ended");
        quickEndCallButton.style.display = 'none';
        quickEndCallButton.style.opacity = '0';
        quickEndCallButton.style.visibility = 'hidden';
    }
    
    if (leaveCallButton) {
        console.log("Hiding leave call button because call was ended");
        leaveCallButton.style.display = 'none';
        leaveCallButton.style.opacity = '0';
        leaveCallButton.style.visibility = 'hidden';
    }
    
    // Kesinlikle butonların gizlendiğinden emin olmak için bir timeout ekle
    setTimeout(() => {
        if (quickEndCallButton) {
            quickEndCallButton.style.display = 'none';
            quickEndCallButton.style.visibility = 'hidden';
        }
        if (leaveCallButton) {
            leaveCallButton.style.display = 'none';
            leaveCallButton.style.visibility = 'hidden';
        }
    }, 200);
}

// Karşı tarafın görüşmeden ayrıldığını işleme
function handleLeaveCall() {
    console.log("Remote peer left the call without ending it");
    
    // Eğer mesaj zaten gösterilmişse, tekrar mesaj eklemesin
    const wasCallInProgress = chatApp.callInProgress;
    
    // Sistem mesajını göster
    if (wasCallInProgress && !callEndMessageShown) {
        console.log("Adding peer left call message");
        appendSystemMessage("Karşı taraf görüşmeden ayrıldı ama görüşme devam ediyor.");
        callEndMessageShown = true;
        
        // Sonraki görüşme için flag'i 5 saniye sonra sıfırla
        setTimeout(() => {
            callEndMessageShown = false;
        }, 5000);
    }
}

// Utility functions for the chat UI
function appendMessage(userId, message) {
    const messagesList = document.getElementById("messagesList");
    if (!messagesList) return;
    
    const messageElement = document.createElement("div");
    messageElement.className = userId === connectionIdentifier ? "message message-outgoing" : "message message-incoming";
    
    const userSpan = document.createElement("span");
    userSpan.className = "user-id";
    userSpan.textContent = userId === connectionIdentifier ? "You" : userId;
    
    const textSpan = document.createElement("span");
    textSpan.className = "message-text";
    textSpan.textContent = message;
    
    messageElement.appendChild(userSpan);
    messageElement.appendChild(textSpan);
    messagesList.appendChild(messageElement);
    
    // Scroll to bottom
    messagesList.scrollTop = messagesList.scrollHeight;
}

function appendSystemMessage(message, isError = false) {
    const messagesList = document.getElementById("messagesList");
    if (!messagesList) {
        console.error("messagesList element not found");
        return;
    }
    
    // Handle multiline messages
    const lines = message.split('\n');
    
    const messageElement = document.createElement("div");
    messageElement.className = isError 
        ? "message message-system message-error" 
        : "message message-system";
    
    if (lines.length === 1) {
        // Single line message
        messageElement.textContent = message;
    } else {
        // Multi-line message
        for (let i = 0; i < lines.length; i++) {
            const line = document.createElement("div");
            line.textContent = lines[i];
            messageElement.appendChild(line);
            
            // Add space between lines except for the last line
            if (i < lines.length - 1) {
                const spacer = document.createElement("br");
                messageElement.appendChild(spacer);
            }
        }
    }
    
    messagesList.appendChild(messageElement);
    
    // Scroll to bottom
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Export functions
window.chatApp = {
    initChatValues,
    initializeWebSocket,
    initSignalRConnection,
    // Image processing settings
    imageProcessingSettings: imageProcessingSettings,
    
    // Dosya gönderme fonksiyonu
    sendFile: async (file) => {
        // Durumu takip etmek için adımlar ekleyelim
        console.log("sendFile fonksiyonu başlatıldı");
        
        if (!connection) {
            console.error("Dosya gönderilemedi: Bağlantı yok veya null:", connection);
            appendSystemMessage("Dosya gönderilemedi: Bağlantı yok.", true);
            return false;
        }
        
        // Bağlantı durumunu kontrol et ve gerekiyorsa yeniden bağlan
        if (connection.state !== "Connected") {
            console.warn("SignalR bağlantısı hazır değil, durum:", connection.state);
            appendSystemMessage("Bağlantı yeniden kuruluyor, lütfen bekleyin...");
            
            try {
                // 5 saniye bekleyerek bağlantı kurulmaya çalışılıyor mu kontrol et
                let reconnectAttempt = 0;
                const maxAttempts = 3;
                
                while (connection.state !== "Connected" && reconnectAttempt < maxAttempts) {
                    reconnectAttempt++;
                    console.log(`Bağlantı yeniden kurulmayı bekliyor (${reconnectAttempt}/${maxAttempts})...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Hala bağlı değilse ve son deneme değilse, açıkça bağlantıyı yeniden başlat
                    if (connection.state !== "Connected" && reconnectAttempt < maxAttempts) {
                        try {
                            console.log("Bağlantı yeniden başlatılıyor...");
                            await connection.stop();
                            await connection.start();
                        } catch (error) {
                            console.error("Bağlantı yeniden başlatma hatası:", error);
                        }
                    }
                }
                
                if (connection.state !== "Connected") {
                    throw new Error(`Bağlantı kurulamadı, durum: ${connection.state}`);
                }
                
                console.log("Bağlantı başarıyla kuruldu, dosya göndermeye devam ediliyor...");
                appendSystemMessage("Bağlantı hazır, dosya göndermeye devam ediliyor...");
            } catch (connectionError) {
                console.error("Bağlantı yeniden kurulurken hata:", connectionError);
                appendSystemMessage("Bağlantı kurulamadı, dosya gönderilemedi.", true);
                return false;
            }
        }
        
        if (!file) {
            console.error("Dosya gönderilemedi: Dosya objesi null veya undefined");
            return false;
        }
        
        try {
            console.log("Gönderilecek dosya bilgileri:", {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: new Date(file.lastModified).toISOString()
            });
            
            // Connection durumunu kontrol et
            console.log("SignalR bağlantı durumu:", connection.state);
            
            // Dosya boyutu kontrolü
            const maxFileSize = 10 * 1024 * 1024; // 10MB sınırı
            if (file.size > maxFileSize) {
                appendSystemMessage(`Dosya çok büyük. Maksimum dosya boyutu: ${maxFileSize / (1024 * 1024)}MB`, true);
                return false;
            }
            
            // Dosya verisini okuma
            console.log("Dosya okuma işlemi başlatılıyor...");
            const fileReader = new FileReader();
            
            // FileReader'ın dosyayı okumasını bekleyen promise
            const fileDataPromise = new Promise((resolve, reject) => {
                fileReader.onload = (e) => {
                    console.log("Dosya başarıyla okundu, veri uzunluğu:", e.target.result.length);
                    resolve(e.target.result);
                };
                fileReader.onerror = (e) => {
                    console.error("Dosya okuma hatası:", e);
                    reject(new Error("Dosya okuma hatası: " + (e.target.error ? e.target.error.message : "Bilinmeyen hata")));
                };
                
                // Dosya türüne göre okuma metodu seçimi
                try {
                    if (file.type.startsWith('text/')) {
                        console.log("Metin dosyası, readAsText kullanılıyor");
                        fileReader.readAsText(file);
                    } else {
                        console.log("İkili dosya, readAsDataURL kullanılıyor");
                        fileReader.readAsDataURL(file); // Base64 formatında oku
                    }
                } catch (readError) {
                    console.error("Dosya okuma başlatılırken hata:", readError);
                    reject(readError);
                }
            });
            
            // Dosya verisini bekle
            console.log("Dosya verisi okunuyor, bekleniyor...");
            let fileData;
            try {
                fileData = await fileDataPromise;
                console.log("Dosya verisi alındı, uzunluk:", fileData.length);
                
                if (!fileData || fileData.length === 0) {
                    throw new Error("Dosya verisi boş");
                }
            } catch (readError) {
                console.error("Dosya verisi okunamadı:", readError);
                appendSystemMessage("Dosya okunamadı: " + readError.message, true);
                return false;
            }
            
            // Dosya bilgilerini JSON formatında hazırla
            const fileInfo = {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified,
                data: fileData
            };
            
            // Dosya bilgilerini şifrele
            console.log("Dosya verisi şifreleniyor...");
            const encryptionKey = chatApp.getEncryptionKey();
            console.log("Şifreleme anahtarı (ilk 5 karakter):", encryptionKey.substring(0, 5) + "...");
            
            let encryptedFileInfo;
            try {
                encryptedFileInfo = CryptoJS.AES.encrypt(
                    JSON.stringify(fileInfo),
                    encryptionKey,
                    {
                        keySize: 256 / 32,
                        mode: CryptoJS.mode.CBC,
                        padding: CryptoJS.pad.Pkcs7
                    }
                ).toString();
                
                console.log("Dosya verisi şifrelendi, şifreli veri uzunluğu:", encryptedFileInfo.length);
                
                if (!encryptedFileInfo || encryptedFileInfo.length === 0) {
                    throw new Error("Şifreleme işlemi başarısız oldu");
                }
            } catch (encryptError) {
                console.error("Dosya şifreleme hatası:", encryptError);
                appendSystemMessage("Dosya şifrelenirken hata oluştu: " + encryptError.message, true);
                return false;
            }
            
            // Gönderme işlemi başladı mesajı
            appendSystemMessage(`"${file.name}" dosyası gönderiliyor...`);
            
            // Şifrelenmiş dosya bilgisini gönder
            console.log("SignalR ile dosya gönderiliyor...");
            
            let methodUsed = "unknown";
            
            try {
                // İlk önce yeni SendFile metodunu deneyelim
                console.log("SendFile metodu deneniyor...");
                await connection.invoke("SendFile", connectionIdentifier, file.name, encryptedFileInfo);
                console.log("SendFile metodu başarıyla çağrıldı");
                methodUsed = "SendFile";
            } catch (sendError) {
                console.warn("SendFile metodu bulunamadı, alternatif metoda geçiliyor:", sendError);
                
                // SendFile metodu yoksa, alternatif olarak SendMessage metodunu kullanabiliriz
                try {
                    methodUsed = "SendMessage";
                    
                    // Dosya verisi çok büyük olabileceği için parçalama gerekebilir
                    if (encryptedFileInfo.length > 100000) {
                        console.log("Dosya büyük, parçalara bölünüyor...");
                        
                        // Parça sayısını hesapla
                        const partSize = 100000; // Her parçanın maksimum boyutu
                        const totalParts = Math.ceil(encryptedFileInfo.length / partSize);
                        console.log(`Dosya ${totalParts} parçaya bölünecek`);
                        
                        // Dosya için özel bir başlık oluştur
                        const fileHeader = JSON.stringify({
                            type: "file",
                            name: file.name,
                            size: file.size,
                            fileType: file.type,
                            parts: totalParts
                        });
                        
                        // Dosya başlığı gönder
                        await connection.invoke("SendMessage", connectionIdentifier, "", "",
                            CryptoJS.AES.encrypt(fileHeader, encryptionKey, {
                                keySize: 256 / 32,
                                mode: CryptoJS.mode.CBC,
                                padding: CryptoJS.pad.Pkcs7
                            }).toString()
                        );
                        
                        console.log("Dosya başlığı gönderildi, parçalar gönderiliyor...");
                        
                        // Tüm kullanıcılara ilerleyişi göster
                        appendSystemMessage(`Dosya gönderiliyor: 0/${totalParts} parça`);
                        
                        // Dosyayı parçalara böl ve gönder
                        for (let i = 0; i < totalParts; i++) {
                            const chunk = encryptedFileInfo.substring(i * partSize, (i + 1) * partSize);
                            
                            // Dosya parçası bilgisini gönder
                            const chunkInfo = JSON.stringify({
                                type: "file_chunk",
                                name: file.name,
                                part: i + 1,
                                data: chunk
                            });
                            
                            await connection.invoke("SendMessage", connectionIdentifier, "", "",
                                CryptoJS.AES.encrypt(chunkInfo, encryptionKey, {
                                    keySize: 256 / 32,
                                    mode: CryptoJS.mode.CBC,
                                    padding: CryptoJS.pad.Pkcs7
                                }).toString()
                            );
                            
                            console.log(`Dosya parçası ${i+1}/${totalParts} gönderildi`);
                            
                            // Her 3 parçada bir ilerleme mesajı göster
                            if ((i+1) % 3 === 0 || i+1 === totalParts) {
                                appendSystemMessage(`Dosya gönderiliyor: ${i+1}/${totalParts} parça`);
                            }
                            
                            // Küçük bir gecikme ekleyerek sunucuya nefes aldır
                            if (i < totalParts - 1) {
                                await new Promise(resolve => setTimeout(resolve, 50));
                            }
                        }
                        
                        // Dosyanın tamamlandığını bildiren mesaj
                        const fileFooter = JSON.stringify({
                            type: "file_complete",
                            name: file.name
                        });
                        
                        await connection.invoke("SendMessage", connectionIdentifier, "", "",
                            CryptoJS.AES.encrypt(fileFooter, encryptionKey, {
                                keySize: 256 / 32,
                                mode: CryptoJS.mode.CBC,
                                padding: CryptoJS.pad.Pkcs7
                            }).toString()
                        );
                        
                        console.log("Dosya gönderimi tamamlandı mesajı gönderildi");
                    } else {
                        // Küçük dosyayı tek seferde gönder
                        console.log("Dosya küçük, tek seferde gönderiliyor...");
                        const fileMessage = JSON.stringify({
                            type: "file_single",
                            fileInfo: encryptedFileInfo
                        });
                        
                        await connection.invoke("SendMessage", connectionIdentifier, "", "",
                            CryptoJS.AES.encrypt(fileMessage, encryptionKey, {
                                keySize: 256 / 32,
                                mode: CryptoJS.mode.CBC,
                                padding: CryptoJS.pad.Pkcs7
                            }).toString()
                        );
                        
                        console.log("Tek parça dosya başarıyla gönderildi");
                    }
                } catch (alternativeError) {
                    console.error("Alternatif dosya gönderme metodu da başarısız oldu:", alternativeError);
                    appendSystemMessage("Dosya gönderme işlemi başarısız oldu: " + alternativeError.message, true);
                    return false;
                }
            }
            
            // Başarılı mesajı
            console.log(`Dosya başarıyla gönderildi (${methodUsed} metodu kullanıldı)`);
            appendSystemMessage(`"${file.name}" dosyası başarıyla gönderildi.`);
            return true;
        } catch (error) {
            console.error("Error sending file:", error);
            appendSystemMessage("Dosya gönderilemedi: " + error.message, true);
            return false;
        }
    },
    
    sendMessage: async (message) => {
        if (!connection) return;
        
        try {
            // Güçlendirilmiş şifreleme - AES-256 kullanılarak
            const encryptionKey = chatApp.getEncryptionKey();
            const encryptedMessage = CryptoJS.AES.encrypt(
                message, 
                encryptionKey,
                {
                    keySize: 256 / 32,
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                }
            ).toString();
            
            // Sadece şifrelenmiş mesajı gönder, açık metni gönderme
            await connection.invoke("SendMessage", connectionIdentifier, "", "", encryptedMessage);
            
            // Append to UI
            appendMessage(connectionIdentifier, message);
            
            return true;
        } catch (error) {
            console.error("Error sending message:", error);
            appendSystemMessage("Mesaj gönderilemedi: " + error.message, true);
            return false;
        }
    },
    startVideoCall: async () => {
        // Kullanıcıya görüşme başlatmak istediğinden emin olalım
        if (confirm("Görüntülü arama başlatmak istediğinizden emin misiniz?")) {
            console.log("Starting video call...");
            
            // Video görüşmesini başlat
            return chatApp.startCall();
        }
        return false;
    },
    endVideoCall: async () => {
        console.log("Ending video call...");
        
        // Görüşme sonlandırılmadan önce butonları gizle
        try {
            const quickEndCallButton = document.getElementById('quickEndCallButton');
            const leaveCallButton = document.getElementById('leaveCallButton');
            
            if (quickEndCallButton) {
                quickEndCallButton.style.display = 'none';
                quickEndCallButton.style.opacity = '0';
                quickEndCallButton.style.visibility = 'hidden';
            }
            
            if (leaveCallButton) {
                leaveCallButton.style.display = 'none';
                leaveCallButton.style.opacity = '0';
                leaveCallButton.style.visibility = 'hidden';
            }
            
            // Kesinlikle butonların gizlendiğinden emin olmak için bir timeout ekle
            setTimeout(() => {
                if (quickEndCallButton) {
                    quickEndCallButton.style.display = 'none';
                    quickEndCallButton.style.visibility = 'hidden';
                }
                if (leaveCallButton) {
                    leaveCallButton.style.display = 'none';
                    leaveCallButton.style.visibility = 'hidden';
                }
            }, 200);
        } catch (err) {
            console.error("Error hiding buttons:", err);
        }
        
        // Call sonlandırma sonucunu döndür
        return chatApp.endCall();
    },
    // Yeni eklenen fonksiyon: Sadece kullanıcının kendisini görüşmeden çıkarma
    leaveCall: function() {
        try {
            console.log("Leaving call without ending it for the other participant...");
            
            // Görüşmeden ayrıldığını karşı tarafa bildir
            if (connection) {
                connection.invoke("SendLeaveCall", "")
                    .then(() => console.log("Leave call signal sent successfully"))
                    .catch(err => console.error("Error sending leave call signal:", err));
            }
            
            // Stop local stream
            if (this.localStream) {
                console.log("Stopping local stream tracks");
                this.localStream.getTracks().forEach(track => {
                    console.log(`Stopping track: ${track.kind}`);
                    track.stop();
                });
                this.localStream = null;
            }
            
            // Close peer connection but keep the connection object alive for the other party
            if (this.peerConnection) {
                console.log("Closing local peer connection");
                this.peerConnection.ontrack = null;
                this.peerConnection.onicecandidate = null;
                this.peerConnection.close();
                this.peerConnection = null;
            }
            
            // Reset call status but don't send ending signal
            this.callInProgress = false;
            
            // Hide videos and reset video elements
            const localVideo = document.getElementById('localVideo');
            const remoteVideo = document.getElementById('remoteVideo');
            const localVideoContainer = document.getElementById('localVideoContainer');
            const callStatus = document.getElementById('callStatus');
            const quickEndCallButton = document.getElementById('quickEndCallButton');
            const leaveCallButton = document.getElementById('leaveCallButton');
            
            if (localVideo) {
                console.log("Resetting local video");
                localVideo.srcObject = null;
                localVideo.style.display = 'none';
            }
            
            if (remoteVideo) {
                console.log("Resetting remote video");
                remoteVideo.srcObject = null;
            }
            
            if (localVideoContainer) {
                console.log("Hiding local video container");
                localVideoContainer.style.display = 'none';
            }
            
            // Kesinlikle butonların gizlendiğinden emin olmak için bir timeout ekle
            setTimeout(() => {
                if (quickEndCallButton) {
                    quickEndCallButton.style.display = 'none';
                    quickEndCallButton.style.visibility = 'hidden';
                }
                if (leaveCallButton) {
                    leaveCallButton.style.display = 'none';
                    leaveCallButton.style.visibility = 'hidden';
                }
            }, 200);
            
            // Sistem mesajını göster
            if (!callEndMessageShown) {
                console.log("Showing left call message");
                appendSystemMessage("Görüntülü görüşmeden ayrıldınız.");
                callEndMessageShown = true;
                
                // Sonraki görüşme için flag'i 5 saniye sonra sıfırla
                setTimeout(() => {
                    callEndMessageShown = false;
                }, 5000);
            }
            
            return true;
        } catch (error) {
            console.error("Error leaving call:", error);
            // Hata olsa bile butonları gizle
            try {
                document.getElementById('quickEndCallButton').style.display = 'none';
                document.getElementById('quickEndCallButton').style.visibility = 'hidden';
                document.getElementById('leaveCallButton').style.display = 'none';
                document.getElementById('leaveCallButton').style.visibility = 'hidden';
                document.getElementById('localVideoContainer').style.display = 'none';
            } catch (e) {
                console.error("Error hiding elements:", e);
            }
            return false;
        }
    },
    // WebRTC functions
    isWebRTCSupported: () => {
        return navigator.mediaDevices && 
               window.RTCPeerConnection && 
               window.RTCSessionDescription;
    },
    
    // WebRTC variables
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    callInProgress: false,
    
    // WebRTC configuration
    rtcConfig: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ],
        // Güvenlik iyileştirmeleri
        iceTransportPolicy: 'all',
        rtcpMuxPolicy: 'require',
        bundlePolicy: 'max-bundle',
        // DTLS şifreleme zorunlu
        requireDtlsSrtp: true
    },
    
    // Initialize video call feature
    initializeCall: async function() {
        try {
            if (!this.isWebRTCSupported()) {
                throw new Error("WebRTC is not supported in this browser");
            }
            
            // Create peer connection
            this.peerConnection = new RTCPeerConnection(this.rtcConfig);
            
            // Get local media stream
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            
            // Display local video
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
                localVideo.style.display = 'block';
            }
            
            // Show the local video container
            const localVideoContainer = document.getElementById('localVideoContainer');
            if (localVideoContainer) {
                localVideoContainer.style.display = 'block';
            }

            // Show the quick end call button and leave call button
            const quickEndCallButton = document.getElementById('quickEndCallButton');
            const leaveCallButton = document.getElementById('leaveCallButton');
            
            if (quickEndCallButton) {
                quickEndCallButton.style.display = 'flex';
                quickEndCallButton.style.opacity = '1';
                quickEndCallButton.style.visibility = 'visible';
            }
            
            if (leaveCallButton) {
                leaveCallButton.style.display = 'flex';
                leaveCallButton.style.opacity = '1';
                leaveCallButton.style.visibility = 'visible';
            }
            
            // Butonların görünürlüğünü garantilemek için bir timeout ekleyelim
            setTimeout(() => {
                if (quickEndCallButton) {
                    quickEndCallButton.style.display = 'flex';
                    quickEndCallButton.style.opacity = '1';
                    quickEndCallButton.style.visibility = 'visible';
                }
                
                if (leaveCallButton) {
                    leaveCallButton.style.display = 'flex';
                    leaveCallButton.style.opacity = '1';
                    leaveCallButton.style.visibility = 'visible';
                }
            }, 500);
            
            // Başlangıçta sadece ses kanalı ekle, görüntü kanalını işlenmiş video için saklayacağız
            this.localStream.getAudioTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            
            // İşlenmiş video için Canvas + CaptureStream yöntemini kullan
            captureAndProcess();
            
            // Canvas'ı stream'e dönüştür ve video kanalı olarak ekle
            const localProcessedCanvas = document.getElementById('localProcessedCanvas');
            if (localProcessedCanvas) {
                // Bazı tarayıcılar için farklı captureStream metotları var
                const captureStreamMethod = localProcessedCanvas.captureStream || 
                                            localProcessedCanvas.mozCaptureStream ||
                                            localProcessedCanvas.webkitCaptureStream;
                                            
                if (captureStreamMethod) {
                    // Canvas'tan bir medya akışı oluştur (genellikle 30fps)
                    const processedStream = captureStreamMethod.call(localProcessedCanvas, 30);
                    
                    // İşlenmiş video akışını WebRTC bağlantısına ekle
                    processedStream.getVideoTracks().forEach(track => {
                        console.log("İşlenmiş video kanalı WebRTC bağlantısına ekleniyor");
                        this.peerConnection.addTrack(track, processedStream);
                    });
                } else {
                    console.warn("Bu tarayıcı canvas.captureStream() desteklemiyor, işlenmemiş video gönderilecek");
                    
                    // Desteklenmeyen tarayıcılarda orijinal video akışını kullan
                    this.localStream.getVideoTracks().forEach(track => {
                        this.peerConnection.addTrack(track, this.localStream);
                    });
                }
            } else {
                console.warn("localProcessedCanvas bulunamadı, işlenmemiş video gönderilecek");
                
                // Canvas yoksa orijinal video akışını kullan
                this.localStream.getVideoTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });
            }
            
            // Set up remote stream handler
            this.peerConnection.ontrack = (event) => {
                console.log("Received remote track:", event.track.kind);
                
                // RemoteStream'i güvenli bir şekilde ayarla veya güncelle
                if (!this.remoteStream) {
                    this.remoteStream = new MediaStream();
                }
                
                // Gelen track'i remoteStream'e ekle
                event.streams.forEach(stream => {
                    // Tüm track'leri ekle
                    stream.getTracks().forEach(track => {
                        console.log(`Uzak track ekleniyor: ${track.kind}, ID: ${track.id}`);
                        
                        // Diğer ses kanallarını kontrol et
                        if (track.kind === 'audio') {
                            console.log(`Ses kanalı durumu: ${track.enabled ? 'Açık' : 'Kapalı'}, ${track.readyState}`);
                            
                            // Ses kanalını etkinleştir
                            if (!track.enabled) {
                                track.enabled = true;
                                console.log("Ses kanalı etkinleştirildi");
                            }
                        }
                        
                        // RemoteStream'e ekle
                        this.remoteStream.addTrack(track);
                    });
                });
                
                // Tüm video elementlerine remoteStream'i bağla
                ['remoteVideo', 'remoteVideoInline', 'remoteVideoFullscreen'].forEach(id => {
                    const videoElement = document.getElementById(id);
                    if (videoElement) {
                        console.log(`${id} elementine remoteStream bağlanıyor`);
                        videoElement.srcObject = this.remoteStream;
                        
                        // Ses seviyesini kontrol et
                        if (videoElement.volume < 0.8) {
                            console.log(`${id} ses seviyesi artırılıyor`);
                            videoElement.volume = 1.0;
                        }
                        
                        // Sessiz modunu kapat
                        if (videoElement.muted) {
                            console.log(`${id} sessiz modu kapatılıyor`);
                            videoElement.muted = false;
                        }
                        
                        // Videoyu oynatmaya çalış
                        if (videoElement.paused) {
                            videoElement.play().catch(e => {
                                console.warn(`${id} otomatik oynatma hatası:`, e);
                            });
                        }
                        
                        videoElement.style.display = 'block';
                    }
                });
                
                // Ses kanalları varsa bilgi ver
                const audioTracks = this.remoteStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    console.log(`Toplam ${audioTracks.length} ses kanalı mevcut`);
                    appendSystemMessage("Karşı tarafla sesli bağlantı kuruldu.");
                } else {
                    console.warn("Karşı taraftan ses kanalı alınamadı!");
                    appendSystemMessage("Karşı taraftan ses kanalı alınamadı, tarayıcı izinleri kontrol edilmeli.", true);
                }
                
                // Bağlantı başarılı mesajı göster
                appendSystemMessage("Görüntülü görüşme bağlantısı kuruldu.");
            };
            
            // Set up ICE candidate handler
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    // Send the ICE candidate to the remote peer
                    connection.invoke("SendIceCandidate", JSON.stringify(event.candidate), "")
                        .catch(err => console.error("Error sending ICE candidate:", err));
                }
            };
            
            this.callInProgress = true;
            return true;
        } catch (error) {
            console.error("Error initializing call:", error);
            appendSystemMessage("Video görüşmesi başlatılamadı: " + error.message, true);
            this.endCall();
            return false;
        }
    },
    
    // Güvenli şifreleme için şifre normalleştirme fonksiyonu
    // Bu fonksiyon, boş veya null şifreleri kontrol eder ve varsayılan bir şifre uygular
    getEncryptionKey: function() {
        // Şifre yoksa veya boşsa ve davet kodu kullanılıyorsa, davet kodunu kullan
        if ((!sharedPassword || sharedPassword.trim().length === 0) && joinWithInviteCode && inviteCode) {
            console.log("Using invite code as encryption key");
            return inviteCode;
        }
        
        // Şifre varsa kullan
        if (sharedPassword && sharedPassword.trim().length > 0) {
            return sharedPassword;
        }
        
        // Son çare - varsayılan bir şifre oluştur (güvenli değil ama en azından çökmez)
        console.warn("No password or invite code available, using fallback encryption");
        return "fallback_encryption_key_" + connectionIdentifier + "_" + new Date().toISOString().slice(0, 10);
    },
    
    // Start outgoing call
    startCall: async function() {
        try {
            const success = await this.initializeCall();
            if (!success) return false;
            
            // Kırmızı butonu görünür yap ve onclick olayını ayarla
            const quickEndCallButton = document.getElementById('quickEndCallButton');
            if (quickEndCallButton) {
                quickEndCallButton.style.display = 'flex';
                quickEndCallButton.style.opacity = '1';
                quickEndCallButton.style.visibility = 'visible';
                
                // Butonun onclick olayını doğrudan ayarla (güvenlik için)
                quickEndCallButton.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.endCall();
                    quickEndCallButton.style.display = 'none';
                };
            }
            
            // Create offer
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            // Set local description
            await this.peerConnection.setLocalDescription(offer);
            
            // Send the offer to the remote peer
            await connection.invoke("SendVideoCallOffer", JSON.stringify(offer), "");
            
            // Update call status
            const callStatus = document.getElementById('callStatus');
            if (callStatus) {
                callStatus.textContent = 'Aranıyor...';
                callStatus.classList.remove('d-none');
            }
            
            return true;
        } catch (error) {
            console.error("Error starting call:", error);
            appendSystemMessage("Arama başlatılamadı: " + error.message);
            this.endCall();
            return false;
        }
    },
    
    // Accept incoming call
    acceptIncomingCall: async function(offerJson) {
        try {
            const success = await this.initializeCall();
            if (!success) return false;
            
            // Kırmızı butonu görünür yap ve onclick olayını ayarla
            const quickEndCallButton = document.getElementById('quickEndCallButton');
            if (quickEndCallButton) {
                quickEndCallButton.style.display = 'flex';
                quickEndCallButton.style.opacity = '1';
                quickEndCallButton.style.visibility = 'visible';
                
                // Butonun onclick olayını doğrudan ayarla (güvenlik için)
                quickEndCallButton.onclick = (e) => {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    this.endCall();
                    quickEndCallButton.style.display = 'none';
                };
            }
            
            // Parse offer
            const offer = JSON.parse(offerJson);
            
            // Set remote description
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            // Create answer
            const answer = await this.peerConnection.createAnswer();
            
            // Set local description
            await this.peerConnection.setLocalDescription(answer);
            
            // Send the answer to the remote peer
            await connection.invoke("SendVideoCallAnswer", JSON.stringify(answer), "");
            
            // Update call status
            const callStatus = document.getElementById('callStatus');
            if (callStatus) {
                callStatus.textContent = 'Görüşme başladı';
                callStatus.classList.remove('d-none');
            }
            
            return true;
        } catch (error) {
            console.error("Error accepting call:", error);
            appendSystemMessage("Arama kabul edilemedi: " + error.message);
            this.endCall();
            return false;
        }
    },
    
    // Handle incoming call answer
    handleCallAnswer: async function(answerJson) {
        try {
            if (!this.peerConnection) {
                throw new Error("No active call to handle answer");
            }
            
            // Parse answer
            const answer = JSON.parse(answerJson);
            
            // Set remote description
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            
            // Update call status
            const callStatus = document.getElementById('callStatus');
            if (callStatus) {
                callStatus.textContent = 'Görüşme başladı';
                callStatus.classList.remove('d-none');
            }
            
            return true;
        } catch (error) {
            console.error("Error handling call answer:", error);
            this.endCall();
            return false;
        }
    },
    
    // Add ICE candidate
    addIceCandidate: async function(candidateJson) {
        try {
            if (!this.peerConnection) {
                throw new Error("No active call to add ICE candidate");
            }
            
            // Parse candidate
            const candidate = JSON.parse(candidateJson);
            
            // Add candidate
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            
            return true;
        } catch (error) {
            console.error("Error adding ICE candidate:", error);
            return false;
        }
    },
    
    // End call
    endCall: function() {
        try {
            console.log("Ending call...");
            
            // Eğer çağrı zaten sonlandırılıyorsa, tekrar işlem yapma
            if (!this.callInProgress) {
                console.log("Call already ended, skipping");
                
                // Hala görünür olabilecek butonları gizle
                try {
                    const quickEndCallButton = document.getElementById('quickEndCallButton');
                    const leaveCallButton = document.getElementById('leaveCallButton');
                    
                    if (quickEndCallButton) {
                        quickEndCallButton.style.display = 'none';
                        quickEndCallButton.style.opacity = '0';
                        quickEndCallButton.style.visibility = 'hidden';
                    }
                    
                    if (leaveCallButton) {
                        leaveCallButton.style.display = 'none';
                        leaveCallButton.style.opacity = '0';
                        leaveCallButton.style.visibility = 'hidden';
                    }
                    
                    // Kesinlikle butonların gizlendiğinden emin olmak için bir timeout ekle
                    setTimeout(() => {
                        if (quickEndCallButton) {
                            quickEndCallButton.style.display = 'none';
                            quickEndCallButton.style.visibility = 'hidden';
                        }
                        if (leaveCallButton) {
                            leaveCallButton.style.display = 'none';
                            leaveCallButton.style.visibility = 'hidden';
                        }
                    }, 200);
                } catch (err) {
                    console.error("Error hiding buttons:", err);
                }
                
                return true;
            }
            
            // Signalr üzerinden karşı tarafa arama sonlandırma mesajı gönder
            if (connection) {
                connection.invoke("SendCallEnded", "")
                    .then(() => console.log("Call end signal sent successfully"))
                    .catch(err => console.error("Error sending call end signal:", err));
            }
            
            // Close peer connection
            if (this.peerConnection) {
                console.log("Closing peer connection");
                this.peerConnection.ontrack = null;
                this.peerConnection.onicecandidate = null;
                this.peerConnection.close();
                this.peerConnection = null;
            }
            
            // Stop local stream
            if (this.localStream) {
                console.log("Stopping local stream tracks");
                this.localStream.getTracks().forEach(track => {
                    console.log(`Stopping track: ${track.kind}`);
                    track.stop();
                });
                this.localStream = null;
            }
            
            // Reset remote stream
            if (this.remoteStream) {
                console.log("Resetting remote stream");
                this.remoteStream.getTracks().forEach(track => {
                    track.enabled = false;
                });
                this.remoteStream = null;
            }
            
            // Reset call status
            this.callInProgress = false;
            
            // Hide videos and reset video elements
            const localVideo = document.getElementById('localVideo');
            const remoteVideo = document.getElementById('remoteVideo');
            const localVideoContainer = document.getElementById('localVideoContainer');
            const callStatus = document.getElementById('callStatus');
            const quickEndCallButton = document.getElementById('quickEndCallButton');
            
            if (localVideo) {
                console.log("Resetting local video");
                localVideo.srcObject = null;
                localVideo.style.display = 'none';
            }
            
            if (remoteVideo) {
                console.log("Resetting remote video");
                remoteVideo.srcObject = null;
            }
            
            if (localVideoContainer) {
                console.log("Hiding local video container");
                localVideoContainer.style.display = 'none';
            }
            
            if (callStatus) {
                console.log("Resetting call status");
                callStatus.textContent = '';
                callStatus.classList.add('d-none');
            }

            if (quickEndCallButton) {
                console.log("Hiding quick end call button");
                quickEndCallButton.style.display = 'none';
                quickEndCallButton.style.opacity = '0';
                quickEndCallButton.style.visibility = 'hidden';
            }
            
            // Sistem mesajını sadece bir kez göster
            if (!callEndMessageShown) {
                console.log("Showing call ended message");
                appendSystemMessage("Görüntülü görüşme sonlandırıldı.");
                callEndMessageShown = true;
                
                // Sonraki görüşme için flag'i 5 saniye sonra sıfırla
                setTimeout(() => {
                    callEndMessageShown = false;
                }, 5000);
            } else {
                console.log("Call ended message already shown, skipping");
            }
            
            return true;
        } catch (error) {
            console.error("Error ending call:", error);
            // Hata olsa bile butonları gizle
            try {
                document.getElementById('quickEndCallButton').style.display = 'none';
                document.getElementById('quickEndCallButton').style.visibility = 'hidden';
                document.getElementById('leaveCallButton').style.display = 'none';
                document.getElementById('leaveCallButton').style.visibility = 'hidden';
                document.getElementById('localVideoContainer').style.display = 'none';
            } catch (e) {
                console.error("Error hiding elements:", e);
            }
            return false;
        }
    }
};

// Set up UI event handlers
function setupUIEventHandlers() {
    // Send message button
    document.getElementById('sendButton').addEventListener('click', function() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (message) {
            chatApp.sendMessage(message).then(success => {
                if (success) {
                    messageInput.value = '';
                    messageInput.focus();
                } else {
                    // Message sending failed, show an error
                    appendSystemMessage("Mesaj gönderilemedi. Bağlantınızı kontrol edin.");
                }
            }).catch(error => {
                console.error("Error sending message:", error);
                appendSystemMessage("Mesaj gönderilirken hata oluştu.");
            });
        }
    });
    
    // Message input enter key
    document.getElementById('messageInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('sendButton').click();
        }
    });
    
    // Dosya gönderme butonu
    const setupFileUpload = () => {
        const fileButton = document.getElementById('fileButton');
        if (fileButton) {
            console.log("Dosya butonu event listener'ı ayarlanıyor");
            
            // Mevcut olay dinleyicileri temizle
            const newFileButton = fileButton.cloneNode(true);
            fileButton.parentNode.replaceChild(newFileButton, fileButton);
            
            // Yeni olay dinleyicisi ekle
            newFileButton.addEventListener('click', function(e) {
                e.preventDefault(); // Formun gönderilmesini engelle
                console.log("Dosya butonu tıklandı");
                
                // Gizli dosya seçme input'unu tetikle
                const fileInput = document.getElementById('fileInput');
                if (fileInput) {
                    fileInput.click();
                } else {
                    console.error("fileInput bulunamadı!");
                    appendSystemMessage("Dosya seçme alanı bulunamadı. Sayfayı yenileyin.", true);
                }
            });
        } else {
            console.warn("fileButton bulunamadı, dinamik olarak oluşturulacak");
            // Buton yoksa, dosya elementi oluşturmayı dene
            ensureFileInputElementsExist();
            
            // Oluşturulduktan sonra bir daha dene
            setTimeout(setupFileUpload, 500);
        }
    };
    
    // Dosya gönderme butonunu kur
    setupFileUpload();
    
    // Dosya seçme input'u değiştiğinde
    const setupFileInput = () => {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            console.log("Dosya input event listener'ı ayarlanıyor");
            
            // Mevcut olay dinleyicileri temizle
            const newFileInput = fileInput.cloneNode(true);
            fileInput.parentNode.replaceChild(newFileInput, fileInput);
            
            // Yeni olay dinleyicisi ekle
            newFileInput.addEventListener('change', function(e) {
                console.log("Dosya input değişikliği algılandı");
                
                if (e.target.files && e.target.files.length > 0) {
                    const file = e.target.files[0];
                    console.log("Dosya seçildi:", file.name, "Boyut:", file.size, "Tip:", file.type);
                    
                    // Bağlantı kontrolü
                    if (!connection) {
                        console.error("Dosya gönderilemedi: Bağlantı yok!");
                        appendSystemMessage("Dosya gönderilemedi: Sohbet bağlantısı kurulmamış.", true);
                        e.target.value = '';
                        return;
                    }
                    
                    // Bağlantı durumunu kontrol et
                    if (connection.state !== "Connected") {
                        console.error("Dosya gönderilemedi: Bağlantı durumu:", connection.state);
                        appendSystemMessage(`Dosya gönderilemedi: Bağlantı durumu uygun değil (${connection.state})`, true);
                        
                        // Bağlantıyı yeniden kurmayı dene
                        setTimeout(() => {
                            console.log("Bağlantıyı yeniden kurma denemesi");
                            // Açıkça bildir
                            appendSystemMessage("Bağlantıyı yeniden kurmaya çalışılıyor...");
                            
                            // Bağlantı fonksiyonunu kontrol et ve mevcut değerlerle çağır
                            if (typeof initSignalRConnection === 'function') {
                                initSignalRConnection().then(connected => {
                                    if (connected) {
                                        console.log("Bağlantı tekrar kuruldu, dosya gönderme yeniden deneniyor...");
                                        appendSystemMessage("Bağlantı yeniden kuruldu, dosya gönderiliyor...");
                                        
                                        // Yeniden gönderme işlemi
                                        chatApp.sendFile(file).finally(() => {
                                            e.target.value = '';
                                        });
                                    } else {
                                        console.error("Bağlantı yeniden kurulamadı");
                                        appendSystemMessage("Bağlantı yeniden kurulamadı, lütfen sayfayı yenileyip tekrar deneyin.", true);
                                        e.target.value = '';
                                    }
                                }).catch(err => {
                                    console.error("Bağlantı yeniden kurulurken hata:", err);
                                    appendSystemMessage("Bağlantı hatası: " + err.message, true);
                                    e.target.value = '';
                                });
                            } else {
                                console.error("initSignalRConnection fonksiyonu bulunamadı");
                                appendSystemMessage("Bağlantı yeniden kurulamadı: İşlev bulunamadı", true);
                                e.target.value = '';
                            }
                        }, 500);
                        return;
                    }
                    
                    // Dosya gönderme işlemi başlat
                    appendSystemMessage(`"${file.name}" dosyası odadaki herkese gönderilecek...`);
                    
                    setTimeout(() => {
                        chatApp.sendFile(file)
                            .then(success => {
                                if (success) {
                                    console.log("Dosya başarıyla gönderildi:", file.name);
                                } else {
                                    console.error("Dosya gönderme işlemi başarısız oldu");
                                    appendSystemMessage("Dosya gönderme işlemi başarısız oldu. Lütfen tekrar deneyin.", true);
                                }
                            })
                            .catch(err => {
                                console.error("Dosya gönderirken hata oluştu:", err);
                                appendSystemMessage("Dosya gönderilirken hata oluştu: " + err.message, true);
                            })
                            .finally(() => {
                                // İşlem bitince dosya seçme input'unu temizle
                                e.target.value = '';
                            });
                    }, 100);
                }
            });
        } else {
            console.warn("fileInput bulunamadı, dinamik olarak oluşturulacak");
            // Input yoksa, dosya elementi oluşturmayı dene
            ensureFileInputElementsExist();
            
            // Oluşturulduktan sonra bir daha dene
            setTimeout(setupFileInput, 500);
        }
    };
    
    // Dosya input'unu kur
    setupFileInput();
    
    // Video call button
    document.getElementById('videoCallButton').addEventListener('click', function() {
        chatApp.startVideoCall();
    });
    
    // Quick end call button
    const quickEndCallButton = document.getElementById('quickEndCallButton');
    if (quickEndCallButton) {
        // Hem click hem mousedown eventlerini ekleyelim
        quickEndCallButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("Quick end call button clicked");
            
            // Önce butonları gizle
            this.style.display = 'none';
            this.style.opacity = '0';
            this.style.visibility = 'hidden';
            
            // Gri butonu da gizle
            const leaveCallButton = document.getElementById('leaveCallButton');
            if (leaveCallButton) {
                leaveCallButton.style.display = 'none';
                leaveCallButton.style.opacity = '0';
                leaveCallButton.style.visibility = 'hidden';
            }
            
            // EndVideoCall yerine doğrudan endCall fonksiyonunu çağır
            chatApp.endCall();
        });
        
        quickEndCallButton.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("Quick end call button mousedown");
            
            // Önce butonları gizle
            this.style.display = 'none';
            this.style.opacity = '0';
            this.style.visibility = 'hidden';
            
            // Gri butonu da gizle
            const leaveCallButton = document.getElementById('leaveCallButton');
            if (leaveCallButton) {
                leaveCallButton.style.display = 'none';
                leaveCallButton.style.opacity = '0';
                leaveCallButton.style.visibility = 'hidden';
            }
            
            // EndVideoCall yerine doğrudan endCall fonksiyonunu çağır
            chatApp.endCall();
        });
    }
    
    // Leave call button (Gri buton - Sadece kendi tarafında görüşmeyi sonlandırır)
    const leaveCallButton = document.getElementById('leaveCallButton');
    if (leaveCallButton) {
        // Hem click hem mousedown eventlerini ekleyelim
        leaveCallButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("Leave call button clicked");
            
            // leaveCall fonksiyonunu çağır - sadece kendisi çıkar
            chatApp.leaveCall();
            
            // Butonun gizlenmesini kesinleştir
            this.style.display = 'none';
            this.style.visibility = 'hidden';
        });
        
        leaveCallButton.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log("Leave call button mousedown");
            
            // leaveCall fonksiyonunu çağır - sadece kendisi çıkar
            chatApp.leaveCall();
            
            // Butonun gizlenmesini kesinleştir
            this.style.display = 'none';
            this.style.visibility = 'hidden';
        });
    }
    
    // Inline end call button
    const endCallButtonInline = document.getElementById('endCallButtonInline');
    if (endCallButtonInline) {
        endCallButtonInline.addEventListener('click', function() {
            // Tüm butonları gizle - görüşme tamamen sonlandırılıyor
            try {
                const quickEndCallButton = document.getElementById('quickEndCallButton');
                const leaveCallButton = document.getElementById('leaveCallButton');
                
                if (quickEndCallButton) {
                    quickEndCallButton.style.display = 'none';
                    quickEndCallButton.style.opacity = '0';
                    quickEndCallButton.style.visibility = 'hidden';
                }
                
                if (leaveCallButton) {
                    leaveCallButton.style.display = 'none';
                    leaveCallButton.style.opacity = '0';
                    leaveCallButton.style.visibility = 'hidden';
                }
                
                // Kesinlikle butonların gizlendiğinden emin olmak için bir timeout ekle
                setTimeout(() => {
                    if (quickEndCallButton) {
                        quickEndCallButton.style.display = 'none';
                        quickEndCallButton.style.visibility = 'hidden';
                    }
                    if (leaveCallButton) {
                        leaveCallButton.style.display = 'none';
                        leaveCallButton.style.visibility = 'hidden';
                    }
                }, 200);
            } catch (err) {
                console.error("Error hiding buttons:", err);
            }
            
            chatApp.endVideoCall();
        });
    }
    
    // Toggle mic button
    // ... existing code ...
    
    // Local processing checkbox
    document.getElementById('useLocalProcessing').addEventListener('change', function(e) {
        const useLocalProcessing = e.target.checked;
        
        if (useLocalProcessing) {
            // Switch to local processing
            console.log("Switching to local processing");
        } else {
            // Switch to server processing
            console.log("Switching to server processing");
            chatApp.initializeWebSocket();
        }
    });
} 

// Alınan dosyaları işleme
function handleReceivedFile(userId, fileName, fileInfo) {
    try {
        console.log("Processing received file:", fileName, "from:", userId);
        
        // Dosya türüne göre işleme
        const fileType = fileInfo.type || '';
        const fileData = fileInfo.data || '';
        
        if (!fileData) {
            throw new Error("Dosya verisi eksik");
        }
        
        // Dosya alındı mesajı
        appendSystemMessage(`"${fileName}" dosyası alındı.`);
        
        // Mesaj listesine dosya bilgisi ekleyelim
        const messagesList = document.getElementById("messagesList");
        if (!messagesList) {
            console.error("messagesList element not found");
            return;
        }
        
        const messageElement = document.createElement("div");
        messageElement.className = "message message-file";
        
        const userSpan = document.createElement("span");
        userSpan.className = "user-id";
        userSpan.textContent = userId === connectionIdentifier ? "Sen" : userId;
        
        const fileContainer = document.createElement("div");
        fileContainer.className = "file-container";
        
        // Dosya ikonunu belirle
        let fileIcon = "📄"; // Default dosya ikonu
        if (fileType.startsWith("image/")) {
            fileIcon = "🖼️";
        } else if (fileType.startsWith("video/")) {
            fileIcon = "🎬";
        } else if (fileType.startsWith("audio/")) {
            fileIcon = "🎵";
        } else if (fileType.includes("pdf")) {
            fileIcon = "📑";
        } else if (fileType.includes("word") || fileType.includes("document")) {
            fileIcon = "📘";
        } else if (fileType.includes("excel") || fileType.includes("sheet")) {
            fileIcon = "📊";
        } else if (fileType.includes("zip") || fileType.includes("rar") || fileType.includes("compressed")) {
            fileIcon = "🗜️";
        }
        
        // Dosya boyutunu formatla
        const formatFileSize = (bytes) => {
            if (bytes < 1024) return bytes + " B";
            else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
            else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
            else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
        };
        
        // Dosya bilgisi ve indirme butonu
        fileContainer.innerHTML = `
            <div class="file-icon">${fileIcon}</div>
            <div class="file-info">
                <div class="file-name">${fileName}</div>
                <div class="file-size">${formatFileSize(fileInfo.size || 0)}</div>
            </div>
            <button class="file-download-btn">İndir</button>
        `;
        
        // İndirme butonu için olay dinleyicisi
        const downloadBtn = fileContainer.querySelector('.file-download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                // Dosyayı indir
                downloadFile(fileData, fileName, fileType);
            });
        }
        
        messageElement.appendChild(userSpan);
        messageElement.appendChild(fileContainer);
        messagesList.appendChild(messageElement);
        
        // Görüntüyse önizleme ekle
        if (fileType.startsWith("image/") && fileData) {
            const previewContainer = document.createElement("div");
            previewContainer.className = "image-preview";
            
            const imgElement = document.createElement("img");
            imgElement.src = fileData;
            imgElement.alt = fileName;
            imgElement.style.maxWidth = "200px";
            imgElement.style.maxHeight = "150px";
            imgElement.style.cursor = "pointer";
            
            // Resme tıklayınca tam boyutta açma
            imgElement.addEventListener('click', () => {
                const win = window.open("", "_blank");
                win.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${fileName}</title>
                        <style>
                            body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #1e1e1e; }
                            img { max-width: 95%; max-height: 95%; object-fit: contain; }
                        </style>
                    </head>
                    <body><img src="${fileData}" alt="${fileName}"></body>
                    </html>
                `);
            });
            
            previewContainer.appendChild(imgElement);
            messageElement.appendChild(previewContainer);
        }
        
        // Scroll to bottom
        messagesList.scrollTop = messagesList.scrollHeight;
    } catch (error) {
        console.error("Error handling received file:", error);
        appendSystemMessage("Alınan dosya işlenirken hata oluştu: " + error.message, true);
    }
}

// Dosya indirme fonksiyonu
function downloadFile(fileData, fileName, fileType) {
    try {
        // İndirilebilir link oluştur
        const a = document.createElement("a");
        a.href = fileData;
        a.download = fileName;
        a.style.display = "none";
        
        // Dökümanı link ekle ve tıkla
        document.body.appendChild(a);
        a.click();
        
        // Kaldır
        setTimeout(() => {
            document.body.removeChild(a);
        }, 100);
    } catch (error) {
        console.error("Error downloading file:", error);
        appendSystemMessage("Dosya indirme hatası: " + error.message, true);
    }
}