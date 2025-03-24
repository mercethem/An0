using System.ComponentModel;
using System.Text.Json.Serialization;

namespace An0_Mobile.Models
{
    public class ImageProcessingSettings : INotifyPropertyChanged
    {
        private bool faceDetection;
        private bool objectDetection;
        private bool backgroundRemoval;
        private string activeFilter = "none";
        private double brightness;
        private double contrast;

        [JsonPropertyName("faceDetection")]
        public bool FaceDetection
        {
            get => faceDetection;
            set
            {
                if (faceDetection != value)
                {
                    faceDetection = value;
                    OnPropertyChanged(nameof(FaceDetection));
                }
            }
        }

        [JsonPropertyName("objectDetection")]
        public bool ObjectDetection
        {
            get => objectDetection;
            set
            {
                if (objectDetection != value)
                {
                    objectDetection = value;
                    OnPropertyChanged(nameof(ObjectDetection));
                }
            }
        }

        [JsonPropertyName("backgroundRemoval")]
        public bool BackgroundRemoval
        {
            get => backgroundRemoval;
            set
            {
                if (backgroundRemoval != value)
                {
                    backgroundRemoval = value;
                    OnPropertyChanged(nameof(BackgroundRemoval));
                }
            }
        }

        [JsonPropertyName("activeFilter")]
        public string ActiveFilter
        {
            get => activeFilter;
            set
            {
                if (activeFilter != value)
                {
                    activeFilter = value;
                    OnPropertyChanged(nameof(ActiveFilter));
                }
            }
        }

        [JsonPropertyName("brightness")]
        public double Brightness
        {
            get => brightness;
            set
            {
                if (brightness != value)
                {
                    brightness = value;
                    OnPropertyChanged(nameof(Brightness));
                }
            }
        }

        [JsonPropertyName("contrast")]
        public double Contrast
        {
            get => contrast;
            set
            {
                if (contrast != value)
                {
                    contrast = value;
                    OnPropertyChanged(nameof(Contrast));
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