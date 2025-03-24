using System;

namespace An0_Mobile.Models
{
    public class ChatMessage
    {
        public string Sender { get; set; }
        public string Content { get; set; }
        public DateTime Timestamp { get; set; }
        public bool IsSystemMessage { get; set; }
        public bool IsCurrentUser { get; set; }
        public bool IsError { get; set; }
        public bool IsFileMessage { get; set; }
        public string FileName { get; set; }
        public string FileData { get; set; }
        public string FileType { get; set; }

        public ChatMessage()
        {
            Sender = string.Empty;
            Content = string.Empty;
            Timestamp = DateTime.Now;
            FileName = string.Empty;
            FileData = string.Empty; 
            FileType = string.Empty;
        }
    }
} 