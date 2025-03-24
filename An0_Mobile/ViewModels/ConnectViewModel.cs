using An0_Mobile.Models;
using An0_Mobile.Services;
using System;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Windows.Input;
using Microsoft.Maui.Controls;

namespace An0_Mobile.ViewModels
{
    public class ConnectViewModel : BaseViewModel
    {
        private readonly IChatService _chatService;
        private readonly ISecurityService _securityService;

        private string connectionId;
        private string sharedPassword;
        private string inviteCode;
        private string errorMessage;

        public string ConnectionId
        {
            get => connectionId;
            set => SetProperty(ref connectionId, value);
        }

        public string SharedPassword
        {
            get => sharedPassword;
            set => SetProperty(ref sharedPassword, value);
        }

        public string InviteCode
        {
            get => inviteCode;
            set => SetProperty(ref inviteCode, value);
        }

        public string ErrorMessage
        {
            get => errorMessage;
            set => SetProperty(ref errorMessage, value);
        }

        public ICommand CreateRoomCommand { get; }
        public ICommand JoinRoomCommand { get; }
        public ICommand JoinWithInviteCodeCommand { get; }
        public ICommand GeneratePasswordCommand { get; }
        public ICommand TestConnectionCommand { get; }

        public ConnectViewModel(IChatService chatService, ISecurityService securityService)
        {
            Title = "Connect to Chat";
            _chatService = chatService;
            _securityService = securityService;

            CreateRoomCommand = new Command(async () => await ExecuteWithErrorHandling(CreateRoomAsync));
            JoinRoomCommand = new Command(async () => await ExecuteWithErrorHandling(JoinRoomAsync));
            JoinWithInviteCodeCommand = new Command(async () => await ExecuteWithErrorHandling(JoinWithInviteCodeAsync));
            GeneratePasswordCommand = new Command(GeneratePassword);
            TestConnectionCommand = new Command(async () => await TestConnectionAsync());

            // Initialize with defaults
            ConnectionId = _securityService.GenerateConnectionId();
            GeneratePassword();
            
            // Log initialization complete
            Debug.WriteLine("ConnectViewModel initialized with ConnectionId: " + ConnectionId);
        }

        private async Task ExecuteWithErrorHandling(Func<Task> action)
        {
            try
            {
                IsBusy = true;
                ErrorMessage = string.Empty;
                
                Debug.WriteLine($"Executing action {action.Method.Name}");
                await action();
            }
            catch (Exception ex)
            {
                // Log the exception details
                Debug.WriteLine($"ERROR in {action.Method.Name}: {ex.GetType().Name} - {ex.Message}");
                Debug.WriteLine($"Stack trace: {ex.StackTrace}");
                
                // Show user-friendly message
                var baseMessage = $"Error: {ex.Message}";
                if (ex.InnerException != null)
                {
                    baseMessage += $" ({ex.InnerException.Message})";
                }
                
                ErrorMessage = baseMessage;
                await Application.Current.MainPage.DisplayAlert("Error", baseMessage, "OK");
            }
            finally
            {
                IsBusy = false;
            }
        }

