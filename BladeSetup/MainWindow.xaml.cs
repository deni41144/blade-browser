using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Shapes;
using System.Windows.Threading;

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
        // AVA GX: все переключения экранов идут через кинематографичный
        // переход (fade + слайд + режимы частиц/вспышка — см. регион эффектов)
        AnimateScreenTransition(targetScreen);
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
            // нормализуем выбор сразу: юзер видит итоговый путь до установки
            // (D:\Games -> D:\Games\Blade), а не после распаковки вперемешку
            TargetFolderTextBox.Text = InstallerLogic.EnsureBladeSubfolder(dialog.FolderName);
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
            // System.IO.Path — квалифицировано: using Shapes (AVA-эффекты) делает Path неоднозначным
            System.IO.Path.GetFullPath(targetDir);
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

        // Нормализация подпапки (баг владельца: распаковка «просто в место»):
        // D:\Games -> D:\Games\Blade; «…\Blade»/существующая установка — как есть.
        // Пишем обратно в поле: юзер видит итоговый путь ДО установки.
        targetDir = InstallerLogic.EnsureBladeSubfolder(targetDir);
        TargetFolderTextBox.Text = targetDir;

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

        // Check 4: защита от каши — целевая папка существует, НЕ пуста и не
        // является установкой Blade (выше уже отсеяно) => предупреждение.
        // Спасает от случайной распаковки в чужую папку, если юзер руками
        // стёр «Blade» из пути.
        if (Directory.Exists(_currentTargetDir) && Directory.EnumerateFileSystemEntries(_currentTargetDir).Any())
        {
            ShowModalDialog(
                title: "Папка не пуста",
                message: "Папка не пуста и не похожа на установку Blade.\n\nПродолжить установку в эту папку?",
                primaryText: "Продолжить",
                onPrimary: () => ExecuteInstallation(dataZipPath, isUpdate: false),
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
                InstallerLogic.SeedFirefoxProfilesIni(_currentTargetDir);
                InstallerLogic.SeedLangpackPolicy(_currentTargetDir);
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

    // ================================================================
    // ===== AVA EFFECTS (FrontendDesigner - Opera GX Level) ==========
    // ================================================================

    public enum AvaParticleMode
    {
        Normal,
        Quiet,
        Victory
    }

    private sealed class AvaParticle
    {
        public Ellipse Element { get; }
        public double X;
        public double Y;
        public double Vx;
        public double Vy;
        public double Life;
        public double MaxLife;
        public double BaseOpacity;
        public double WobbleSpeed;
        public double WobbleAngle;

        public AvaParticle(Ellipse element)
        {
            Element = element;
        }
    }

    private readonly List<AvaParticle> _particles = new();
    private DispatcherTimer? _particleTimer;
    private readonly Random _random = new();
    private int _activeParticleLimit = 40;
    private bool _isEffectsInitialized = false;

    protected override void OnContentRendered(EventArgs e)
    {
        base.OnContentRendered(e);
        InitAvaEffects();
    }

    protected override void OnClosed(EventArgs e)
    {
        StopAvaEffects();
        base.OnClosed(e);
    }

    protected override void OnStateChanged(EventArgs e)
    {
        base.OnStateChanged(e);
        if (WindowState == WindowState.Minimized)
        {
            _particleTimer?.Stop();
        }
        else
        {
            _particleTimer?.Start();
        }
    }

    /// <summary>
    /// Инициализация пула частиц на Canvas без DropShadow для максимальной производительности (60 FPS).
    /// </summary>
    private void InitAvaEffects()
    {
        if (_isEffectsInitialized || ParticlesCanvas == null) return;
        _isEffectsInitialized = true;

        const int maxPoolSize = 60;
        _particles.Clear();
        ParticlesCanvas.Children.Clear();

        var redBrush = new SolidColorBrush(Color.FromRgb(0xFF, 0x00, 0x00));
        var brightRedBrush = new SolidColorBrush(Color.FromRgb(0xFF, 0x33, 0x33));
        var whiteBrush = new SolidColorBrush(Color.FromRgb(0xFF, 0xFF, 0xFF));
        var orangeRedBrush = new SolidColorBrush(Color.FromRgb(0xFF, 0x55, 0x22));
        redBrush.Freeze();
        brightRedBrush.Freeze();
        whiteBrush.Freeze();
        orangeRedBrush.Freeze();

        for (int i = 0; i < maxPoolSize; i++)
        {
            double size = _random.NextDouble() * 3.2 + 1.8; // 1.8px .. 5.0px
            Brush fill;
            double roll = _random.NextDouble();
            if (roll < 0.55) fill = redBrush;
            else if (roll < 0.75) fill = brightRedBrush;
            else if (roll < 0.90) fill = orangeRedBrush;
            else fill = whiteBrush;

            var ellipse = new Ellipse
            {
                Width = size,
                Height = size,
                Fill = fill,
                IsHitTestVisible = false,
                Opacity = 0.0
            };

            ParticlesCanvas.Children.Add(ellipse);
            var particle = new AvaParticle(ellipse);
            RespawnParticle(particle, isBurst: false, initialScatter: true);
            _particles.Add(particle);
        }

        _particleTimer = new DispatcherTimer(DispatcherPriority.Render)
        {
            Interval = TimeSpan.FromMilliseconds(25) // ~40 FPS мягкий шаг, 0% CPU overhead
        };
        _particleTimer.Tick += ParticleTimer_Tick;
        _particleTimer.Start();
    }

    private void StopAvaEffects()
    {
        _particleTimer?.Stop();
        _particleTimer = null;
    }

    private void ParticleTimer_Tick(object? sender, EventArgs e)
    {
        double canvasWidth = ParticlesCanvas.ActualWidth > 0 ? ParticlesCanvas.ActualWidth : 580;
        double canvasHeight = ParticlesCanvas.ActualHeight > 0 ? ParticlesCanvas.ActualHeight : 420;

        int count = Math.Min(_particles.Count, _activeParticleLimit);
        for (int i = 0; i < _particles.Count; i++)
        {
            var p = _particles[i];
            if (i >= count)
            {
                p.Element.Opacity = 0.0;
                continue;
            }

            p.Life -= 1.0;
            p.WobbleAngle += p.WobbleSpeed;
            p.X += p.Vx + Math.Sin(p.WobbleAngle) * 0.4;
            p.Y += p.Vy;

            if (p.Life <= 0 || p.Y < -10 || p.X < -20 || p.X > canvasWidth + 20)
            {
                RespawnParticle(p, isBurst: false, initialScatter: false);
            }
            else
            {
                double progress = Math.Clamp(p.Life / p.MaxLife, 0.0, 1.0);
                p.Element.Opacity = p.BaseOpacity * progress;
                Canvas.SetLeft(p.Element, p.X);
                Canvas.SetTop(p.Element, p.Y);
            }
        }
    }

    private void RespawnParticle(AvaParticle p, bool isBurst, bool initialScatter)
    {
        double width = ParticlesCanvas.ActualWidth > 0 ? ParticlesCanvas.ActualWidth : 580;
        double height = ParticlesCanvas.ActualHeight > 0 ? ParticlesCanvas.ActualHeight : 420;

        p.X = _random.NextDouble() * width;
        if (initialScatter)
        {
            p.Y = _random.NextDouble() * height;
        }
        else if (isBurst)
        {
            p.Y = height * 0.65 + _random.NextDouble() * (height * 0.35);
        }
        else
        {
            p.Y = height + _random.NextDouble() * 12;
        }

        p.Vx = (_random.NextDouble() - 0.5) * (isBurst ? 2.8 : 0.6);
        p.Vy = isBurst ? -(_random.NextDouble() * 3.8 + 1.6) : -(_random.NextDouble() * 1.3 + 0.45);
        p.MaxLife = isBurst ? _random.Next(25, 55) : _random.Next(80, 150);
        p.Life = initialScatter ? _random.NextDouble() * p.MaxLife : p.MaxLife;
        p.BaseOpacity = _random.NextDouble() * 0.65 + 0.35;
        p.WobbleSpeed = _random.NextDouble() * 0.08 + 0.02;
        p.WobbleAngle = _random.NextDouble() * Math.PI * 2;

        Canvas.SetLeft(p.Element, p.X);
        Canvas.SetTop(p.Element, p.Y);
        p.Element.Opacity = 0.0;
    }

    /// <summary>
    /// Переключение плотности частиц под текущий экран (тихий на лицензии, густой на победном).
    /// </summary>
    public void SetParticleMode(AvaParticleMode mode)
    {
        _activeParticleLimit = mode switch
        {
            AvaParticleMode.Quiet => 15,
            AvaParticleMode.Victory => 60,
            _ => 40
        };
    }

    /// <summary>
    /// Залп искр (разовое ускорение частиц) при достижении 100% или победном экране.
    /// </summary>
    public void TriggerParticleBurst()
    {
        int burstCount = Math.Min(30, _particles.Count);
        for (int i = 0; i < burstCount; i++)
        {
            RespawnParticle(_particles[i], isBurst: true, initialScatter: false);
        }
    }

    /// <summary>
    /// Белая вспышка всего окна (Opera GX Flash) на 100% завершения установки.
    /// </summary>
    public void TriggerWindowFlash()
    {
        if (FlashOverlay == null) return;

        var anim = new DoubleAnimationUsingKeyFrames();
        anim.KeyFrames.Add(new LinearDoubleKeyFrame(0.0, KeyTime.FromTimeSpan(TimeSpan.Zero)));
        anim.KeyFrames.Add(new LinearDoubleKeyFrame(0.38, KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(80))));
        anim.KeyFrames.Add(new SplineDoubleKeyFrame(0.0, KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(500)),
            new KeySpline(0.25, 0.1, 0.25, 1.0)));

        FlashOverlay.BeginAnimation(UIElement.OpacityProperty, anim);
        TriggerParticleBurst();
    }

    /// <summary>
    /// Плавный кинематографичный переход между экранами визарда (Fade + Horizontal Slide 24px).
    /// </summary>
    public void AnimateScreenTransition(FrameworkElement targetScreen)
    {
        FrameworkElement? currentScreen = null;
        if (ScreenSplash.Visibility == Visibility.Visible) currentScreen = ScreenSplash;
        else if (ScreenLicense.Visibility == Visibility.Visible) currentScreen = ScreenLicense;
        else if (ScreenInstalling.Visibility == Visibility.Visible) currentScreen = ScreenInstalling;
        else if (ScreenDone.Visibility == Visibility.Visible) currentScreen = ScreenDone;

        if (currentScreen == targetScreen) return;

        if (currentScreen != null)
        {
            var fadeOut = new DoubleAnimation(1.0, 0.0, TimeSpan.FromMilliseconds(160));
            fadeOut.Completed += (_, _) =>
            {
                currentScreen.Visibility = Visibility.Collapsed;
            };
            currentScreen.BeginAnimation(UIElement.OpacityProperty, fadeOut);
        }

        targetScreen.Visibility = Visibility.Visible;
        targetScreen.Opacity = 0.0;

        var fadeIn = new DoubleAnimation(0.0, 1.0, TimeSpan.FromMilliseconds(320))
        {
            EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
        };
        targetScreen.BeginAnimation(UIElement.OpacityProperty, fadeIn);

        if (targetScreen.RenderTransform is TranslateTransform tt)
        {
            var slideIn = new DoubleAnimation(24.0, 0.0, TimeSpan.FromMilliseconds(340))
            {
                EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
            };
            tt.BeginAnimation(TranslateTransform.XProperty, slideIn);
        }

        if (targetScreen == ScreenLicense)
        {
            SetParticleMode(AvaParticleMode.Quiet);
        }
        else if (targetScreen == ScreenDone)
        {
            SetParticleMode(AvaParticleMode.Victory);
            TriggerWindowFlash();
        }
        else
        {
            SetParticleMode(AvaParticleMode.Normal);
        }
    }
}
