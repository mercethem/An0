using System.Text.Json.Serialization;

namespace An0.Models
{
    public class ImageProcessingSettings
    {
        [JsonPropertyName("faceDetection")]
        public bool FaceDetection { get; set; }

        [JsonPropertyName("objectDetection")]
        public bool ObjectDetection { get; set; }

        [JsonPropertyName("backgroundRemoval")]
        public bool BackgroundRemoval { get; set; }

        [JsonPropertyName("activeFilter")]
        public string ActiveFilter { get; set; } = "none";

        [JsonPropertyName("brightness")]
        public double Brightness { get; set; }

        [JsonPropertyName("contrast")]
        public double Contrast { get; set; }
    }
} 