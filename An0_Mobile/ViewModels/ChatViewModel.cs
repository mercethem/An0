using An0_Mobile.Models;
using An0_Mobile.Services;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Input;
using Microsoft.Maui;
using Microsoft.Maui.Controls;
using Microsoft.Maui.Storage;

namespace An0_Mobile.ViewModels
{
    public class ChatViewModel : BaseViewModel
    {
        private readonly IChatService _chatService;
        private readonly ISecurityService _securityService;
        private readonly IWebRTCService _webRTCService;
        private readonly IImageProcessingService _imageProcessingService;

        // Chat properties
        private string connectionId;
        private string sharedPassword;
        private string inviteCode;
        private string newMessage;
        private ObservableCollection<ChatMessage> messages;
        private ImageProcessingSettings imageProcessingSettings;
        
        // WebRTC properties
        private bool isInCall;
        private bool isCallIncoming;
        private bool isVideoEnabled;
        private string callerName;
        private string localVideoStream;
        private string remoteVideoStream;

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

        public string NewMessage
        {
            get => newMessage;
            set => SetProperty(ref newMessage, value);
        }

        public ObservableCollection<ChatMessage> Messages
        {
            get => messages;
            set => SetProperty(ref messages, value);
        }

        public ImageProcessingSettings ImageProcessingSettings
        {
            get => imageProcessingSettings;
            set => SetProperty(ref imageProcessingSettings, value);
        }

        public bool IsInCall
        {
            get => isInCall;
            set => SetProperty(ref isInCall, value);
        }

        public bool IsCallIncoming
        {
            get => isCallIncoming;
            set => SetProperty(ref isCallIncoming, value);
        }

        public bool IsVideoEnabled
        {
            get => isVideoEnabled;
            set => SetProperty(ref isVideoEnabled, value);
        }

        public string CallerName
        {
            get => callerName;
            set => SetProperty(ref callerName, value);
        }

        public string LocalVideoStream
        {
            get => localVideoStream;
            set => SetProperty(ref localVideoStream, value);
        }

        public string RemoteVideoStream
        {
            get => remoteVideoStream;
            set => SetProperty(ref remoteVideoStream, value);
        }

        // Commands
        public ICommand SendMessageCommand { get; }
        public ICommand SendFileCommand { get; }
        public ICommand StartVideoCallCommand { get; }
        public ICommand AcceptCallCommand { get; }
        public ICommand RejectCallCommand { get; }
        public ICommand EndCallCommand { get; }
        public ICommand CopyInviteCodeCommand { get; }
        public ICommand UpdateImageProcessingSettingsCommand { get; }

        public ChatViewModel(
            IChatService chatService, 
            ISecurityService securityService,
            IWebRTCService webRTCService,
            IImageProcessingService imageProcessingService)
        {
            Title = "AN0 Secure Chat";
            _chatService = chatService;
            _securityService = securityService;
            _webRTCService = webRTCService;
            _imageProcessingService = imageProcessingService;

            Messages = new ObservableCollection<ChatMessage>();
            ImageProcessingSettings = new ImageProcessingSettings();

            // Initialize commands
            SendMessageCommand = new Command(async () => await SendMessageAsync());
            SendFileCommand = new Command(async () => await PickAndSendFileAsync());
            StartVideoCallCommand = new Command(async () => await StartVideoCallAsync());
            AcceptCallCommand = new Command(async () => await AcceptCallAsync());
            RejectCallCommand = new Command(async () => await RejectCallAsync());
            EndCallCommand = new Command(async () => await EndCallAsync());
            CopyInviteCodeCommand = new Command(CopyInviteCodeToClipboard);
            UpdateImageProcessingSettingsCommand = new Command(async () => await UpdateImageProcessingSettingsAsync());

            // Subscribe to chat service events
            _chatService.UserJoined += OnUserJoined;
            _chatService.MessageReceived += OnMessageReceived;
            _chatService.FileReceived += OnFileReceived;
            _chatService.VideoCallOfferReceived += OnVideoCallOfferReceived;
            _chatService.VideoCallAnswerReceived += OnVideoCallAnswerReceived;
            _chatService.IceCandidateReceived += OnIceCandidateReceived;
            _chatService.CallRejected += OnCallRejected;
            _chatService.CallEnded += OnCallEnded;
            _chatService.ImageProcessingSettingsUpdated += OnImageProcessingSettingsUpdated;
            _chatService.ErrorOccurred += OnErrorOccurred;

            // Subscribe to WebRTC service events
            _webRTCService.LocalStreamCreated += OnLocalStreamCreated;
            _webRTCService.RemoteStreamCreated += OnRemoteStreamCreated;
            _webRTCService.IceCandidateCreated += OnIceCandidateCreated;
        }

