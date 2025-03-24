using An0_Mobile.Constants;
using Microsoft.AspNetCore.SignalR.Client;
using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;

namespace An0_Mobile.Services
{
    public class SecurityService : ISecurityService
    {
        private readonly Random _random = new Random();
        private readonly HubConnection _hubConnection;

        public SecurityService()
        {
            _hubConnection = new HubConnectionBuilder()
                .WithUrl(AppConstants.SignalRHubUrl)
                .WithAutomaticReconnect()
                .Build();
        }

        public string GenerateConnectionId()
        {
            return "connection_" + Guid.NewGuid().ToString("N").Substring(0, 8);
        }

        public string GenerateStrongPassword(int length = 16)
        {
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
            StringBuilder sb = new StringBuilder();

            for (int i = 0; i < length; i++)
            {
                int index = _random.Next(chars.Length);
                sb.Append(chars[index]);
            }

            return sb.ToString();
        }

        public string HashPassword(string password)
        {
            using (SHA256 sha256 = SHA256.Create())
            {
                byte[] bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
                StringBuilder builder = new StringBuilder();

                for (int i = 0; i < bytes.Length; i++)
                {
                    builder.Append(bytes[i].ToString("x2"));
                }

                return builder.ToString();
            }
        }

        public string EncryptMessage(string message, string password)
        {
            if (string.IsNullOrEmpty(message))
                return string.Empty;

            try
            {
                byte[] key = DeriveKeyFromPassword(password, AppConstants.EncryptionKeySize);
                byte[] iv = new byte[16];
                using (RNGCryptoServiceProvider rng = new RNGCryptoServiceProvider())
                {
                    rng.GetBytes(iv);
                }

                using (Aes aes = Aes.Create())
                {
                    aes.Key = key;
                    aes.IV = iv;

                    ICryptoTransform encryptor = aes.CreateEncryptor(aes.Key, aes.IV);

                    using (MemoryStream ms = new MemoryStream())
                    {
                        ms.Write(iv, 0, iv.Length);

                        using (CryptoStream cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
                        {
                            using (StreamWriter sw = new StreamWriter(cs))
                            {
                                sw.Write(message);
                            }
                        }

                        return Convert.ToBase64String(ms.ToArray());
                    }
                }
            }
            catch
            {
                return string.Empty;
            }
        }

        public string DecryptMessage(string encryptedMessage, string password)
        {
            if (string.IsNullOrEmpty(encryptedMessage))
                return string.Empty;

            try
            {
                byte[] fullCipher = Convert.FromBase64String(encryptedMessage);
                byte[] iv = new byte[16];
                byte[] cipher = new byte[fullCipher.Length - iv.Length];

                Buffer.BlockCopy(fullCipher, 0, iv, 0, iv.Length);
                Buffer.BlockCopy(fullCipher, iv.Length, cipher, 0, cipher.Length);

                byte[] key = DeriveKeyFromPassword(password, AppConstants.EncryptionKeySize);

                using (Aes aes = Aes.Create())
                {
                    aes.Key = key;
                    aes.IV = iv;

                    ICryptoTransform decryptor = aes.CreateDecryptor(aes.Key, aes.IV);

                    using (MemoryStream ms = new MemoryStream(cipher))
                    {
                        using (CryptoStream cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read))
                        {
                            using (StreamReader sr = new StreamReader(cs))
                            {
                                return sr.ReadToEnd();
                            }
                        }
                    }
                }
            }
            catch
            {
                return string.Empty;
            }
        }

        public string EncryptFile(byte[] fileData, string password)
        {
            if (fileData == null || fileData.Length == 0)
                return string.Empty;

            try
            {
                byte[] key = DeriveKeyFromPassword(password, AppConstants.EncryptionKeySize);
                byte[] iv = new byte[16];
                using (RNGCryptoServiceProvider rng = new RNGCryptoServiceProvider())
                {
                    rng.GetBytes(iv);
                }

                using (Aes aes = Aes.Create())
                {
                    aes.Key = key;
                    aes.IV = iv;

                    ICryptoTransform encryptor = aes.CreateEncryptor(aes.Key, aes.IV);

                    using (MemoryStream ms = new MemoryStream())
                    {
                        ms.Write(iv, 0, iv.Length);

                        using (CryptoStream cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
                        {
                            cs.Write(fileData, 0, fileData.Length);
                            cs.FlushFinalBlock();
                        }

                        return Convert.ToBase64String(ms.ToArray());
                    }
                }
            }
            catch
            {
                return string.Empty;
            }
        }

        public byte[] DecryptFile(string encryptedFileString, string password)
        {
            if (string.IsNullOrEmpty(encryptedFileString))
                return Array.Empty<byte>();

            try
            {
                byte[] fullCipher = Convert.FromBase64String(encryptedFileString);
                byte[] iv = new byte[16];
                byte[] cipher = new byte[fullCipher.Length - iv.Length];

                Buffer.BlockCopy(fullCipher, 0, iv, 0, iv.Length);
                Buffer.BlockCopy(fullCipher, iv.Length, cipher, 0, cipher.Length);

                byte[] key = DeriveKeyFromPassword(password, AppConstants.EncryptionKeySize);

                using (Aes aes = Aes.Create())
                {
                    aes.Key = key;
                    aes.IV = iv;

                    ICryptoTransform decryptor = aes.CreateDecryptor(aes.Key, aes.IV);

                    using (MemoryStream ms = new MemoryStream())
                    {
                        using (CryptoStream cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Write))
                        {
                            cs.Write(cipher, 0, cipher.Length);
                            cs.FlushFinalBlock();
                        }

                        return ms.ToArray();
                    }
                }
            }
            catch
            {
                return Array.Empty<byte>();
            }
        }

        public async Task<string> DecodeInviteCodeAsync(string inviteCode)
        {
            try
            {
                await EnsureHubConnectionAsync();
                return await _hubConnection.InvokeAsync<string>("DecodeInviteCodeForClient", inviteCode);
            }
            catch
            {
                return string.Empty;
            }
        }

        private async Task EnsureHubConnectionAsync()
        {
            if (_hubConnection.State == HubConnectionState.Disconnected)
            {
                await _hubConnection.StartAsync();
            }
        }

        private byte[] DeriveKeyFromPassword(string password, int keySizeInBits)
        {
            const int iterations = 10000;
            byte[] salt = Encoding.UTF8.GetBytes("An0SecureChatSalt"); // Use a more secure salt in production

            using (var deriveBytes = new Rfc2898DeriveBytes(password, salt, iterations, HashAlgorithmName.SHA256))
            {
                return deriveBytes.GetBytes(keySizeInBits / 8);
            }
        }
    }
} 