        private async Task TestConnectionAsync()
        {
            try
            {
                IsBusy = true;
                ErrorMessage = "Testing connection...";
                
                Debug.WriteLine("Başlatılıyor: SignalR bağlantı testi...");
                Debug.WriteLine($"Bağlantı URL: {Constants.AppConstants.SignalRHubUrl}");
                
                // Önce bağlantı kesilsin
                try { await _chatService.DisconnectAsync(); } catch { /* Bağlantı zaten kapalıysa hata fırlatmasın */ }
                
                // 30 saniye timeout ile bağlanmayı dene
                var timeout = TimeSpan.FromSeconds(30);
                var timeoutTask = Task.Delay(timeout);
                var connectionTask = _chatService.ConnectAsync();
                
                var completedTask = await Task.WhenAny(connectionTask, timeoutTask);
                
                // Timeout oldu mu?
                if (completedTask == timeoutTask)
                {
                    throw new TimeoutException($"Bağlantı {timeout.TotalSeconds} saniye içinde kurulamadı.");
                }
                
                // Bağlantıda hata var mıydı?
                await connectionTask; // Hata varsa burada fırlatılacak
                
                Debug.WriteLine("Bağlantı başarılı! Sunucu erişilebilir.");
                ErrorMessage = "Connection successful! Server is reachable.";
                await Application.Current.MainPage.DisplayAlert("Başarılı", "Sunucu bağlantısı başarıyla kuruldu.", "Tamam");
            }
            catch (TimeoutException tex)
            {
                Debug.WriteLine($"Bağlantı zaman aşımı: {tex.Message}");
                ErrorMessage = $"Bağlantı zaman aşımı: Sunucuya 30 saniye içinde bağlanılamadı.";
                await Application.Current.MainPage.DisplayAlert("Bağlantı Zaman Aşımı", "Sunucuya 30 saniye içinde bağlanılamadı. Sunucunun çalıştığından ve erişilebilir olduğundan emin olun.", "Tamam");
            }
            catch (System.Net.Http.HttpRequestException httpEx)
            {
                Debug.WriteLine($"HTTP hatası: {httpEx.Message}");
                if (httpEx.InnerException != null)
                    Debug.WriteLine($"İç hata: {httpEx.InnerException.Message}");
                
                ErrorMessage = $"HTTP hatası: {httpEx.Message}";
                await Application.Current.MainPage.DisplayAlert("HTTP Hatası", $"HTTPS bağlantısı kurulamadı: {httpEx.Message}\n\nSunucunun HTTPS üzerinden erişilebilir olduğundan emin olun.", "Tamam");
            }
            catch (OperationCanceledException ocEx)
            {
                Debug.WriteLine($"İşlem iptal edildi: {ocEx.Message}");
                ErrorMessage = "İşlem iptal edildi. Sunucu erişilebilir olmayabilir veya zaman aşımına uğramış olabilir.";
                await Application.Current.MainPage.DisplayAlert("İşlem İptal Edildi", "Bağlantı işlemi iptal edildi. Sunucu erişilebilir olmayabilir.", "Tamam");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Bağlantı testi başarısız: {ex.Message}");
                if (ex.InnerException != null)
                {
                    Debug.WriteLine($"İç hata: {ex.InnerException.Message}");
                    Debug.WriteLine($"İç hata tipi: {ex.InnerException.GetType().Name}");
                }
                
                ErrorMessage = $"Bağlantı hatası: {ex.Message}";
                await Application.Current.MainPage.DisplayAlert("Bağlantı Başarısız", $"Sunucuya bağlanılamadı: {ex.Message}", "Tamam");
            }
            finally
            {
                IsBusy = false;
            }
        }

        private void GeneratePassword()
        {
            SharedPassword = _securityService.GenerateStrongPassword();
            Debug.WriteLine($"Generated new password: {SharedPassword}");
        }

        private async Task CreateRoomAsync()
        {
            if (string.IsNullOrEmpty(SharedPassword))
            {
                ErrorMessage = "Please enter a password or generate one.";
                return;
            }

            Debug.WriteLine($"Creating room with ConnectionId: {ConnectionId}, Password: {SharedPassword}");
            string passwordHash = _securityService.HashPassword(SharedPassword);
            Debug.WriteLine($"Password hash: {passwordHash}");
            
            await _chatService.ConnectAsync();
            Debug.WriteLine("Connected to SignalR hub");
            
            string inviteCodeResult = await _chatService.CreateRoomAsync(ConnectionId, passwordHash);
            Debug.WriteLine($"Room created with invite code: {inviteCodeResult}");

            // Navigate to chat page
            await Shell.Current.GoToAsync($"//ChatPage?connectionId={ConnectionId}&sharedPassword={SharedPassword}&inviteCode={inviteCodeResult}");
        }

        private async Task JoinRoomAsync()
        {
            if (string.IsNullOrEmpty(SharedPassword))
            {
                ErrorMessage = "Please enter a password.";
                return;
            }

            Debug.WriteLine($"Joining room with ConnectionId: {ConnectionId}, Password: {SharedPassword}");
            string passwordHash = _securityService.HashPassword(SharedPassword);
            
            await _chatService.ConnectAsync();
            Debug.WriteLine("Connected to SignalR hub");
            
            await _chatService.JoinChatAsync(ConnectionId, passwordHash);
            Debug.WriteLine("Joined chat room");

            // Navigate to chat page
            await Shell.Current.GoToAsync($"//ChatPage?connectionId={ConnectionId}&sharedPassword={SharedPassword}");
        }

        private async Task JoinWithInviteCodeAsync()
        {
            if (string.IsNullOrEmpty(InviteCode))
            {
                ErrorMessage = "Please enter an invite code.";
                return;
            }

            Debug.WriteLine($"Joining with invite code: {InviteCode}, ConnectionId: {ConnectionId}");
            
            await _chatService.ConnectAsync();
            Debug.WriteLine("Connected to SignalR hub");
            
            await _chatService.JoinWithInviteCodeAsync(InviteCode, ConnectionId);
            Debug.WriteLine("Joined chat room with invite code");

            // Navigate to chat page
            await Shell.Current.GoToAsync($"//ChatPage?connectionId={ConnectionId}&inviteCode={InviteCode}");
        }
    }
} 