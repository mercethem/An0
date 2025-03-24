using An0_Mobile.Models;
using System;
using System.Threading.Tasks;

namespace An0_Mobile.Services
{
    public interface IImageProcessingService
    {
        Task<byte[]> ProcessImageAsync(byte[] imageData, ImageProcessingSettings settings);
        Task<byte[]> ApplyFilterAsync(byte[] imageData, string filterType);
        Task<byte[]> AdjustBrightnessContrastAsync(byte[] imageData, double brightness, double contrast);
        Task<byte[]> DetectFacesAsync(byte[] imageData);
        Task<byte[]> DetectObjectsAsync(byte[] imageData);
        Task<byte[]> RemoveBackgroundAsync(byte[] imageData);
        byte[] ConvertBase64ToBytes(string base64String);
        string ConvertBytesToBase64(byte[] bytes);
    }
} 