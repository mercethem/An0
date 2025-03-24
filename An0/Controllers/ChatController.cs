using Microsoft.AspNetCore.Mvc;
using An0.Models;
using An0.Hubs;
using Microsoft.AspNetCore.SignalR;
using System.Text;

namespace An0.Controllers
{
    public class ChatController : Controller
    {
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly ChatHub _chatHub;

        public ChatController(IHubContext<ChatHub> hubContext, ChatHub chatHub)
        {
            _hubContext = hubContext;
            _chatHub = chatHub;
        }

        public IActionResult Index()
        {
            return View();
        }

        public IActionResult Connect()
        {
            return View();
        }

        [HttpPost]
        public IActionResult Connect(ChatViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            // Store the connection info in TempData
            // In a real application, you might use a more secure approach
            TempData["ConnectionId"] = model.ConnectionId;
            TempData["SharedPassword"] = model.SharedPassword;

            return RedirectToAction("Chat");
        }

        [HttpPost]
        public IActionResult JoinWithInviteCode(string inviteCode)
        {
            if (string.IsNullOrEmpty(inviteCode))
            {
                return RedirectToAction("Connect");
            }

            try
            {
                // Davet kodunu çöz
                var (roomCode, passwordHash) = _chatHub.DecodeInviteCode(inviteCode);
                
                if (roomCode == null || passwordHash == null)
                {
                    TempData["ErrorMessage"] = "Geçersiz davet kodu";
                    return RedirectToAction("Connect");
                }

                // Şifre hash'ini çöz (gerçek uygulamada bu adım farklı olabilir)
                // Not: Bu örnek için basit bir yaklaşım kullanıyoruz
                // Gerçek uygulamada daha güvenli bir yöntem kullanılmalıdır
                
                // TempData'ya bilgileri kaydet
                TempData["InviteCode"] = inviteCode;
                TempData["RoomCode"] = roomCode;
                TempData["PasswordHash"] = passwordHash;
                
                // Generate a unique connection ID
                TempData["ConnectionId"] = "connection_" + Guid.NewGuid().ToString("N").Substring(0, 8);
                
                return RedirectToAction("Chat");
            }
            catch (Exception ex)
            {
                TempData["ErrorMessage"] = "Davet kodu işlenirken bir hata oluştu: " + ex.Message;
                return RedirectToAction("Connect");
            }
        }

        public IActionResult Chat(string? inviteCode = null, string? roomCode = null, string? passwordHash = null)
        {
            // Davet kodu ile giriş yapıldıysa
            if (!string.IsNullOrEmpty(inviteCode))
            {
                ViewBag.InviteCode = inviteCode;
                ViewBag.RoomCode = roomCode;
                ViewBag.PasswordHash = passwordHash;
                ViewBag.ConnectionId = TempData["ConnectionId"] ?? ("connection_" + Guid.NewGuid().ToString("N").Substring(0, 8));
                ViewBag.JoinWithInviteCode = true;
                
                return View();
            }
            
            // Normal giriş kontrolü
            if (TempData["ConnectionId"] == null || TempData["SharedPassword"] == null)
            {
                return RedirectToAction("Connect");
            }

            ViewBag.ConnectionId = TempData["ConnectionId"];
            ViewBag.SharedPassword = TempData["SharedPassword"];
            ViewBag.JoinWithInviteCode = false;

            return View();
        }
    }
} 