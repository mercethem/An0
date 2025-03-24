namespace An0_Mobile.Constants
{
    public static class AppConstants
    {
        // Emülatör için SignalR Hub URL - HTTPS ve 10001 portu ile güncellendi
        public const string SignalRHubUrl = "https://10.0.2.2:10001/chathub";
        
        // Fiziksel cihazdan test etmek isterseniz, bu seçenekleri kullanabilirsiniz:
        // Ethernet bağlantısı: public const string SignalRHubUrl = "https://192.168.1.100:10001/chathub";
        // WSL bağlantısı: public const string SignalRHubUrl = "https://172.28.144.1:10001/chathub";
        
        // Default turn server config for WebRTC
        public const string IceServerUrl = "stun:stun.l.google.com:19302";
        
        // Image processing API URL - emülatör için ayarlandı (HTTPS 10001 portu)
        public const string ImageProcessingApiUrl = "https://10.0.2.2:10001";
        // Fiziksel cihaz için alternatifler:
        // public const string ImageProcessingApiUrl = "https://192.168.1.100:10001";
        // public const string ImageProcessingApiUrl = "https://172.28.144.1:10001";
        
        // Video settings
        public const int DefaultVideoWidth = 640;
        public const int DefaultVideoHeight = 480;
        public const int DefaultFrameRate = 30;
        
        // Encryption key size
        public const int EncryptionKeySize = 256;
        
        // Filter types
        public static readonly string[] FilterTypes = new[]
        {
            "none",
            "grayscale",
            "sepia",
            "blur",
            "edge-detection",
            "invert"
        };
    }
} 