using Microsoft.Extensions.Logging;
using CommunityToolkit.Maui;
using An0_Mobile.Services;
using An0_Mobile.Views;
using An0_Mobile.ViewModels;
using System.Net;
using System.Net.Http;

namespace An0_Mobile;

public static class MauiProgram
{
	public static MauiApp CreateMauiApp()
	{
		var builder = MauiApp.CreateBuilder();
		builder
			.UseMauiApp<App>()
			.UseMauiCommunityToolkit()
			.ConfigureFonts(fonts =>
			{
				fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
				fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
			});

#if DEBUG
		builder.Logging.AddDebug();
		
		// HTTPS sertifika doğrulama devre dışı bırakma (sadece geliştirme için)
		ServicePointManager.ServerCertificateValidationCallback += (sender, cert, chain, sslPolicyErrors) => true;
#endif

		// Özel HTTP istemci yapılandırması
		builder.Services.AddSingleton<HttpClient>(serviceProvider => 
		{
			var handler = new HttpClientHandler
			{
				ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator,
				UseProxy = false
			};
			
			return new HttpClient(handler)
			{
				Timeout = TimeSpan.FromSeconds(30)
			};
		});

		// Register services
		builder.Services.AddSingleton<IChatService, ChatService>();
		builder.Services.AddSingleton<ISecurityService, SecurityService>();
		builder.Services.AddSingleton<IWebRTCService, WebRTCService>();
		builder.Services.AddSingleton<IImageProcessingService, ImageProcessingService>();

		// Register pages
		builder.Services.AddTransient<ConnectPage>();
		builder.Services.AddTransient<ChatPage>();

		// Register view models
		builder.Services.AddTransient<ConnectViewModel>();
		builder.Services.AddTransient<ChatViewModel>();

		return builder.Build();
	}
}
