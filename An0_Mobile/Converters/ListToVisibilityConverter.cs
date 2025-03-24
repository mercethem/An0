using System;
using System.Collections;
using System.Globalization;
using Microsoft.Maui.Controls;

namespace An0_Mobile.Converters
{
    public class ListToVisibilityConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            bool invert = parameter is string paramStr && paramStr.ToLower() == "invert";
            bool hasItems = false;

            if (value is ICollection collection)
            {
                hasItems = collection.Count > 0;
            }
            else if (value is IEnumerable enumerable)
            {
                // Check if the enumerable has at least one item
                var enumerator = enumerable.GetEnumerator();
                hasItems = enumerator.MoveNext();
                
                // Dispose the enumerator if it's disposable
                if (enumerator is IDisposable disposable)
                {
                    disposable.Dispose();
                }
            }

            return invert ? !hasItems : hasItems;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
} 