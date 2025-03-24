using System.ComponentModel;

namespace An0_Mobile.Models
{
    public class ChatViewModel : INotifyPropertyChanged
    {
        private string connectionId = string.Empty;
        private string sharedPassword = string.Empty;

        public string ConnectionId 
        { 
            get => connectionId; 
            set 
            { 
                if (connectionId != value)
                {
                    connectionId = value;
                    OnPropertyChanged(nameof(ConnectionId));
                }
            } 
        }

        public string SharedPassword 
        { 
            get => sharedPassword; 
            set 
            { 
                if (sharedPassword != value)
                {
                    sharedPassword = value;
                    OnPropertyChanged(nameof(SharedPassword));
                }
            }
        }

        public event PropertyChangedEventHandler PropertyChanged;

        protected virtual void OnPropertyChanged(string propertyName)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }
    }
} 