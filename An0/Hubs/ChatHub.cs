using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System;
using System.Linq;
using System.Text;
using System.Net.Http;
using System.Text.Json;

namespace An0.Hubs
{
    public class ChatHub : Hub
    {
        private readonly ILogger<ChatHub> _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private static readonly ConcurrentDictionary<string, string> _connectionGroups = new ConcurrentDictionary<string, string>();
        private static readonly ConcurrentDictionary<string, string> _connectionIDs = new ConcurrentDictionary<string, string>();
        private static readonly ConcurrentDictionary<string, RoomInfo> _rooms = new ConcurrentDictionary<string, RoomInfo>();
        private const string IMAGE_PROCESSING_API_URL = "http://localhost:10002"; // Görüntü işleme API'mizin adresi

        public class RoomInfo
        {
            public required string RoomCode { get; set; }
            public required string PasswordHash { get; set; }
            public DateTime CreatedDate { get; set; }
            public List<string> ConnectionIds { get; set; } = new List<string>();
            public Dictionary<string, ImageProcessingSettings> UserSettings { get; set; } = new Dictionary<string, ImageProcessingSettings>();
        }

        public class ImageProcessingSettings
        {
            public bool EnableFaceDetection { get; set; }
            public bool EnableObjectDetection { get; set; }
            public bool EnableBackgroundRemoval { get; set; }
            public string ActiveFilter { get; set; } = "none";
            public int BrightnessAdjustment { get; set; } = 0;
            public int ContrastAdjustment { get; set; } = 0;
        }

        public ChatHub(ILogger<ChatHub> logger, IHttpClientFactory httpClientFactory)
        {
            _logger = logger;
            _httpClientFactory = httpClientFactory;
        }

        // Davet kodu oluşturma metodu
        public string GenerateInviteCode(string roomCode, string passwordHash)
        {
            // Oda kodu ve şifreyi birleştir
            string combined = $"{roomCode}:{passwordHash}";
            
            // Base64 kodlama kullanarak tek bir kod oluştur
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(combined));
        }

