using An0_Mobile.Constants;
using An0_Mobile.Models;
using Microsoft.AspNetCore.SignalR.Client;
using System;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Threading;
using System.Net.Http;

namespace An0_Mobile.Services
{
    public class ChatService : IChatService
    {
        private HubConnection _hubConnection;

        // Events
        public event EventHandler<string> UserJoined;
        public event EventHandler<Tuple<string, string, string>> MessageReceived;
        public event EventHandler<Tuple<string, string, string>> FileReceived;
        public event EventHandler<string> VideoCallOfferReceived;
        public event EventHandler<string> VideoCallAnswerReceived;
        public event EventHandler<string> IceCandidateReceived;
        public event EventHandler CallRejected;
        public event EventHandler CallEnded;
        public event EventHandler<ImageProcessingSettings> ImageProcessingSettingsUpdated;
        public event EventHandler<string> ProcessedFrameReceived;
        public event EventHandler<string> ErrorOccurred;

        public ChatService()
        {
            InitializeHub();
        }

        private void InitializeHub()
        {
            Debug.WriteLine($"Initializing SignalR hub with URL: {AppConstants.SignalRHubUrl}");
            
            _hubConnection = new HubConnectionBuilder()
                .WithUrl(AppConstants.SignalRHubUrl, options => {
                    // Emülatör için optimize edilmiş ayarlar
                    options.SkipNegotiation = false; // Negotiation adımını atlamayı devre dışı bırak
                    options.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.WebSockets 
                                      | Microsoft.AspNetCore.Http.Connections.HttpTransportType.LongPolling; // WebSocket yoksa LongPolling'e düş
                    
                    // HTTP bağlantısı için özel ayarlar
                    options.HttpMessageHandlerFactory = (handler) => {
                        if (handler is HttpClientHandler clientHandler)
                        {
                            // SSL sertifika doğrulamasını devre dışı bırak (HTTPS için gerekli)
                            clientHandler.ServerCertificateCustomValidationCallback = 
                                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator;
                                
                            // Emülatör için proxy ayarlarını devre dışı bırak
                            clientHandler.UseProxy = false;
                        }
                        return handler;
                    };
                    
                    // Bağlantı zaman aşımı süresini uzat
                    options.CloseTimeout = TimeSpan.FromSeconds(30);
                })
                .WithAutomaticReconnect(new TimeSpan[] { 
                    TimeSpan.FromSeconds(0), 
                    TimeSpan.FromSeconds(2), 
                    TimeSpan.FromSeconds(5), 
                    TimeSpan.FromSeconds(10),
                    TimeSpan.FromSeconds(15),
                    TimeSpan.FromSeconds(30),
                    TimeSpan.FromSeconds(60)
                })
                .Build();

            RegisterHubHandlers();
            
            Debug.WriteLine("SignalR hub initialized");
        }

        private void RegisterHubHandlers()
        {
            _hubConnection.On<string>("UserJoined", (userId) =>
            {
                UserJoined?.Invoke(this, userId);
            });

            _hubConnection.On<string, string, string>("ReceiveMessage", (user, message, encryptedMessage) =>
            {
                MessageReceived?.Invoke(this, new Tuple<string, string, string>(user, message, encryptedMessage));
            });

            _hubConnection.On<string, string, string>("ReceiveFile", (user, fileName, encryptedFileInfo) =>
            {
                FileReceived?.Invoke(this, new Tuple<string, string, string>(user, fileName, encryptedFileInfo));
            });

            _hubConnection.On<string>("ReceiveVideoCallOffer", (offer) =>
            {
                VideoCallOfferReceived?.Invoke(this, offer);
            });

            _hubConnection.On<string>("ReceiveVideoCallAnswer", (answer) =>
            {
                VideoCallAnswerReceived?.Invoke(this, answer);
            });

            _hubConnection.On<string>("ReceiveIceCandidate", (candidate) =>
            {
                IceCandidateReceived?.Invoke(this, candidate);
            });

            _hubConnection.On("ReceiveCallRejected", () =>
            {
                CallRejected?.Invoke(this, EventArgs.Empty);
            });

            _hubConnection.On("ReceiveCallEnded", () =>
            {
                CallEnded?.Invoke(this, EventArgs.Empty);
            });

            _hubConnection.On<ImageProcessingSettings>("ReceiveUpdatedImageProcessingSettings", (settings) =>
            {
                ImageProcessingSettingsUpdated?.Invoke(this, settings);
            });

            _hubConnection.On<string>("ReceiveProcessedFrame", (frameData) =>
            {
                ProcessedFrameReceived?.Invoke(this, frameData);
            });

            _hubConnection.On<string>("Error", (errorMessage) =>
            {
                ErrorOccurred?.Invoke(this, errorMessage);
            });
        }

