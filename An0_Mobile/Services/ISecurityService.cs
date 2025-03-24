using System;
using System.Threading.Tasks;

namespace An0_Mobile.Services
{
    public interface ISecurityService
    {
        string GenerateConnectionId();
        string GenerateStrongPassword(int length = 16);
        string HashPassword(string password);
        string EncryptMessage(string message, string password);
        string DecryptMessage(string encryptedMessage, string password);
        string EncryptFile(byte[] fileData, string password);
        byte[] DecryptFile(string encryptedFileString, string password);
        Task<string> DecodeInviteCodeAsync(string inviteCode);
    }
} 