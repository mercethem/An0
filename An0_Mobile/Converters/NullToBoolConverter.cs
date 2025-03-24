using System;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace An0_Mobile.Converters
{
    public class NullToBoolConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            bool invert = parameter is string paramStr && paramStr.ToLower() == "invert";
            bool result = value != null;
            
            return invert ? !result : result;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
} 