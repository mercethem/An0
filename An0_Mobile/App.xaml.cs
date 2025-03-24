using An0_Mobile.Views;
using Microsoft.Maui.Controls;

namespace An0_Mobile;

public partial class App : Application
{
	public App()
	{
		InitializeComponent();
		
		MainPage = new AppShell();
	}

	protected override Window CreateWindow(IActivationState? activationState)
	{
		var window = base.CreateWindow(activationState);
		
		// İsteğe bağlı - pencere boyutu ve başlık ayarları
		if (window != null)
		{
			window.Title = "AN0 Secure Chat";
		}
		
		return window;
	}
}