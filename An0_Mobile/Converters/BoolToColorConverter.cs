using System;
using System.Globalization;
using Microsoft.Maui.Controls;
using Microsoft.Maui.Graphics;
using System.Reflection;

namespace An0_Mobile.Converters
{
    public class BoolToColorConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is bool boolValue)
            {
                if (parameter is string paramStr)
                {
                    string[] colors = paramStr.Split(',');
                    if (colors.Length == 2)
                    {
                        string targetColor = boolValue ? colors[0].Trim() : colors[1].Trim();
                        
                        // Try to get color by name using reflection on Colors class
                        if (TryGetColorByName(targetColor, out Color color))
                            return color;
                        
                        // Try to parse hex color
                        if (Color.TryParse(targetColor, out Color parsedColor))
                            return parsedColor;
                    }
                }

                // Default colors if no parameter or parsing failed
                return boolValue ? Colors.Green : Colors.Red;
            }
            
            return Colors.Gray;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
        
        private bool TryGetColorByName(string colorName, out Color color)
        {
            // Look for a property with the given name in the Colors class
            PropertyInfo? colorProperty = typeof(Colors).GetProperty(colorName, 
                BindingFlags.Public | BindingFlags.Static | BindingFlags.IgnoreCase);
                
            if (colorProperty != null)
            {
                color = (Color)colorProperty.GetValue(null);
                return true;
            }
            
            color = Colors.Transparent;
            return false;
        }
    }
} 