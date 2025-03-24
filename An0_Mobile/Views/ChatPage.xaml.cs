using An0_Mobile.ViewModels;

namespace An0_Mobile.Views;

[QueryProperty(nameof(ConnectionId), "connectionId")]
[QueryProperty(nameof(SharedPassword), "sharedPassword")]
[QueryProperty(nameof(InviteCode), "inviteCode")]
public partial class ChatPage : ContentPage
{
    private readonly ChatViewModel _viewModel;
    
    public string ConnectionId { get; set; }
    public string SharedPassword { get; set; }
    public string InviteCode { get; set; }

    public ChatPage(ChatViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        BindingContext = _viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        
        // Initialize the chat
        await _viewModel.InitializeAsync(ConnectionId, SharedPassword, InviteCode);
    }

    protected override async void OnDisappearing()
    {
        base.OnDisappearing();
        
        // Clean up resources
        await _viewModel.CleanupAsync();
    }
} 