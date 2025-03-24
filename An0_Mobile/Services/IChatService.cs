using An0_Mobile.Models;
using System;
using System.Threading.Tasks;

namespace An0_Mobile.Services
{
    public interface IChatService
    {
        Task ConnectAsync();
        Task DisconnectAsync();
        Task JoinChatAsync(string connectionId, string passwordHash);
        Task JoinWithInviteCodeAsync(string inviteCode, string connectionId);
        Task<string> CreateRoomAsync(string connectionId, string passwordHash);
        Task SendMessageAsync(string user, string message, string recipient, string encryptedMessage);
        Task SendFileAsync(string user, string fileName, string recipient, string encryptedFileInfo);
        Task SendVideoCallOfferAsync(string offer, string recipient);
        Task SendVideoCallAnswerAsync(string answer, string recipient);
        Task SendIceCandidateAsync(string candidate, string recipient);
        Task SendCallRejectedAsync(string recipient);
        Task SendCallEndedAsync(string recipient);
        Task UpdateImageProcessingSettingsAsync(ImageProcessingSettings settings);
        Task SendProcessedFrameAsync(string frameData);
        
        // Events
        event EventHandler<string> UserJoined;
        event EventHandler<Tuple<string, string, string>> MessageReceived;
        event EventHandler<Tuple<string, string, string>> FileReceived;
        event EventHandler<string> VideoCallOfferReceived;
        event EventHandler<string> VideoCallAnswerReceived;
        event EventHandler<string> IceCandidateReceived;
        event EventHandler CallRejected;
        event EventHandler CallEnded;
        event EventHandler<ImageProcessingSettings> ImageProcessingSettingsUpdated;
        event EventHandler<string> ProcessedFrameReceived;
        event EventHandler<string> ErrorOccurred;
    }
} 