using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System;
using System.Linq;

namespace An0.Hubs
{
    public class ChatHub : Hub
    {
        private readonly ILogger<ChatHub> _logger;
        private static readonly ConcurrentDictionary<string, string> _connectionGroups = new ConcurrentDictionary<string, string>();
        private static readonly ConcurrentDictionary<string, string> _connectionIDs = new ConcurrentDictionary<string, string>();

        public ChatHub(ILogger<ChatHub> logger)
        {
            _logger = logger;
        }

        /// <summary>
        /// Kullanıcı bağlantı kurduğunda çağrılır
        /// </summary>
        public override async Task OnConnectedAsync()
        {
            _logger.LogInformation($"Kullanıcı bağlandı: {Context.ConnectionId}");
            await base.OnConnectedAsync();
        }

        /// <summary>
        /// Kullanıcı bağlantıyı kestiğinde çağrılır
        /// </summary>
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            // Bağlantıyı kesen kullanıcının grup bilgisini al
            if (_connectionGroups.TryGetValue(Context.ConnectionId, out var groupName))
            {
                // Kullanıcıyı gruptan çıkar
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
                
                // Diğer kullanıcılara bildir
                await Clients.Group(groupName).SendAsync("ReceiveSystemMessage", $"Bir kullanıcı odadan ayrıldı.");
                
                // Bağlantı-grup eşleşmesini temizle
                _connectionGroups.TryRemove(Context.ConnectionId, out _);

                // Kullanıcı adını temizle
                _connectionIDs.TryRemove(Context.ConnectionId, out _);
            }

            _logger.LogInformation($"Kullanıcı ayrıldı: {Context.ConnectionId}");
            await base.OnDisconnectedAsync(exception);
        }

        /// <summary>
        /// Bir odaya katılma işlemi
        /// </summary>
        public async Task JoinRoom(string roomName, string connectionId)
        {
            if (string.IsNullOrEmpty(roomName) || string.IsNullOrEmpty(connectionId))
            {
                throw new ArgumentException("Oda adı ve bağlantı ID'si gereklidir.");
            }

            // Kullanıcı bilgilerini kaydet
            _connectionIDs[Context.ConnectionId] = connectionId;
            
            // Kullanıcıyı gruba ekle
            await Groups.AddToGroupAsync(Context.ConnectionId, roomName);
            
            // Bağlantı-grup eşleşmesini kaydet
            _connectionGroups[Context.ConnectionId] = roomName;

            // Diğer kullanıcılara bildir
            await Clients.Group(roomName).SendAsync("ReceiveSystemMessage", $"Yeni bir kullanıcı odaya katıldı: {connectionId}");
            
            // Katılan kullanıcıya bildir
            await Clients.Caller.SendAsync("JoinedRoom", $"'{roomName}' odasına başarıyla katıldınız.");
            
            _logger.LogInformation($"Kullanıcı {connectionId} odaya katıldı: {roomName}");
        }

        /// <summary>
        /// Mesaj gönderme işlemi
        /// </summary>
        public async Task SendMessage(string message, string connectionId)
        {
            if (string.IsNullOrEmpty(message) || string.IsNullOrEmpty(connectionId))
            {
                throw new ArgumentException("Mesaj ve bağlantı ID'si gereklidir.");
            }

            // Kullanıcının bağlı olduğu grubu bul
            if (_connectionGroups.TryGetValue(Context.ConnectionId, out var roomName))
            {
                // Gruptaki tüm kullanıcılara mesajı gönder
                await Clients.Group(roomName).SendAsync("ReceiveMessage", message, connectionId, DateTime.Now.ToString("HH:mm:ss"));
                _logger.LogInformation($"Kullanıcı {connectionId} mesaj gönderdi: {roomName}");
            }
            else
            {
                // Kullanıcı bir odaya bağlı değilse hata mesajı gönder
                await Clients.Caller.SendAsync("ReceiveSystemMessage", "Mesaj göndermek için önce bir odaya katılmalısınız.");
                _logger.LogWarning($"Kullanıcı {connectionId} bir odaya bağlı olmadan mesaj göndermeye çalıştı.");
            }
        }
    }
} 