        // Davet kodunu çözme metodu
        public (string? roomCode, string? passwordHash) DecodeInviteCode(string inviteCode)
        {
            try
            {
                // Base64 kodunu çöz
                string decoded = Encoding.UTF8.GetString(Convert.FromBase64String(inviteCode));
                
                // Oda kodu ve şifreyi ayır
                string[] parts = decoded.Split(':');
                if (parts.Length == 2)
                {
                    return (parts[0], parts[1]);
                }
                
                _logger.LogWarning("Invalid invite code format");
                return (null, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error decoding invite code");
                return (null, null);
            }
        }

        // Davet kodunu çözme metodu (client tarafından çağrılabilir)
        public object? DecodeInviteCodeForClient(string inviteCode)
        {
            try
            {
                var (roomCode, passwordHash) = DecodeInviteCode(inviteCode);
                
                if (roomCode != null && passwordHash != null)
                {
                    return new { roomCode, passwordHash };
                }
                
                _logger.LogWarning("Invalid invite code format (client call)");
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error decoding invite code (client call)");
                return null;
            }
        }

        // Rastgele oda kodu oluşturma metodu
        public string GenerateRoomCode()
        {
            // 8 karakterlik rastgele bir kod oluştur
            return Guid.NewGuid().ToString("N").Substring(0, 8);
        }

        // Oda oluşturma metodu
        public async Task<string> CreateRoom(string connectionId, string passwordHash)
        {
            // Rastgele bir oda kodu oluştur
            string roomCode = GenerateRoomCode();
            
            _logger.LogInformation("Creating room with code: {RoomCode}", roomCode);
            
            // Oda bilgilerini kaydet
            var roomInfo = new RoomInfo
            {
                RoomCode = roomCode,
                PasswordHash = passwordHash,
                CreatedDate = DateTime.UtcNow,
                ConnectionIds = new List<string> { Context.ConnectionId }
            };
            
            _rooms[roomCode] = roomInfo;
            
            // Kullanıcıyı odaya ekle
            await Groups.AddToGroupAsync(Context.ConnectionId, roomCode);
            _connectionGroups[Context.ConnectionId] = roomCode;
            _connectionIDs[Context.ConnectionId] = connectionId;
            
            // Davet kodunu oluştur ve döndür
            string inviteCode = GenerateInviteCode(roomCode, passwordHash);
            
            _logger.LogInformation("Room created with code: {RoomCode}, invite code: {InviteCode}", roomCode, inviteCode);
            
            return inviteCode;
        }

        // Normal katılma metodu
        public async Task JoinChat(string connectionId, string passwordHash)
        {
            _logger.LogInformation("User joined with connection ID and password hash: {PasswordHash}...", 
                passwordHash.Substring(0, 10));
            
            // Store the connection ID for this connection
            _connectionIDs[Context.ConnectionId] = connectionId;
            
            // Use the password hash as the group name
            // This ensures that only users with the same password can communicate
            var groupName = passwordHash;
            
            // Add the connection to the group
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            _connectionGroups[Context.ConnectionId] = groupName;
            
            // Log all connections in this group
            var connectionsInGroup = _connectionGroups
                .Where(kvp => kvp.Value == groupName)
                .Select(kvp => kvp.Key);
            
            _logger.LogInformation("Connection {ConnectionId} added to group {GroupName}", 
                Context.ConnectionId, groupName);
            
            _logger.LogInformation("Connections in group {GroupName}: {Connections}", 
                groupName, string.Join(", ", connectionsInGroup));
            
            // Notify all clients in the group that a new user has joined
            await Clients.Group(groupName).SendAsync("UserJoined", connectionId);
        }

        // Davet kodu ile odaya katılma metodu
        public async Task JoinWithInviteCode(string inviteCode, string connectionId)
        {
            _logger.LogInformation("Attempting to join with invite code: {InviteCode}", inviteCode);
            
            var (roomCode, passwordHash) = DecodeInviteCode(inviteCode);
            
            if (roomCode != null && passwordHash != null)
            {
                _logger.LogInformation("Decoded invite code. Room code: {RoomCode}, Password hash: {PasswordHash}...", 
                    roomCode, passwordHash.Substring(0, 10));
                
                // Bağlantıyı odaya ekle
                var connectionSignalrId = Context.ConnectionId;
                
                // Oda varsa
                if (_rooms.TryGetValue(roomCode, out var roomInfo))
                {
                    _logger.LogInformation("Room found with code: {RoomCode}", roomCode);
                    
                    // Bağlantıyı odaya ekle
                    await Groups.AddToGroupAsync(connectionSignalrId, roomCode);
                    roomInfo.ConnectionIds.Add(connectionSignalrId);
                    _connectionGroups[connectionSignalrId] = roomCode;
                    _connectionIDs[connectionSignalrId] = connectionId;
                    
                    _logger.LogInformation("Connection {ConnectionId} added to room {RoomCode}", 
                        connectionSignalrId, roomCode);
                    
                    // Odadaki diğer kullanıcılara bildirim gönder
                    await Clients.Group(roomCode).SendAsync("UserJoined", connectionId);
                    
                    // Başarılı katılım bildirimi
                    await Clients.Caller.SendAsync("JoinSuccess", roomCode);
                }
                else
                {
                    // Oda yoksa yeni oda oluştur
                    _logger.LogInformation("Room not found. Creating new room with code: {RoomCode}", roomCode);
                    
                    var newRoom = new RoomInfo
                    {
                        RoomCode = roomCode,
                        PasswordHash = passwordHash,
                        CreatedDate = DateTime.UtcNow,
                        ConnectionIds = new List<string> { connectionSignalrId }
                    };
                    
                    _rooms[roomCode] = newRoom;
                    
                    // Bağlantıyı odaya ekle
                    await Groups.AddToGroupAsync(connectionSignalrId, roomCode);
                    _connectionGroups[connectionSignalrId] = roomCode;
                    _connectionIDs[connectionSignalrId] = connectionId;
                    
                    _logger.LogInformation("Connection {ConnectionId} added to new room {RoomCode}", 
                        connectionSignalrId, roomCode);
                    
                    // Başarılı katılım bildirimi
                    await Clients.Caller.SendAsync("JoinSuccess", roomCode);
                }
            }
            else
            {
                _logger.LogWarning("Invalid invite code: {InviteCode}", inviteCode);
                await Clients.Caller.SendAsync("JoinFailed", "Invalid invite code");
            }
        }

        public async Task SendMessage(string user, string message, string recipient, string encryptedMessage)
        {
            _logger.LogInformation("Message received from {User} for {Recipient}", user, recipient);
            
            // Get the connection ID
            var connectionId = Context.ConnectionId;
            
            // Check if the connection is part of a group
            if (_connectionGroups.TryGetValue(connectionId, out var groupName))
            {
                _logger.LogInformation("Sending message to group: {GroupName}", groupName);
                
                // Send the message to all clients in the group except the sender
                // Use the connection ID instead of "Other" as the user identifier
                await Clients.GroupExcept(groupName, connectionId)
                    .SendAsync("ReceiveMessage", connectionId, message, encryptedMessage);
            }
            else
            {
                _logger.LogWarning("Connection {ConnectionId} not found in any group", connectionId);
            }
        }

        public async Task SendFile(string user, string fileName, string recipient, string encryptedFileInfo)
        {
            _logger.LogInformation("File received from {User} for {Recipient}: {FileName}", user, recipient, fileName);
            
            // Get the connection ID
            var connectionId = Context.ConnectionId;
            
            // Check if the connection is part of a group
            if (_connectionGroups.TryGetValue(connectionId, out var groupName))
            {
                _logger.LogInformation("Sending file to group: {GroupName}", groupName);
                
                // Send the file to all clients in the group except the sender
                await Clients.GroupExcept(groupName, connectionId)
                    .SendAsync("ReceiveFile", connectionId, fileName, encryptedFileInfo);
            }
            else
            {
                _logger.LogWarning("Connection {ConnectionId} not found in any group", connectionId);
            }
        }

        // Video call signaling methods
        public async Task SendVideoCallOffer(string offer, string recipient)
        {
            _logger.LogInformation("Video call offer from {ConnectionId} to {Recipient}", Context.ConnectionId, recipient);
            
            var connectionId = Context.ConnectionId;
            
            if (_connectionGroups.TryGetValue(connectionId, out var groupName))
            {
                _logger.LogInformation("Sending video call offer to group: {GroupName}", groupName);
                
                // Send the offer to all clients in the group except the sender
                await Clients.GroupExcept(groupName, connectionId)
                    .SendAsync("ReceiveVideoCallOffer", offer);
            }
            else
            {
                _logger.LogWarning("Connection {ConnectionId} not found in any group", connectionId);
            }
        }

        public async Task SendVideoCallAnswer(string answer, string recipient)
        {
            _logger.LogInformation("Video call answer from {ConnectionId} to {Recipient}", Context.ConnectionId, recipient);
            
            var connectionId = Context.ConnectionId;
            
            if (_connectionGroups.TryGetValue(connectionId, out var groupName))
            {
                _logger.LogInformation("Sending video call answer to group: {GroupName}", groupName);
                
                // Send the answer to all clients in the group except the sender
                await Clients.GroupExcept(groupName, connectionId)
                    .SendAsync("ReceiveVideoCallAnswer", answer);
            }
            else
            {
                _logger.LogWarning("Connection {ConnectionId} not found in any group", connectionId);
            }
        }

        public async Task SendIceCandidate(string candidate, string recipient)
        {
            var connectionId = Context.ConnectionId;
            
            if (_connectionGroups.TryGetValue(connectionId, out var groupName))
            {
                // Send the ICE candidate to all clients in the group except the sender
                await Clients.GroupExcept(groupName, connectionId)
                    .SendAsync("ReceiveIceCandidate", candidate);
            }
            else
            {
                _logger.LogWarning("Connection {ConnectionId} not found in any group", connectionId);
            }
        }

        public async Task SendCallRejected(string recipient)
        {
            _logger.LogInformation("Call rejected by {ConnectionId}", Context.ConnectionId);
            
            var connectionId = Context.ConnectionId;
            
            if (_connectionGroups.TryGetValue(connectionId, out var groupName))
            {
                // Send the rejection to all clients in the group except the sender
                await Clients.GroupExcept(groupName, connectionId)
                    .SendAsync("ReceiveCallRejected");
            }
            else
            {
                _logger.LogWarning("Connection {ConnectionId} not found in any group", connectionId);
            }
        }

        public async Task SendCallEnded(string recipient)
        {
            _logger.LogInformation("Call ended by {ConnectionId}", Context.ConnectionId);
            
            var connectionId = Context.ConnectionId;
            
            if (_connectionGroups.TryGetValue(connectionId, out var groupName))
            {
                // Send the end call notification to all clients in the group except the sender
                await Clients.GroupExcept(groupName, connectionId)
                    .SendAsync("ReceiveCallEnded");
            }
            else
            {
                _logger.LogWarning("Connection {ConnectionId} not found in any group", connectionId);
            }
        }

        // Görüntü işleme ayarlarını güncelle
        public async Task UpdateImageProcessingSettings(ImageProcessingSettings settings)
        {
            var connectionId = Context.ConnectionId;
            var roomCode = _connectionGroups[connectionId];
            
            if (_rooms.TryGetValue(roomCode, out var roomInfo))
            {
                roomInfo.UserSettings[connectionId] = settings;
                await Clients.Group(roomCode).SendAsync("ImageProcessingSettingsUpdated", connectionId, settings);
            }
        }

        // İşlenmiş frame'i gönder
        public async Task SendProcessedFrame(string frameData)
        {
            var connectionId = Context.ConnectionId;
            var roomCode = _connectionGroups[connectionId];
            
            if (_rooms.TryGetValue(roomCode, out var roomInfo))
            {
                // Frame'i odadaki diğer kullanıcılara gönder
                await Clients.OthersInGroup(roomCode).SendAsync("ReceiveProcessedFrame", frameData);
            }
        }

        // Görüntü işleme API'sine frame gönder
        private async Task<string> ProcessFrameWithAPI(string frameData, ImageProcessingSettings settings)
        {
            try
            {
                using var client = _httpClientFactory.CreateClient();
                var requestData = new
                {
                    image = frameData,
                    settings = settings
                };

                var response = await client.PostAsJsonAsync($"{IMAGE_PROCESSING_API_URL}/process-frame", requestData);
                response.EnsureSuccessStatusCode();

                var result = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
                return result != null && result.ContainsKey("processedImage") ? result["processedImage"] : frameData;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Frame işleme hatası");
                return frameData; // Hata durumunda orijinal frame'i gönder
            }
        }

        public override async Task OnConnectedAsync()
        {
            _logger.LogInformation($"Client connected: {Context.ConnectionId}");
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            _logger.LogInformation($"Client disconnected: {Context.ConnectionId}");
            
            // Remove the connection from the dictionaries
            if (_connectionGroups.TryRemove(Context.ConnectionId, out var groupName))
            {
                _logger.LogInformation($"Removed connection {Context.ConnectionId} from group {groupName}");
                // Remove from the SignalR group
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
                
                // Eğer bu bir oda ise, bağlantıyı odadan da kaldır
                foreach (var room in _rooms.Values)
                {
                    room.ConnectionIds.Remove(Context.ConnectionId);
                }
            }
            
            _connectionIDs.TryRemove(Context.ConnectionId, out _);
            
            await base.OnDisconnectedAsync(exception);
        }
    }
} 