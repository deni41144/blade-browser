; ============================================================================
; Blade Browser — Inno Setup скрипт v2 (ТЁМНЫЙ СКИН)
; Сборка: ISCC.exe Blade-Installer.iss
; Выход: Blade-Setup.exe (в Output\)
; ============================================================================
#define BladeName "Blade"
#define BladeVersion "1.0.0"
#define BladePublisher "Denis Bobliksov"

[Setup]
AppId={{7B1ADE50-C1AD-4BAD-BEAD-202609110000}
AppName={#BladeName}
AppVersion={#BladeVersion}
AppPublisher={#BladePublisher}
UninstallDisplayName=Blade Browser
DefaultDirName={localappdata}\Blade
DefaultGroupName=Blade
UninstallDisplayIcon={app}\Blade.ico
; --- внешний вид мастера ---
WizardStyle=modern
SetupIconFile=icon.ico
WizardImageFile=banner_197x384.png
WizardSmallImageFile=small_banner_55x64.png
; --- тёмный скин: цвета формы (Inno 7 поддерживает) ---
; --- сборка ---
Compression=lzma2/max
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
LicenseFile=license.txt
OutputDir=Output
OutputBaseFilename=Blade-Setup

[Languages]
Name: "ru"; MessagesFile: "compiler:Languages\Russian.isl"

[Components]
Name: "core"; Description: "Blade Browser (движок + темы + скрипты)"; Types: full custom; Flags: fixed
Name: "personaldata"; Description: "Личные данные (пароли, история, куки, вкладки)"; Types: full custom; Flags: checkablealone

[Tasks]
Name: "desktopicon"; Description: "Ярлык на рабочий стол"; Flags: checkedonce

[Files]
; --- движок Firefox (наш Blade) ---
Source: "..\FirefoxPortable\App\*"; DestDir: "{app}\FirefoxPortable\App"; Components: core; Flags: ignoreversion recursesubdirs createallsubdirs
; --- профиль: вся кастомизация (кэши и личные данные исключены) ---
Source: "..\FirefoxPortable\Data\profile\*"; DestDir: "{app}\FirefoxPortable\Data\profile"; Components: core; Excludes: "compatibility.ini,pluginreg.dat,cache2,startupCache,shader-cache,minidumps,crashes,saved-telemetry-pings,jumpListCache,thumbnails,parent.lock,sessionstore.jsonlz4,sessionstore-backups,logins.json,key4.db,key.db,cookies.sqlite*,places.sqlite*,formhistory.sqlite,favicons.sqlite*,datareporting"; Flags: ignoreversion recursesubdirs createallsubdirs uninsneveruninstall
; --- личные данные (опциональный компонент) ---
Source: "..\FirefoxPortable\Data\profile\logins.json"; DestDir: "{app}\FirefoxPortable\Data\profile"; Components: personaldata; Flags: skipifsourcedoesntexist uninsneveruninstall
Source: "..\FirefoxPortable\Data\profile\key4.db"; DestDir: "{app}\FirefoxPortable\Data\profile"; Components: personaldata; Flags: skipifsourcedoesntexist uninsneveruninstall
Source: "..\FirefoxPortable\Data\profile\cookies.sqlite"; DestDir: "{app}\FirefoxPortable\Data\profile"; Components: personaldata; Flags: skipifsourcedoesntexist uninsneveruninstall
Source: "..\FirefoxPortable\Data\profile\cookies.sqlite-shm"; DestDir: "{app}\FirefoxPortable\Data\profile"; Components: personaldata; Flags: skipifsourcedoesntexist uninsneveruninstall
Source: "..\FirefoxPortable\Data\profile\cookies.sqlite-wal"; DestDir: "{app}\FirefoxPortable\Data\profile"; Components: personaldata; Flags: skipifsourcedoesntexist uninsneveruninstall
Source: "..\FirefoxPortable\Data\profile\places.sqlite"; DestDir: "{app}\FirefoxPortable\Data\profile"; Components: personaldata; Flags: skipifsourcedoesntexist uninsneveruninstall
Source: "..\FirefoxPortable\Data\profile\places.sqlite-shm"; DestDir: "{app}\FirefoxPortable\Data\profile"; Components: personaldata; Flags: skipifsourcedoesntexist uninsneveruninstall
Source: "..\FirefoxPortable\Data\profile\places.sqlite-wal"; DestDir: "{app}\FirefoxPortable\Data\profile"; Components: personaldata; Flags: skipifsourcedoesntexist uninsneveruninstall
Source: "..\FirefoxPortable\Data\profile\formhistory.sqlite"; DestDir: "{app}\FirefoxPortable\Data\profile"; Components: personaldata; Flags: skipifsourcedoesntexist uninsneveruninstall
Source: "..\FirefoxPortable\Data\profile\sessionstore.jsonlz4"; DestDir: "{app}\FirefoxPortable\Data\profile"; Components: personaldata; Flags: skipifsourcedoesntexist uninsneveruninstall
Source: "..\FirefoxPortable\Data\profile\sessionstore-backups\*"; DestDir: "{app}\FirefoxPortable\Data\profile\sessionstore-backups"; Components: personaldata; Flags: skipifsourcedoesntexist recursesubdirs uninsneveruninstall
; --- корневые утилиты Blade ---
Source: "..\Blade-Backup.bat"; DestDir: "{app}"; Components: core; Flags: ignoreversion
Source: "..\Blade-Backup.ps1"; DestDir: "{app}"; Components: core; Flags: ignoreversion
Source: "..\Update-Blade.ps1"; DestDir: "{app}"; Components: core; Flags: ignoreversion
Source: "..\Branding\*"; DestDir: "{app}\Branding"; Components: core; Flags: ignoreversion recursesubdirs
Source: "..\Blade.ico"; DestDir: "{app}"; Components: core; Flags: ignoreversion
Source: "..\Blade-Diagnostic.bat"; DestDir: "{app}"; Components: core; Flags: ignoreversion

[InstallDelete]
; Сносим compatibility.ini — он содержит СТАРЫЙ путь установки и ломает
; профиль на чужой машине (Firefox видит несовпадение и создаёт новый пустой)
Type: files; Name: "{app}\FirefoxPortable\Data\profile\compatibility.ini"
Type: files; Name: "{app}\FirefoxPortable\Data\profile\pluginreg.dat"

[Icons]
Name: "{autodesktop}\Blade"; Filename: "{app}\FirefoxPortable\App\Firefox64\firefox.exe"; Parameters: "-profile ""{app}\FirefoxPortable\Data\profile"""; WorkingDir: "{app}\FirefoxPortable\App\Firefox64"; IconFilename: "{app}\Blade.ico"; Tasks: desktopicon
Name: "{group}\Blade"; Filename: "{app}\FirefoxPortable\App\Firefox64\firefox.exe"; Parameters: "-profile ""{app}\FirefoxPortable\Data\profile"""; WorkingDir: "{app}\FirefoxPortable\App\Firefox64"; IconFilename: "{app}\Blade.ico"
Name: "{group}\Blade-Diagnostic"; Filename: "{app}\Blade-Diagnostic.bat"; WorkingDir: "{app}"; IconFilename: "{app}\Blade.ico"
Name: "{group}\Blade-Backup"; Filename: "{app}\Blade-Backup.bat"; WorkingDir: "{app}"; IconFilename: "{app}\Blade.ico"
Name: "{group}\{cm:UninstallProgram,Blade}"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\FirefoxPortable\App\Firefox64\firefox.exe"; Parameters: "-profile ""{app}\FirefoxPortable\Data\profile"""; WorkingDir: "{app}\FirefoxPortable\App\Firefox64"; Description: "Запустить Blade"; Flags: nowait postinstall skipifsilent

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  ProfileDir, AppDataFF, Ini: String;
  Existing: TStringList;
  i: Integer;
  Line: String;
  OurProfile: Boolean;
begin
  if CurStep = ssPostInstall then
  begin
    ProfileDir := ExpandConstant('{app}') + '\FirefoxPortable\Data\profile';
    AppDataFF := ExpandConstant('{userappdata}') + '\Mozilla\Firefox';
    ForceDirectories(AppDataFF);
    Ini := AppDataFF + '\profiles.ini';

    // Проверяем: есть ли уже наш профиль в profiles.ini
    OurProfile := False;
    if FileExists(Ini) then
    begin
      Existing := TStringList.Create;
      try
        Existing.LoadFromFile(Ini);
        for i := 0 to Existing.Count - 1 do
          if Pos('Blade', Existing[i]) > 0 then OurProfile := True;
      finally
        Existing.Free;
      end;
    end;

    // Если нет — добавляем наш профиль как дефолтный
    if not OurProfile then
    begin
      SaveStringToFile(Ini,
        Chr(13) + Chr(10) +
        '[ProfileBlade]' + Chr(13) + Chr(10) +
        'Name=Blade' + Chr(13) + Chr(10) +
        'IsRelative=0' + Chr(13) + Chr(10) +
        'Path=' + ProfileDir + Chr(13) + Chr(10) +
        'Default=1' + Chr(13) + Chr(10),
        True);
    end;
  end;
end;
