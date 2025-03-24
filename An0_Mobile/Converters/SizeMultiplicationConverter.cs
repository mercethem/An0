using System;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace An0_Mobile.Converters
{
    public class SizeMultiplicationConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value == null || parameter == null)
                return 0;

            double size = 0;
            double factor = 1;

            // Try to parse the input value
            if (value is double doubleValue)
                size = doubleValue;
            else if (value is int intValue)
                size = intValue;
            else if (value is float floatValue)
                size = floatValue;
            else if (double.TryParse(value.ToString(), out double parsedValue))
                size = parsedValue;

            // Try to parse the parameter value
            if (parameter is double doubleParam)
                factor = doubleParam;
            else if (parameter is int intParam)
                factor = intParam;
            else if (parameter is float floatParam)
                factor = floatParam;
            else if (double.TryParse(parameter.ToString(), out double parsedParam))
                factor = parsedParam;

            return size * factor;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value == null || parameter == null)
                return 0;

            double size = 0;
            double factor = 1;

            // Try to parse the input value
            if (value is double doubleValue)
                size = doubleValue;
            else if (value is int intValue)
                size = intValue;
            else if (value is float floatValue)
                size = floatValue;
            else if (double.TryParse(value.ToString(), out double parsedValue))
                size = parsedValue;

            // Try to parse the parameter value
            if (parameter is double doubleParam)
                factor = doubleParam;
            else if (parameter is int intParam)
                factor = intParam;
            else if (parameter is float floatParam)
                factor = floatParam;
            else if (double.TryParse(parameter.ToString(), out double parsedParam))
                factor = parsedParam;

            if (factor == 0)
                return 0;

            return size / factor;
        }
    }
} 