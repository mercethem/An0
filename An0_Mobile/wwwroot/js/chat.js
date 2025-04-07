// An0 Sohbet Uygulaması - Temel JavaScript

// Global değişkenler
let connection = null;
let connectionId = "";
let sharedPassword = "";
let roomName = "DefaultRoom";

// DOM yüklendikten sonra çalışacak olan başlangıç fonksiyonu
function initChat() {
    // DOM elementleri
    const chatMessages = document.getElementById("chatMessages");
    const messageInput = document.getElementById("messageInput");
    const sendButton = document.getElementById("sendButton");
    const connectionStatus = document.getElementById("connectionStatus");
    
    // Kullanıcı bilgilerini al
    connectionId = document.getElementById("userConnection").textContent;
    
    // SignalR bağlantısını oluştur
    connection = new signalR.HubConnectionBuilder()
        .withUrl("/chathub")
        .withAutomaticReconnect()
        .build();
    
    // SignalR olay dinleyicileri
    connection.on("ReceiveMessage", (message, sender, time) => {
        appendMessage(message, sender, time, sender === connectionId);
    });
    
    connection.on("ReceiveSystemMessage", (message) => {
        appendSystemMessage(message);
    });
    
    connection.on("JoinedRoom", (message) => {
        appendSystemMessage(message);
        enableMessageInput();
    });
    
    // Bağlantı durumu değişimleri
    connection.onreconnecting(() => {
        connectionStatus.textContent = "Yeniden Bağlanıyor...";
        connectionStatus.classList.remove("bg-success");
        connectionStatus.classList.add("bg-warning");
        disableMessageInput();
        appendSystemMessage("Bağlantı kesintisi. Yeniden bağlanmaya çalışılıyor...");
    });
    
    connection.onreconnected(() => {
        connectionStatus.textContent = "Bağlandı";
        connectionStatus.classList.remove("bg-warning");
        connectionStatus.classList.add("bg-success");
        enableMessageInput();
        appendSystemMessage("Bağlantı yeniden kuruldu.");
        
        // Odaya tekrar katıl
        connection.invoke("JoinRoom", roomName, connectionId)
            .catch(err => console.error(err));
    });
    
    connection.onclose(() => {
        connectionStatus.textContent = "Bağlantı Kesildi";
        connectionStatus.classList.remove("bg-success", "bg-warning");
        connectionStatus.classList.add("bg-danger");
        disableMessageInput();
        appendSystemMessage("Sunucu bağlantısı kapandı.");
    });
    
    // Event Listeners
    sendButton.addEventListener("click", sendMessage);
    
    messageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            sendMessage();
        }
    });
    
    // Bağlantıyı başlat
    startConnection();
}

// SignalR bağlantısını başlat
function startConnection() {
    connection.start()
        .then(() => {
            document.getElementById("connectionStatus").textContent = "Bağlandı";
            document.getElementById("connectionStatus").classList.remove("bg-danger");
            document.getElementById("connectionStatus").classList.add("bg-success");
            
            // Odaya katıl
            return connection.invoke("JoinRoom", roomName, connectionId);
        })
        .catch(err => {
            console.error(err);
            document.getElementById("connectionStatus").textContent = "Bağlantı Hatası";
            document.getElementById("connectionStatus").classList.remove("bg-success");
            document.getElementById("connectionStatus").classList.add("bg-danger");
            appendSystemMessage("Bağlantı kurulamadı: " + err);
        });
}

// Mesaj giriş alanını etkinleştir
function enableMessageInput() {
    document.getElementById("messageInput").disabled = false;
    document.getElementById("sendButton").disabled = false;
}

// Mesaj giriş alanını devre dışı bırak
function disableMessageInput() {
    document.getElementById("messageInput").disabled = true;
    document.getElementById("sendButton").disabled = true;
}

// Mesaj gönder
function sendMessage() {
    const messageInput = document.getElementById("messageInput");
    const message = messageInput.value.trim();
    
    if (message) {
        // SignalR üzerinden mesaj gönder
        connection.invoke("SendMessage", message, connectionId)
            .catch(err => {
                console.error(err);
                appendSystemMessage("Mesaj gönderilemedi: " + err);
            });
        
        messageInput.value = "";
    }
}

// Sistem mesajı ekle
function appendSystemMessage(message) {
    const chatMessages = document.getElementById("chatMessages");
    const div = document.createElement("div");
    div.className = "alert alert-info my-2";
    div.textContent = message;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Mesaj ekle
function appendMessage(message, sender, time, isCurrentUser) {
    const chatMessages = document.getElementById("chatMessages");
    
    const div = document.createElement("div");
    div.className = `d-flex my-2 ${isCurrentUser ? 'justify-content-end' : 'justify-content-start'}`;
    
    const msgDiv = document.createElement("div");
    msgDiv.className = `card ${isCurrentUser ? 'bg-primary text-white' : 'bg-light'}`;
    msgDiv.style.maxWidth = "75%";
    
    const msgBody = document.createElement("div");
    msgBody.className = "card-body py-2 px-3";
    
    const msgText = document.createElement("p");
    msgText.className = "card-text mb-0";
    msgText.textContent = message;
    
    const msgInfo = document.createElement("small");
    msgInfo.className = `d-block mt-1 ${isCurrentUser ? 'text-white-50' : 'text-muted'}`;
    msgInfo.textContent = `${sender} · ${time}`;
    
    msgBody.appendChild(msgText);
    msgBody.appendChild(msgInfo);
    msgDiv.appendChild(msgBody);
    div.appendChild(msgDiv);
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Sayfa yüklendiğinde çalıştır
document.addEventListener('DOMContentLoaded', () => {
    // Sohbet sayfasında olup olmadığını kontrol et
    if (document.getElementById("chatMessages")) {
        initChat();
        
        // Sohbet mesajlarını temizle ve başlangıç mesajını ekle
        document.getElementById("chatMessages").innerHTML = "";
        appendSystemMessage("Sohbete hoş geldiniz! Bağlantı kuruluyor...");
    }
}); 