using Microsoft.AspNetCore.Mvc;
using An0.Models;
using An0.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace An0.Controllers
{
    public class ChatController : Controller
    {
        private readonly IHubContext<ChatHub> _hubContext;

        public ChatController(IHubContext<ChatHub> hubContext)
        {
            _hubContext = hubContext;
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

            // Bağlantı bilgilerini TempData'da sakla
            TempData["ConnectionId"] = model.ConnectionId;
            TempData["SharedPassword"] = model.SharedPassword;

            return RedirectToAction("Chat");
        }

        public IActionResult Chat()
        {
            // Bağlantı kontrolü
            if (TempData["ConnectionId"] == null || TempData["SharedPassword"] == null)
            {
                return RedirectToAction("Connect");
            }

            // Görünüme bağlantı bilgilerini aktar
            ViewBag.ConnectionId = TempData["ConnectionId"];
            ViewBag.SharedPassword = TempData["SharedPassword"];

            return View();
        }
    }
} 