using System;
using System.Globalization;
using System.IO;
using Microsoft.Maui.Controls;

namespace An0_Mobile.Converters
{
    public class ImageSourceConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value == null)
                return null;

            if (value is string path && !string.IsNullOrEmpty(path))
            {
                if (Path.IsPathRooted(path))
                    return ImageSource.FromFile(path);
                else
                    return ImageSource.FromFile(path);
            }
            else if (value is byte[] imageBytes && imageBytes.Length > 0)
            {
                return ImageSource.FromStream(() => new MemoryStream(imageBytes));
            }

            return null;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
} 