        public async Task InitializeAsync(string connectionId, string sharedPassword = null, string inviteCode = null)
        {
            ConnectionId = connectionId;
            SharedPassword = sharedPassword;
            InviteCode = inviteCode;

            try
            {
                // Add system message
                AddSystemMessage("Connecting to chat server...");

                await _chatService.ConnectAsync();

                // Initialize WebRTC
                await _webRTCService.InitializeAsync();

                AddSystemMessage("Connected to chat server.");

                // Join the chat based on the parameters
                if (!string.IsNullOrEmpty(inviteCode))
                {
                    AddSystemMessage("Joining with invite code...");
                    await _chatService.JoinWithInviteCodeAsync(inviteCode, connectionId);
                }
                else if (!string.IsNullOrEmpty(sharedPassword))
                {
                    string passwordHash = _securityService.HashPassword(sharedPassword);
                    AddSystemMessage("Joining chat room...");
                    await _chatService.JoinChatAsync(connectionId, passwordHash);
                }
            }
            catch (Exception ex)
            {
                AddSystemMessage($"Error: {ex.Message}", true);
            }
        }

        private async Task SendMessageAsync()
        {
            if (string.IsNullOrWhiteSpace(NewMessage))
                return;

            try
            {
                string encryptedMessage = _securityService.EncryptMessage(NewMessage, SharedPassword);

                await _chatService.SendMessageAsync(ConnectionId, NewMessage, "all", encryptedMessage);

                // Add message to the local chat
                var message = new ChatMessage
                {
                    Sender = ConnectionId,
                    Content = NewMessage,
                    IsCurrentUser = true
                };

                AddMessage(message);

                // Clear the message input
                NewMessage = string.Empty;
            }
            catch (Exception ex)
            {
                AddSystemMessage($"Failed to send message: {ex.Message}", true);
            }
        }

        private async Task PickAndSendFileAsync()
        {
            try
            {
                var customFileType = new FilePickerFileType(
                    new Dictionary<DevicePlatform, IEnumerable<string>>
                    {
                        { DevicePlatform.iOS, new[] { "public.item" } },
                        { DevicePlatform.Android, new[] { "*/*" } },
                        { DevicePlatform.WinUI, new[] { "*" } },
                        { DevicePlatform.MacCatalyst, new[] { "public.item" } }
                    });

                var options = new PickOptions
                {
                    PickerTitle = "Please select a file",
                    FileTypes = customFileType,
                };

                var result = await FilePicker.PickAsync(options);
                if (result == null)
                    return;

                var fileStream = await result.OpenReadAsync();
                using MemoryStream ms = new MemoryStream();
                await fileStream.CopyToAsync(ms);
                byte[] fileBytes = ms.ToArray();

                string encryptedFile = _securityService.EncryptFile(fileBytes, SharedPassword);
                var fileInfo = new
                {
                    Name = result.FileName,
                    Type = result.ContentType,
                    Data = encryptedFile
                };

                string fileInfoJson = System.Text.Json.JsonSerializer.Serialize(fileInfo);
                await _chatService.SendFileAsync(ConnectionId, result.FileName, "all", fileInfoJson);

                // Add file message to the local chat
                var message = new ChatMessage
                {
                    Sender = ConnectionId,
                    Content = $"Sent file: {result.FileName}",
                    IsCurrentUser = true,
                    IsFileMessage = true,
                    FileName = result.FileName,
                    FileType = result.ContentType,
                    FileData = Convert.ToBase64String(fileBytes)
                };

                AddMessage(message);
            }
            catch (Exception ex)
            {
                AddSystemMessage($"Failed to send file: {ex.Message}", true);
            }
        }

