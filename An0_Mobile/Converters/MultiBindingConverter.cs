using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Microsoft.Maui.Controls;

namespace An0_Mobile.Converters
{
    public class MultiBindingConverter : IMultiValueConverter
    {
        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            if (values == null || !values.Any())
                return false;

            // Default behavior is logical AND (all values must be true)
            string operation = parameter as string ?? "AND";
            
            switch (operation.ToUpper())
            {
                case "AND":
                    return values.All(v => v is bool b && b);
                
                case "OR":
                    return values.Any(v => v is bool b && b);
                
                case "ALL_NOT_NULL":
                    return values.All(v => v != null);
                
                case "ANY_NOT_NULL":
                    return values.Any(v => v != null);
                
                default:
                    return false;
            }
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
} 