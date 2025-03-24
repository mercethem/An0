using An0_Mobile.ViewModels;

namespace An0_Mobile.Views;

public partial class ConnectPage : ContentPage
{
    private readonly ConnectViewModel _viewModel;

    public ConnectPage(ConnectViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        BindingContext = _viewModel;
    }
} 