        private async Task StartVideoCallAsync()
        {
            try
            {
                IsInCall = true;
                IsVideoEnabled = true;

                // Start the local video
                await _webRTCService.StartLocalVideoAsync();

                // Create an offer and send it
                string offer = await _webRTCService.CreateOfferAsync();
                await _chatService.SendVideoCallOfferAsync(offer, "all");

                AddSystemMessage("Starting video call...");
            }
            catch (Exception ex)
            {
                IsInCall = false;
                IsVideoEnabled = false;
                AddSystemMessage($"Failed to start video call: {ex.Message}", true);
            }
        }

        private async Task AcceptCallAsync()
        {
            try
            {
                IsCallIncoming = false;
                IsInCall = true;
                IsVideoEnabled = true;

                // Start the local video
                await _webRTCService.StartLocalVideoAsync();

                AddSystemMessage($"Accepted call from {CallerName}");
            }
            catch (Exception ex)
            {
                IsInCall = false;
                IsVideoEnabled = false;
                AddSystemMessage($"Failed to accept call: {ex.Message}", true);
            }
        }

        private async Task RejectCallAsync()
        {
            try
            {
                IsCallIncoming = false;
                await _chatService.SendCallRejectedAsync("all");
                AddSystemMessage($"Rejected call from {CallerName}");
            }
            catch (Exception ex)
            {
                AddSystemMessage($"Failed to reject call: {ex.Message}", true);
            }
        }

        private async Task EndCallAsync()
        {
            try
            {
                IsInCall = false;
                IsVideoEnabled = false;
                IsCallIncoming = false;

                // Stop the local video
                await _webRTCService.StopLocalVideoAsync();
                await _webRTCService.EndCallAsync();
                await _chatService.SendCallEndedAsync("all");

                // Clear video streams
                LocalVideoStream = null;
                RemoteVideoStream = null;

                AddSystemMessage("Call ended");
            }
            catch (Exception ex)
            {
                AddSystemMessage($"Failed to end call: {ex.Message}", true);
            }
        }

        private void CopyInviteCodeToClipboard()
        {
            if (string.IsNullOrEmpty(InviteCode))
                return;

            try
            {
                Clipboard.SetTextAsync(InviteCode);
                AddSystemMessage("Invite code copied to clipboard");
            }
            catch (Exception ex)
            {
                AddSystemMessage($"Failed to copy invite code: {ex.Message}", true);
            }
        }

        private async Task UpdateImageProcessingSettingsAsync()
        {
            try
            {
                await _chatService.UpdateImageProcessingSettingsAsync(ImageProcessingSettings);
            }
            catch (Exception ex)
            {
                AddSystemMessage($"Failed to update image processing settings: {ex.Message}", true);
            }
        }

        #region Event Handlers
        private void OnUserJoined(object sender, string userId)
        {
            AddSystemMessage($"User {userId} joined the chat");
        }

        private void OnMessageReceived(object sender, Tuple<string, string, string> messageInfo)
        {
            string userId = messageInfo.Item1;
            string originalMessage = messageInfo.Item2;
            string encryptedMessage = messageInfo.Item3;

            string decryptedMessage = _securityService.DecryptMessage(encryptedMessage, SharedPassword);

            var message = new ChatMessage
            {
                Sender = userId,
                Content = decryptedMessage,
                IsCurrentUser = userId == ConnectionId
            };

            AddMessage(message);
        }

        private void OnFileReceived(object sender, Tuple<string, string, string> fileInfo)
        {
            string userId = fileInfo.Item1;
            string fileName = fileInfo.Item2;
            string encryptedFileInfo = fileInfo.Item3;

            try
            {
                var fileData = System.Text.Json.JsonSerializer.Deserialize<dynamic>(encryptedFileInfo);
                string encryptedFile = fileData.Data.ToString();
                string fileType = fileData.Type.ToString();

                byte[] decryptedFile = _securityService.DecryptFile(encryptedFile, SharedPassword);

                var message = new ChatMessage
                {
                    Sender = userId,
                    Content = $"Received file: {fileName}",
                    IsCurrentUser = false,
                    IsFileMessage = true,
                    FileName = fileName,
                    FileType = fileType,
                    FileData = Convert.ToBase64String(decryptedFile)
                };

                AddMessage(message);
            }
            catch (Exception ex)
            {
                AddSystemMessage($"Failed to process received file: {ex.Message}", true);
            }
        }