        public async Task ConnectAsync()
        {
            try
            {
                Debug.WriteLine($"Trying to connect to SignalR hub at {Constants.AppConstants.SignalRHubUrl}");
                
                // Eğer bağlantı zaten kurulmuşsa ve aktifse, tekrar bağlanmaya çalışmayalım
                if (_hubConnection.State == HubConnectionState.Connected)
                {
                    Debug.WriteLine("Hub connection is already established.");
                    return;
                }
                
                // Bağlantı denenirken timeout süresini uzatalım
                var timeoutTokenSource = new CancellationTokenSource();
                timeoutTokenSource.CancelAfter(TimeSpan.FromSeconds(30)); // 30 saniye timeout (arttırıldı)
                
                // Bağlantıyı başlat
                await _hubConnection.StartAsync(timeoutTokenSource.Token);
                Debug.WriteLine("Successfully connected to SignalR hub!");
            }
            catch (OperationCanceledException)
            {
                string errorDetails = "Connection operation was canceled. The server might be unreachable or the timeout period expired.";
                Debug.WriteLine(errorDetails);
                ErrorOccurred?.Invoke(this, errorDetails);
                throw;
            }
            catch (Exception ex)
            {
                string errorDetails = $"Connection error: {ex.Message}";
                if (ex.InnerException != null)
                    errorDetails += $" Inner exception: {ex.InnerException.Message}";
                
                Debug.WriteLine(errorDetails);
                Debug.WriteLine($"Stack trace: {ex.StackTrace}");
                
                ErrorOccurred?.Invoke(this, errorDetails);
                throw;
            }
        }

        public async Task DisconnectAsync()
        {
            try
            {
                await _hubConnection.StopAsync();
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Disconnection error: {ex.Message}");
                throw;
            }
        }

        public async Task JoinChatAsync(string connectionId, string passwordHash)
        {
            try
            {
                await _hubConnection.InvokeAsync("JoinChat", connectionId, passwordHash);
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Join chat error: {ex.Message}");
                throw;
            }
        }

        public async Task JoinWithInviteCodeAsync(string inviteCode, string connectionId)
        {
            try
            {
                await _hubConnection.InvokeAsync("JoinWithInviteCode", inviteCode, connectionId);
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Join with invite code error: {ex.Message}");
                throw;
            }
        }

        public async Task<string> CreateRoomAsync(string connectionId, string passwordHash)
        {
            try
            {
                Debug.WriteLine($"CreateRoomAsync: Oda oluşturma başlatılıyor (ConnectionId: {connectionId})");
                var timeout = TimeSpan.FromSeconds(30);
                
                using (var cts = new CancellationTokenSource(timeout))
                {
                    // Uzun süreli işlemi daha kısa bir zaman aşımı ile dene
                    Debug.WriteLine($"CreateRoom işlevi çağrılıyor ({timeout.TotalSeconds} saniye timeout)");
                    string result = await _hubConnection.InvokeAsync<string>("CreateRoom", connectionId, passwordHash, cts.Token);
                    Debug.WriteLine($"Oda başarıyla oluşturuldu. Davet kodu: {result}");
                    return result;
                }
            }
            catch (OperationCanceledException)
            {
                string errorMsg = "Oda oluşturma işlemi zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.";
                Debug.WriteLine($"HATA: {errorMsg}");
                ErrorOccurred?.Invoke(this, errorMsg);
                throw;
            }
            catch (Exception ex)
            {
                string errorMsg = $"Create room error: {ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMsg += $" Inner exception: {ex.InnerException.Message}";
                    Debug.WriteLine($"İç hata türü: {ex.InnerException.GetType().Name}");
                }
                
                Debug.WriteLine($"HATA: {errorMsg}");
                Debug.WriteLine($"Stack trace: {ex.StackTrace}");
                
                ErrorOccurred?.Invoke(this, errorMsg);
                throw;
            }
        }

        public async Task SendMessageAsync(string user, string message, string recipient, string encryptedMessage)
        {
            try
            {
                await _hubConnection.InvokeAsync("SendMessage", user, message, recipient, encryptedMessage);
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Send message error: {ex.Message}");
                throw;
            }
        }

        public async Task SendFileAsync(string user, string fileName, string recipient, string encryptedFileInfo)
        {
            try
            {
                await _hubConnection.InvokeAsync("SendFile", user, fileName, recipient, encryptedFileInfo);
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Send file error: {ex.Message}");
                throw;
            }
        }

        public async Task SendVideoCallOfferAsync(string offer, string recipient)
        {
            try
            {
                await _hubConnection.InvokeAsync("SendVideoCallOffer", offer, recipient);
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Send video call offer error: {ex.Message}");
                throw;
            }
        }

        public async Task SendVideoCallAnswerAsync(string answer, string recipient)
        {
            try
            {
                await _hubConnection.InvokeAsync("SendVideoCallAnswer", answer, recipient);
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Send video call answer error: {ex.Message}");
                throw;
            }
        }

        public async Task SendIceCandidateAsync(string candidate, string recipient)
        {
            try
            {
                await _hubConnection.InvokeAsync("SendIceCandidate", candidate, recipient);
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Send ICE candidate error: {ex.Message}");
                throw;
            }
        }

        public async Task SendCallRejectedAsync(string recipient)
        {
            try
            {
                await _hubConnection.InvokeAsync("SendCallRejected", recipient);
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Send call rejected error: {ex.Message}");
                throw;
            }
        }

        public async Task SendCallEndedAsync(string recipient)
        {
            try
            {
                await _hubConnection.InvokeAsync("SendCallEnded", recipient);
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Send call ended error: {ex.Message}");
                throw;
            }
        }

        public async Task UpdateImageProcessingSettingsAsync(ImageProcessingSettings settings)
        {
            try
            {
                await _hubConnection.InvokeAsync("UpdateImageProcessingSettings", settings);
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Update image processing settings error: {ex.Message}");
                throw;
            }
        }

        public async Task SendProcessedFrameAsync(string frameData)
        {
            try
            {
                await _hubConnection.InvokeAsync("SendProcessedFrame", frameData);
            }
            catch (Exception ex)
            {
                ErrorOccurred?.Invoke(this, $"Send processed frame error: {ex.Message}");
                throw;
            }
        }
    }
} 