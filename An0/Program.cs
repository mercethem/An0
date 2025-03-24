using An0.Hubs;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Generic;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

// Add ChatHub as a singleton for controller injection
builder.Services.AddSingleton<ChatHub>();

// SignalR servisini ekle
builder.Services.AddSignalR(options =>
{
    options.MaximumReceiveMessageSize = 102400000; // 100 MB
    options.EnableDetailedErrors = true; // Detaylı hata mesajları
});

// CORS politikasını yapılandır
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(builder =>
    {
        builder.SetIsOriginAllowed(_ => true) // Tüm origin'lere izin ver (geliştirme için)
               .AllowAnyHeader()
               .AllowAnyMethod()
               .AllowCredentials();
    });
});

builder.Services.AddHttpClient();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();
app.UseCors(); // CORS middleware'ini ekle

app.UseAuthorization();

// SignalR hub'ını yapılandır
app.MapHub<ChatHub>("/chathub", options =>
{
    options.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.WebSockets;
    options.WebSockets.CloseTimeout = TimeSpan.FromSeconds(30);
    options.LongPolling.PollTimeout = TimeSpan.FromSeconds(30);
});

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

builder.WebHost.UseUrls("http://*:10000", "https://*:10001");

app.Run();
