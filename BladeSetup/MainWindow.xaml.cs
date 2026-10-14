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
    private bool _isUpdate = false;
    private bool _isInstalling = false;
    private bool _isCommitting = false;

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
        if (_isCommitting)
        {
            ShowModalDialog(
                title: "Завершение операции",
                message: "Сейчас меняются файлы установки. Дождитесь завершения, чтобы не прерывать переключение версии.",
                primaryText: "Понятно",
                onPrimary: () => { }
            );
            return;
        }
        if (_isInstalling)
        {
            ShowModalDialog(
                title: _isUpdate ? "Отмена обновления" : "Отмена установки",
                message: _isUpdate
                    ? "Обновление ещё не завершено. Отменить его и дождаться безопасной очистки временных файлов?"
                    : "Установка ещё не завершена. Отменить её и дождаться безопасной очистки временных файлов?",
                primaryText: "Да, отменить",
                onPrimary: () => _cancellationTokenSource?.Cancel(),
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
        // Все переключения экранов идут через короткий переход Blade.
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
            // System.IO.Path — квалифицировано, чтобы отличать его от геометрических типов WPF.
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
        _isUpdate = InstallerLogic.IsExistingInstallation(targetDir);
        SetupActionTitleTextBlock.Text = _isUpdate ? "Обновить Blade?" : "Куда установить Blade?";
        SetupActionDescriptionTextBlock.Text = _isUpdate
            ? "Обновим браузер и сохраним твой профиль, закладки и пароли."
            : "Выбери папку для файлов браузера.";
        InstallFromLicenseButton.Content = _isUpdate ? "Обновить Blade" : "Установить Blade";
        InstallFromLicenseButton.SetValue(System.Windows.Automation.AutomationProperties.NameProperty,
            _isUpdate ? "Обновить Blade" : "Начать установку Blade");
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
        if (!InstallerLogic.HasDataPayload(dataZipPath))
        {
            ShowModalDialog(
                title: "Пакет Blade не найден",
                message: "В установщике нет встроенного пакета, а рядом не найден data.zip с файлом проверки SHA-256.\n\nСкачайте полный комплект Blade-Setup.exe и data.zip.sha256.",
                primaryText: "Понятно",
                onPrimary: () => { }
            );
            return;
        }

        CheckAndProceedInstallation(dataZipPath);
    }

    private void CheckAndProceedInstallation(string? dataZipPath)
    {
        // Check 2: Blade or its taskbar-icon watcher running from target
        if (InstallerLogic.IsFirefoxRunningFromTarget(_currentTargetDir))
        {
            ShowModalDialog(
                title: "Blade запущен",
                message: "Blade ещё работает из выбранной папки. Закройте все его окна и повторите установку.",
                primaryText: "Повторить",
                onPrimary: () => CheckAndProceedInstallation(dataZipPath),
                secondaryText: "Отмена",
                onSecondary: () => { }
            );
            return;
        }

        // Check 3: Detect update
        bool isUpdate = InstallerLogic.IsExistingInstallation(_currentTargetDir);
        _isUpdate = isUpdate;
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
                title: "Нужна пустая папка",
                message: "Выбранная папка содержит чужие файлы и не является установкой Blade.\n\nВыберите пустую папку, чтобы установщик случайно не заменил существующие данные.",
                primaryText: "Понятно",
                onPrimary: () => { }
            );
            return;
        }

        // Clean installation
        ExecuteInstallation(dataZipPath, isUpdate: false);
    }

    // ================================================================
    // SCREEN 3: INSTALLING & PROGRESS
    // ================================================================
    private async void ExecuteInstallation(string? dataZipPath, bool isUpdate)
    {
        _isUpdate = isUpdate;
        _isInstalling = true;
        _cancellationTokenSource = new CancellationTokenSource();
        var token = _cancellationTokenSource.Token;

        ShowScreen(ScreenInstalling);
        UpdateProgress(0,
            isUpdate ? "Подготовка к обновлению..." : "Подготовка к установке...",
            isUpdate ? "Текущая версия останется доступной до проверки пакета." : "Инициализация...");

        var progress = new Progress<InstallProgressReport>(report =>
        {
            if (report.Stage is "Безопасное обновление..." or "Завершение установки...")
                _isCommitting = true;
            UpdateProgress(report.Percent, report.Stage, report.CurrentItem);
        });

        try
        {
            UpdateProgress(1, "Проверка пакета...", "Сверка SHA-256 и состава архива.");
            await InstallerLogic.InstallDataZipAsync(dataZipPath, _currentTargetDir, isUpdate, progress, token);
            _isCommitting = false;

            // Deploy the Blade icon and launcher before creating shortcuts.
            UpdateProgress(98, "Настройка ярлыков и системы...", "Установка значка и запуска Blade...");
            await Task.Run(() =>
            {
                InstallerLogic.DeployIcon(_currentTargetDir);
                InstallerLogic.DeployLauncher(_currentTargetDir);
                bool createDesktop = Dispatcher.Invoke(() => CreateDesktopShortcutCheckBox.IsChecked == true);
                InstallerLogic.CreateShortcuts(_currentTargetDir, createDesktop);
                InstallerLogic.CreateUninstaller(_currentTargetDir);
                InstallerLogic.SeedFirefoxProfilesIni(_currentTargetDir);
                InstallerLogic.SeedLangpackPolicy(_currentTargetDir);
            }, token);

            UpdateProgress(99, "Проверка регистрации браузера...", "Без изменения приложений по умолчанию.");
            string? registrationWarning = await InstallerLogic.RegisterInstalledBrowserAsync(_currentTargetDir, token);
            UpdateProgress(100,
                registrationWarning == null ? "Завершено!" : "Установлено с предупреждением",
                registrationWarning ?? "Blade готов к запуску.");
            await Task.Delay(350, token);

            _isInstalling = false;
            DoneTitleTextBlock.Text = isUpdate ? "Blade обновлён" : "Blade установлен";
            DoneSummaryTextBlock.Text = isUpdate
                ? $"Установлена версия v{InstallerLogic.DetectedVersion}."
                : $"Версия v{InstallerLogic.DetectedVersion} готова к запуску.";
            DoneTargetDirectoryTextBlock.Text = $"Папка: {_currentTargetDir}";
            DoneDesktopShortcutCheckBox.IsChecked = CreateDesktopShortcutCheckBox.IsChecked;
            ShowScreen(ScreenDone);
            if (registrationWarning != null)
            {
                ShowModalDialog(
                    title: "Предупреждение регистрации",
                    message: $"Blade {(isUpdate ? "обновлён" : "установлен")}. Приложения по умолчанию не изменены.\n\n{registrationWarning}",
                    primaryText: "Понятно",
                    onPrimary: () => { }
                );
            }
        }
        catch (OperationCanceledException)
        {
            _isInstalling = false;
            _isCommitting = false;
            ShowScreen(ScreenSplash);
            ShowModalDialog(
                title: _isUpdate ? "Обновление отменено" : "Установка отменена",
                message: _isUpdate
                    ? "Обновление прервано пользователем. Текущая версия браузера сохранена."
                    : "Процесс установки был прерван пользователем.",
                primaryText: "Понятно",
                onPrimary: () => { }
            );
        }
        catch (Exception ex)
        {
            _isInstalling = false;
            _isCommitting = false;
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
        _currentPercent = Math.Clamp(percent, 0, 100);
        InstallStageTextBlock.Text = stage;
        InstallDetailsTextBlock.Text = item;
        ProgressPercentTextBlock.Text = $"{Math.Round(_currentPercent)}%";
        ProgressBarTrack.SetValue(System.Windows.Automation.AutomationProperties.HelpTextProperty,
            $"{Math.Round(_currentPercent)} процентов. {stage} {item}");

        double scale = _currentPercent / 100.0;
        if (SystemParameters.ClientAreaAnimation)
        {
            ProgressBarScale.BeginAnimation(ScaleTransform.ScaleXProperty,
                new DoubleAnimation(scale, TimeSpan.FromMilliseconds(110))
                {
                    EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut }
                });
        }
        else
        {
            ProgressBarScale.BeginAnimation(ScaleTransform.ScaleXProperty, null);
            ProgressBarScale.ScaleX = scale;
        }
    }

    private void CancelInstallButton_Click(object sender, RoutedEventArgs e)
    {
        if (_isCommitting)
        {
            ShowModalDialog(
                title: "Завершение операции",
                message: "Сейчас меняются файлы установки. Отмена временно недоступна, чтобы сохранить рабочую версию браузера.",
                primaryText: "Понятно",
                onPrimary: () => { }
            );
            return;
        }
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
        UpdateDecorativeEffects();
    }

    private void ModalPrimaryButton_Click(object sender, RoutedEventArgs e)
    {
        ModalDialogOverlay.Visibility = Visibility.Collapsed;
        _onModalPrimary?.Invoke();
        UpdateDecorativeEffects();
    }

    private void ModalSecondaryButton_Click(object sender, RoutedEventArgs e)
    {
        ModalDialogOverlay.Visibility = Visibility.Collapsed;
        _onModalSecondary?.Invoke();
        UpdateDecorativeEffects();
    }

    // ================================================================
    // ===== Короткие фоновые эффекты установщика =====================
    // ================================================================

    public enum ParticleMode
    {
        Normal,
        Quiet,
        Victory
    }

    private sealed class AmbientParticle
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

        public AmbientParticle(Ellipse element)
        {
            Element = element;
        }
    }

    private readonly List<AmbientParticle> _particles = new();
    private DispatcherTimer? _particleTimer;
    private readonly Random _random = new();
    private int _activeParticleLimit = 14;
    private bool _effectsInitialized = false;

    protected override void OnContentRendered(EventArgs e)
    {
        base.OnContentRendered(e);
        InitializeAmbientEffects();
        UpdateDecorativeEffects();
    }

    protected override void OnClosed(EventArgs e)
    {
        StopAmbientEffects();
        base.OnClosed(e);
    }

    protected override void OnStateChanged(EventArgs e)
    {
        base.OnStateChanged(e);
        UpdateDecorativeEffects();
    }

    protected override void OnActivated(EventArgs e)
    {
        base.OnActivated(e);
        UpdateDecorativeEffects();
    }

    protected override void OnDeactivated(EventArgs e)
    {
        UpdateDecorativeEffects();
        base.OnDeactivated(e);
    }

    /// <summary>
    /// Создаёт небольшой переиспользуемый пул фоновых частиц.
    /// </summary>
    private void InitializeAmbientEffects()
    {
        if (_effectsInitialized || ParticlesCanvas == null) return;
        _effectsInitialized = true;

        const int maxPoolSize = 22;
        _particles.Clear();
        ParticlesCanvas.Children.Clear();

        var redBrush = new SolidColorBrush(Color.FromRgb(0xD9, 0x4B, 0x59));
        var brightRedBrush = new SolidColorBrush(Color.FromRgb(0xE8, 0x65, 0x70));
        var whiteBrush = new SolidColorBrush(Color.FromRgb(0xD8, 0xCD, 0xD0));
        var orangeRedBrush = new SolidColorBrush(Color.FromRgb(0xA8, 0x4A, 0x4D));
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
            var particle = new AmbientParticle(ellipse);
            RespawnParticle(particle, isBurst: false, initialScatter: true);
            _particles.Add(particle);
        }

        _particleTimer = new DispatcherTimer(DispatcherPriority.Background)
        {
            Interval = TimeSpan.FromMilliseconds(50)
        };
        _particleTimer.Tick += ParticleTimer_Tick;
        UpdateDecorativeEffects();
    }

    private void StopAmbientEffects()
    {
        _particleTimer?.Stop();
        _particleTimer = null;
        StopInstallLogoPulse();
    }

    private void UpdateDecorativeEffects()
    {
        bool active = IsActive && WindowState != WindowState.Minimized &&
            SystemParameters.ClientAreaAnimation && ModalDialogOverlay?.Visibility != Visibility.Visible;
        if (!active)
        {
            _particleTimer?.Stop();
            StopInstallLogoPulse();
            return;
        }

        _particleTimer?.Start();
        if (ScreenInstalling?.Visibility == Visibility.Visible) StartInstallLogoPulse();
        else StopInstallLogoPulse();
    }

    private void StartInstallLogoPulse()
    {
        if (InstallLogoScale == null || !SystemParameters.ClientAreaAnimation) return;
        var pulse = new DoubleAnimation(0.985, 1.015, TimeSpan.FromSeconds(2.2))
        {
            AutoReverse = true,
            RepeatBehavior = RepeatBehavior.Forever,
            EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut }
        };
        InstallLogoScale.BeginAnimation(ScaleTransform.ScaleXProperty, pulse);
        InstallLogoScale.BeginAnimation(ScaleTransform.ScaleYProperty, pulse);
    }

    private void StopInstallLogoPulse()
    {
        if (InstallLogoScale == null) return;
        InstallLogoScale.BeginAnimation(ScaleTransform.ScaleXProperty, null);
        InstallLogoScale.BeginAnimation(ScaleTransform.ScaleYProperty, null);
        InstallLogoScale.ScaleX = 1;
        InstallLogoScale.ScaleY = 1;
    }

    private void ParticleTimer_Tick(object? sender, EventArgs e)
    {
        double canvasWidth = ParticlesCanvas.ActualWidth > 0 ? ParticlesCanvas.ActualWidth : 580;
        double canvasHeight = ParticlesCanvas.ActualHeight > 0 ? ParticlesCanvas.ActualHeight : 420;

        int count = Math.Min(_particles.Count, _activeParticleLimit);
        for (int i = 0; i < count; i++)
        {
            var p = _particles[i];
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

    private void RespawnParticle(AmbientParticle p, bool isBurst, bool initialScatter)
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
        p.BaseOpacity = _random.NextDouble() * 0.20 + 0.12;
        p.WobbleSpeed = _random.NextDouble() * 0.08 + 0.02;
        p.WobbleAngle = _random.NextDouble() * Math.PI * 2;

        Canvas.SetLeft(p.Element, p.X);
        Canvas.SetTop(p.Element, p.Y);
        p.Element.Opacity = 0.0;
    }

    /// <summary>
    /// Переключение плотности частиц под текущий экран (тихий на лицензии, густой на победном).
    /// </summary>
    public void SetParticleMode(ParticleMode mode)
    {
        _activeParticleLimit = mode switch
        {
            ParticleMode.Quiet => 8,
            ParticleMode.Victory => 18,
            _ => 14
        };
        for (int i = Math.Min(_activeParticleLimit, _particles.Count); i < _particles.Count; i++)
            _particles[i].Element.Opacity = 0;
    }

    /// <summary>
    /// Залп искр (разовое ускорение частиц) при достижении 100% или победном экране.
    /// </summary>
    public void TriggerParticleBurst()
    {
        int burstCount = Math.Min(_activeParticleLimit, _particles.Count);
        for (int i = 0; i < burstCount; i++)
        {
            RespawnParticle(_particles[i], isBurst: true, initialScatter: false);
        }
    }

    /// <summary>
    /// Мягкий акцент при завершении установки.
    /// </summary>
    public void TriggerWindowFlash()
    {
        if (FlashOverlay == null || !IsActive || !SystemParameters.ClientAreaAnimation) return;

        var anim = new DoubleAnimationUsingKeyFrames();
        anim.KeyFrames.Add(new LinearDoubleKeyFrame(0.0, KeyTime.FromTimeSpan(TimeSpan.Zero)));
        anim.KeyFrames.Add(new LinearDoubleKeyFrame(0.08, KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(70))));
        anim.KeyFrames.Add(new SplineDoubleKeyFrame(0.0, KeyTime.FromTimeSpan(TimeSpan.FromMilliseconds(420)),
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

        bool animate = SystemParameters.ClientAreaAnimation && IsActive && WindowState != WindowState.Minimized;
        if (!animate)
        {
            if (currentScreen != null)
            {
                currentScreen.BeginAnimation(UIElement.OpacityProperty, null);
                currentScreen.Visibility = Visibility.Collapsed;
                currentScreen.Opacity = 1;
            }
            targetScreen.Visibility = Visibility.Visible;
            targetScreen.BeginAnimation(UIElement.OpacityProperty, null);
            targetScreen.Opacity = 1;
            if (targetScreen.RenderTransform is TranslateTransform reducedMotionTransform)
            {
                reducedMotionTransform.BeginAnimation(TranslateTransform.XProperty, null);
                reducedMotionTransform.X = 0;
            }
        }
        else if (currentScreen != null)
        {
            var fadeOut = new DoubleAnimation(1.0, 0.0, TimeSpan.FromMilliseconds(160));
            fadeOut.Completed += (_, _) =>
            {
                currentScreen.Visibility = Visibility.Collapsed;
            };
            currentScreen.BeginAnimation(UIElement.OpacityProperty, fadeOut);
        }

        if (animate)
        {
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
        }

        if (targetScreen == ScreenLicense)
        {
            SetParticleMode(ParticleMode.Quiet);
        }
        else if (targetScreen == ScreenDone)
        {
            SetParticleMode(ParticleMode.Victory);
            TriggerWindowFlash();
        }
        else
        {
            SetParticleMode(ParticleMode.Normal);
        }
        UpdateDecorativeEffects();
    }
}