        private async void OnVideoCallOfferReceived(object sender, string offer)
        {
            try
            {
                // Store the caller's connection ID
                CallerName = "Someone"; // In a real app, you'd have a way to map connection IDs to names

                // Show the incoming call UI
                IsCallIncoming = true;

                // Set the remote description
                await _webRTCService.SetRemoteDescriptionAsync(offer, true);
            }
            catch (Exception ex)
            {
                AddSystemMessage($"Failed to process call offer: {ex.Message}", true);
            }
        }

        private async void OnVideoCallAnswerReceived(object sender, string answer)
        {
            try
            {
                await _webRTCService.SetRemoteDescriptionAsync(answer, false);
            }
            catch (Exception ex)
            {
                AddSystemMessage($"Failed to process call answer: {ex.Message}", true);
            }
        }

        private async void OnIceCandidateReceived(object sender, string candidate)
        {
            try
            {
                await _webRTCService.AddIceCandidateAsync(candidate);
            }
            catch (Exception ex)
            {
                AddSystemMessage($"Failed to process ICE candidate: {ex.Message}", true);
            }
        }

        private void OnCallRejected(object sender, EventArgs e)
        {
            IsInCall = false;
            IsVideoEnabled = false;
            AddSystemMessage("Call was rejected");
        }

        private async void OnCallEnded(object sender, EventArgs e)
        {
            IsInCall = false;
            IsVideoEnabled = false;
            await _webRTCService.StopLocalVideoAsync();
            await _webRTCService.EndCallAsync();
            LocalVideoStream = null;
            RemoteVideoStream = null;
            AddSystemMessage("Call was ended by the other party");
        }

        private void OnImageProcessingSettingsUpdated(object sender, ImageProcessingSettings settings)
        {
            ImageProcessingSettings = settings;
        }

        private void OnErrorOccurred(object sender, string error)
        {
            AddSystemMessage($"Error: {error}", true);
        }

        private void OnLocalStreamCreated(object sender, string streamInfo)
        {
            LocalVideoStream = streamInfo;
        }

        private void OnRemoteStreamCreated(object sender, string streamInfo)
        {
            RemoteVideoStream = streamInfo;
        }

        private async void OnIceCandidateCreated(object sender, string candidate)
        {
            try
            {
                await _chatService.SendIceCandidateAsync(candidate, "all");
            }
            catch (Exception ex)
            {
                AddSystemMessage($"Failed to send ICE candidate: {ex.Message}", true);
            }
        }
        #endregion

        #region Helper Methods
        private void AddMessage(ChatMessage message)
        {
            MainThread.BeginInvokeOnMainThread(() =>
            {
                Messages.Add(message);
            });
        }

        private void AddSystemMessage(string message, bool isError = false)
        {
            var systemMessage = new ChatMessage
            {
                Sender = "System",
                Content = message,
                IsSystemMessage = true,
                IsError = isError
            };

            AddMessage(systemMessage);
        }
        #endregion

        // Clean up resources when the view model is no longer needed
        public async Task CleanupAsync()
        {
            // Unsubscribe from events
            _chatService.UserJoined -= OnUserJoined;
            _chatService.MessageReceived -= OnMessageReceived;
            _chatService.FileReceived -= OnFileReceived;
            _chatService.VideoCallOfferReceived -= OnVideoCallOfferReceived;
            _chatService.VideoCallAnswerReceived -= OnVideoCallAnswerReceived;
            _chatService.IceCandidateReceived -= OnIceCandidateReceived;
            _chatService.CallRejected -= OnCallRejected;
            _chatService.CallEnded -= OnCallEnded;
            _chatService.ImageProcessingSettingsUpdated -= OnImageProcessingSettingsUpdated;
            _chatService.ErrorOccurred -= OnErrorOccurred;

            _webRTCService.LocalStreamCreated -= OnLocalStreamCreated;
            _webRTCService.RemoteStreamCreated -= OnRemoteStreamCreated;
            _webRTCService.IceCandidateCreated -= OnIceCandidateCreated;

            // End the call if in progress
            if (IsInCall)
            {
                await EndCallAsync();
            }

            // Disconnect from the chat service
            await _chatService.DisconnectAsync();
        }
    }
} 