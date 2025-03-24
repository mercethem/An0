using System;
using System.Threading.Tasks;

namespace An0_Mobile.Services
{
    public interface IWebRTCService
    {
        Task InitializeAsync();
        Task StartLocalVideoAsync();
        Task StopLocalVideoAsync();
        Task<string> CreateOfferAsync();
        Task<string> CreateAnswerAsync(string offer);
        Task SetRemoteDescriptionAsync(string sdp, bool isOffer);
        Task AddIceCandidateAsync(string candidate);
        Task EndCallAsync();
        
        event EventHandler<string> LocalStreamCreated;
        event EventHandler<string> RemoteStreamCreated;
        event EventHandler<string> IceCandidateCreated;
    }
} 