using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;

namespace BladeSetup;

public partial class MainWindow : Window
{
    private CancellationTokenSource? _cancellationTokenSource;
    private double _currentPercent = 0;
    private string _currentTargetDir = string.Empty;
    private bool _isInstalling = false;

    private Action? _onModalPrimary;
    private Action? _onModalSecondary;

    public MainWindow()
    {
        InitializeComponent();
    }

    private void Window_Loaded(object sender, RoutedEventArgs e)
    {
        TargetFolderTextBox.Text = InstallerLogic.DefaultInstallPath;
        LicenseTextBox.Text = InstallerLogic.LoadLicenseText();
        // Версию показываем и в реестр пишем из data.zip (profile/chrome/VERSION)
        InstallerLogic.InitDetectedVersion(InstallerLogic.FindDataZipPath());
        VersionTextBlock.Text = "v" + InstallerLogic.DetectedVersion;
        ShowScreen(ScreenSplash);
    }

    // ================================================================
    // TITLE BAR ACTIONS (User Fix 1: DragMove strictly on TitleBar)
    // ================================================================
    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ButtonState == MouseButtonState.Pressed)
        {
            DragMove();
        }
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        if (_isInstalling)
        {
            ShowModalDialog(
                title: "Отмена установки",
                message: "Установка ещё не завершена. Вы уверены, что хотите отменить процесс и выйти?",
                primaryText: "Да, выйти",
                onPrimary: () =>
                {
                    _cancellationTokenSource?.Cancel();
                    Close();
                },
                secondaryText: "Продолжить",
                onSecondary: () => { }
            );
            return;
        }

        Close();
    }

    // ================================================================
    // SCREEN NAVIGATION
    // ================================================================
    private void ShowScreen(FrameworkElement targetScreen)
    {
        ScreenSplash.Visibility = Visibility.Collapsed;
        ScreenLicense.Visibility = Visibility.Collapsed;
        ScreenInstalling.Visibility = Visibility.Collapsed;
        ScreenDone.Visibility = Visibility.Collapsed;

        targetScreen.Visibility = Visibility.Visible;
    }

    // ================================================================
    // SCREEN 1: SPLASH & PATH
    // ================================================================
    private void BrowseFolder_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new Microsoft.Win32.OpenFolderDialog
        {
            Title = "Выберите папку для установки Blade",
            InitialDirectory = Directory.Exists(TargetFolderTextBox.Text)
                ? TargetFolderTextBox.Text
                : Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)
        };

        if (dialog.ShowDialog(this) == true)
        {
            TargetFolderTextBox.Text = dialog.FolderName;
        }
    }

    private void NextToLicenseButton_Click(object sender, RoutedEventArgs e)
    {
        string targetDir = TargetFolderTextBox.Text.Trim();
        if (string.IsNullOrWhiteSpace(targetDir))
        {
            ShowModalDialog(
                title: "Ошибка",
                message: "Пожалуйста, укажите путь для установки Blade.",
                primaryText: "Понятно",
                onPrimary: () => { }
            );
            return;
        }

        try
        {
            Path.GetFullPath(targetDir);
        }
        catch
        {
            ShowModalDialog(
                title: "Некорректный путь",
                message: "Указанный путь содержит недопустимые символы. Выберите другую папку.",
                primaryText: "Понятно",
                onPrimary: () => { }
            );
            return;
        }

        _currentTargetDir = targetDir;
        ShowScreen(ScreenLicense);
    }

    // ================================================================
    // SCREEN 2: LICENSE
    // ================================================================
    private void AcceptLicenseCheckBox_Changed(object sender, RoutedEventArgs e)
    {
        bool isAccepted = AcceptLicenseCheckBox.IsChecked == true;
        InstallFromLicenseButton.IsEnabled = isAccepted;
        InstallFromLicenseButton.Opacity = isAccepted ? 1.0 : 0.4;
    }

    private void BackToSplashButton_Click(object sender, RoutedEventArgs e)
    {
        ShowScreen(ScreenSplash);
    }

    private void StartInstallButton_Click(object sender, RoutedEventArgs e)
    {
        if (AcceptLicenseCheckBox.IsChecked != true) return;

        // Check 1: data.zip must exist
        string? dataZipPath = InstallerLogic.FindDataZipPath();
        if (dataZipPath == null)
        {
            ShowModalDialog(
                title: "Файл данных не найден",
                message: "Файл данных data.zip не найден рядом с установщиком.\n\nПожалуйста, скачайте установщик целиком и поместите data.zip в одну папку с Blade-Setup.exe.",
                primaryText: "Понятно",
                onPrimary: () => { }
            );
            return;
        }

        CheckAndProceedInstallation(dataZipPath);
    }

    private void CheckAndProceedInstallation(string dataZipPath)
    {
        // Check 2: Firefox running from target
        if (InstallerLogic.IsFirefoxRunningFromTarget(_currentTargetDir))
        {
            ShowModalDialog(
                title: "Blade запущен",
                message: "Обнаружен работающий процесс Firefox из папки установки.\n\nПожалуйста, закройте браузер перед продолжением.",
                primaryText: "Повторить",
                onPrimary: () => CheckAndProceedInstallation(dataZipPath),
                secondaryText: "Отмена",
                onSecondary: () => { }
            );
            return;
        }

        // Check 3: Detect update
        bool isUpdate = InstallerLogic.IsExistingInstallation(_currentTargetDir);
        if (isUpdate)
        {
            ShowModalDialog(
                title: "Обнаружена предыдущая установка",
                message: "В указанной папке обнаружен установленный Blade.\n\nОбновить существующую версию?\n\nДвижок и стили будут обновлены. Ваши личные данные (пароли, закладки, история, куки и добавленные обои) будут полностью сохранены.",
                primaryText: "Обновить",
                onPrimary: () => ExecuteInstallation(dataZipPath, isUpdate: true),
                secondaryText: "Отмена",
                onSecondary: () => { }
            );
            return;
        }

        // Clean installation
        ExecuteInstallation(dataZipPath, isUpdate: false);
    }

    // ================================================================
    // SCREEN 3: INSTALLING & PROGRESS
    // ================================================================
    private async void ExecuteInstallation(string dataZipPath, bool isUpdate)
    {
        _isInstalling = true;
        _cancellationTokenSource = new CancellationTokenSource();
        var token = _cancellationTokenSource.Token;

        ShowScreen(ScreenInstalling);
        UpdateProgress(0, "Подготовка к установке...", "Инициализация...");

        var progress = new Progress<InstallProgressReport>(report =>
        {
            UpdateProgress(report.Percent, report.Stage, report.CurrentItem);
        });

        try
        {
            if (isUpdate)
            {
                UpdateProgress(2, "Подготовка к обновлению...", "Очистка предыдущей версии движка...");
                await Task.Run(() => InstallerLogic.CleanForUpdate(_currentTargetDir), token);
            }

            // Extract data.zip with streaming real progress (User Fix 2)
            await InstallerLogic.ExtractDataZipAsync(dataZipPath, _currentTargetDir, progress, token);

            // Deploy icon & create shortcuts
            UpdateProgress(98, "Настройка ярлыков и системы...", "Копирование Blade.ico...");
            await Task.Run(() =>
            {
                InstallerLogic.DeployIcon(_currentTargetDir);
                bool createDesktop = Dispatcher.Invoke(() => CreateDesktopShortcutCheckBox.IsChecked == true);
                InstallerLogic.CreateShortcuts(_currentTargetDir, createDesktop);
                InstallerLogic.CreateUninstaller(_currentTargetDir);
            }, token);

            UpdateProgress(100, "Завершено!", "Blade готов к запуску.");
            await Task.Delay(350, token);

            _isInstalling = false;
            DoneTargetDirectoryTextBlock.Text = $"Папка: {_currentTargetDir}";
            DoneDesktopShortcutCheckBox.IsChecked = CreateDesktopShortcutCheckBox.IsChecked;
            ShowScreen(ScreenDone);
        }
        catch (OperationCanceledException)
        {
            _isInstalling = false;
            ShowScreen(ScreenSplash);
            ShowModalDialog(
                title: "Установка отменена",
                message: "Процесс установки был прерван пользователем.",
                primaryText: "Понятно",
                onPrimary: () => { }
            );
        }
        catch (Exception ex)
        {
            _isInstalling = false;
            ShowScreen(ScreenSplash);
            ShowModalDialog(
                title: "Ошибка установки",
                message: $"Во время установки произошла ошибка:\n{ex.Message}",
                primaryText: "Понятно",
                onPrimary: () => { }
            );
        }
    }

    private void UpdateProgress(double percent, string stage, string item)
    {
        _currentPercent = percent;
        InstallStageTextBlock.Text = stage;
        InstallDetailsTextBlock.Text = item;
        ProgressPercentTextBlock.Text = $"{Math.Round(percent)}%";

        double trackWidth = ProgressBarTrack.ActualWidth;
        if (trackWidth > 0)
        {
            ProgressBarFill.Width = Math.Max(0, Math.Min(trackWidth, trackWidth * (percent / 100.0)));
        }
    }

    private void ProgressBarTrack_SizeChanged(object sender, SizeChangedEventArgs e)
    {
        double trackWidth = ProgressBarTrack.ActualWidth;
        if (trackWidth > 0)
        {
            ProgressBarFill.Width = Math.Max(0, Math.Min(trackWidth, trackWidth * (_currentPercent / 100.0)));
        }
    }

    private void CancelInstallButton_Click(object sender, RoutedEventArgs e)
    {
        ShowModalDialog(
            title: "Прерывание",
            message: "Вы действительно хотите прервать установку Blade?",
            primaryText: "Да, прервать",
            onPrimary: () =>
            {
                _cancellationTokenSource?.Cancel();
            },
            secondaryText: "Продолжить",
            onSecondary: () => { }
        );
    }

    // ================================================================
    // SCREEN 4: DONE & LAUNCH
    // ================================================================
    private void DoneDesktopShortcutCheckBox_Changed(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrEmpty(_currentTargetDir)) return;
        bool wantShortcut = DoneDesktopShortcutCheckBox.IsChecked == true;
        InstallerLogic.CreateShortcuts(_currentTargetDir, wantShortcut);
    }

    private void LaunchBladeButton_Click(object sender, RoutedEventArgs e)
    {
        InstallerLogic.LaunchBlade(_currentTargetDir);
        Close();
    }

    private void ExitButton_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    // ================================================================
    // IN-WINDOW MODAL DIALOG
    // ================================================================
    private void ShowModalDialog(
        string title,
        string message,
        string primaryText,
        Action? onPrimary,
        string? secondaryText = null,
        Action? onSecondary = null)
    {
        ModalDialogTitle.Text = title;
        ModalDialogMessage.Text = message;
        ModalPrimaryButton.Content = primaryText;
        _onModalPrimary = onPrimary;

        if (!string.IsNullOrEmpty(secondaryText))
        {
            ModalSecondaryButton.Content = secondaryText;
            ModalSecondaryButton.Visibility = Visibility.Visible;
            _onModalSecondary = onSecondary;
        }
        else
        {
            ModalSecondaryButton.Visibility = Visibility.Collapsed;
            _onModalSecondary = null;
        }

        ModalDialogOverlay.Visibility = Visibility.Visible;
    }

    private void ModalPrimaryButton_Click(object sender, RoutedEventArgs e)
    {
        ModalDialogOverlay.Visibility = Visibility.Collapsed;
        _onModalPrimary?.Invoke();
    }

    private void ModalSecondaryButton_Click(object sender, RoutedEventArgs e)
    {
        ModalDialogOverlay.Visibility = Visibility.Collapsed;
        _onModalSecondary?.Invoke();
    }
}
