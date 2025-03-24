using An0_Mobile.Views;
using An0_Mobile.ViewModels;
using Microsoft.Extensions.DependencyInjection;

namespace An0_Mobile;

public partial class AppShell : Shell
{
	public AppShell()
	{
		InitializeComponent();
		
		// Register routes for navigation
		Routing.RegisterRoute(nameof(ChatPage), typeof(ChatPage));
		Routing.RegisterRoute(nameof(ConnectPage), typeof(ConnectPage));
	}
}
