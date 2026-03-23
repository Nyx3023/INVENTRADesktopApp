; ============================================================
; INVENTRA - Inno Setup Installer for Electron build
; Captures setup credentials/store details during installation
; ============================================================

#ifndef MyAppName
  #define MyAppName "INVENTRA"
#endif
#ifndef MyAppVersion
  #define MyAppVersion "1.0.0"
#endif
#ifndef MyOutputSuffix
  #define MyOutputSuffix ""
#endif
#ifndef MyAppPublisher
  #define MyAppPublisher "JBO Arts & Crafts Trading"
#endif
#ifndef MyAppExeName
  #define MyAppExeName "INVENTRA.exe"
#endif
#ifndef SourceDir
  #define SourceDir "release\win-unpacked"
#endif
#ifndef MyAppIcon
  #define MyAppIcon "src\assets\jbologo.ico"
#endif

[Setup]
AppId={{3A5DA15B-250A-5C96-AEE2-DB34C1380F93}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=release
OutputBaseFilename=INVENTRA-Setup-{#MyAppVersion}{#MyOutputSuffix}
SetupIconFile={#MyAppIcon}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
UninstallDisplayIcon={app}\jbologo.ico
UninstallDisplayName={#MyAppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MyAppIcon}"; DestDir: "{app}"; DestName: "jbologo.ico"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\jbologo.ico"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\jbologo.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Code]
var
  StorePage: TInputQueryWizardPage;
  AdminPage: TInputQueryWizardPage;
  StoreName: string;
  StoreEmail: string;
  StorePhone: string;
  StoreAddress: string;
  AdminName: string;
  AdminEmail: string;
  AdminPassword: string;
  AdminPasswordConfirm: string;

procedure InitializeWizard;
begin
  StorePage := CreateInputQueryPage(
    wpSelectDir,
    'Store Information',
    'Configure store details',
    'These values are applied automatically on first launch.'
  );

  StorePage.Add('Store Name *', False);
  StorePage.Values[0] := 'My Store';
  StorePage.Add('Store Email', False);
  StorePage.Values[1] := '';
  StorePage.Add('Store Phone', False);
  StorePage.Values[2] := '';
  StorePage.Add('Store Address', False);
  StorePage.Values[3] := '';

  AdminPage := CreateInputQueryPage(
    StorePage.ID,
    'Admin Credentials',
    'Create primary admin account',
    'Required fields (*) must be completed to continue.'
  );
  AdminPage.Add('Admin Name', False);
  AdminPage.Values[0] := 'Administrator';
  AdminPage.Add('Admin Email *', False);
  AdminPage.Values[1] := 'admin@gmail.com';
  AdminPage.Add('Admin Password *', True);
  AdminPage.Values[2] := '';
  AdminPage.Add('Confirm Admin Password *', True);
  AdminPage.Values[3] := '';
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  if CurPageID = StorePage.ID then
  begin
    StoreName := Trim(StorePage.Values[0]);
    StoreEmail := Trim(StorePage.Values[1]);
    StorePhone := Trim(StorePage.Values[2]);
    StoreAddress := Trim(StorePage.Values[3]);

    if Length(StoreName) < 2 then
    begin
      MsgBox('Store Name is required.', mbError, MB_OK);
      Result := False;
      exit;
    end;
  end;

  if CurPageID = AdminPage.ID then
  begin
    AdminName := Trim(AdminPage.Values[0]);
    AdminEmail := Trim(AdminPage.Values[1]);
    AdminPassword := AdminPage.Values[2];
    AdminPasswordConfirm := AdminPage.Values[3];

    if Length(AdminEmail) < 5 then
    begin
      MsgBox('Admin Email is required.', mbError, MB_OK);
      Result := False;
      exit;
    end;

    if Length(AdminPassword) < 8 then
    begin
      MsgBox('Admin Password must be at least 8 characters.', mbError, MB_OK);
      Result := False;
      exit;
    end;

    if AdminPassword <> AdminPasswordConfirm then
    begin
      MsgBox('Admin password and confirmation do not match.', mbError, MB_OK);
      Result := False;
      exit;
    end;

    if AdminName = '' then
      AdminName := 'Administrator';
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  RuntimeDataDir: string;
  SetupIniPath: string;
  OldRuntimeDataDir: string;
begin
  if CurStep = ssPostInstall then
  begin
    RuntimeDataDir := ExpandConstant('{userappdata}\INVENTRA\runtime\data');
    ForceDirectories(RuntimeDataDir);

    { Clean up old database and setup files so the app starts fresh }
    if FileExists(RuntimeDataDir + '\pos_inventory.db') then
      DeleteFile(RuntimeDataDir + '\pos_inventory.db');
    if FileExists(RuntimeDataDir + '\pos_inventory.db-wal') then
      DeleteFile(RuntimeDataDir + '\pos_inventory.db-wal');
    if FileExists(RuntimeDataDir + '\pos_inventory.db-shm') then
      DeleteFile(RuntimeDataDir + '\pos_inventory.db-shm');
    if FileExists(RuntimeDataDir + '\store-info.json') then
      DeleteFile(RuntimeDataDir + '\store-info.json');
    if FileExists(RuntimeDataDir + '\setup-state.json') then
      DeleteFile(RuntimeDataDir + '\setup-state.json');

    { Also clean up old `inventory-management-system` path to avoid leaks from dev/old version }
    OldRuntimeDataDir := ExpandConstant('{userappdata}\inventory-management-system\runtime\data');
    if DirExists(OldRuntimeDataDir) then
    begin
      if FileExists(OldRuntimeDataDir + '\pos_inventory.db') then
        DeleteFile(OldRuntimeDataDir + '\pos_inventory.db');
      if FileExists(OldRuntimeDataDir + '\pos_inventory.db-wal') then
        DeleteFile(OldRuntimeDataDir + '\pos_inventory.db-wal');
      if FileExists(OldRuntimeDataDir + '\pos_inventory.db-shm') then
        DeleteFile(OldRuntimeDataDir + '\pos_inventory.db-shm');
      if FileExists(OldRuntimeDataDir + '\store-info.json') then
        DeleteFile(OldRuntimeDataDir + '\store-info.json');
      if FileExists(OldRuntimeDataDir + '\setup-state.json') then
        DeleteFile(OldRuntimeDataDir + '\setup-state.json');
    end;

    SetupIniPath := RuntimeDataDir + '\installer-setup.ini';

    SetIniString('setup', 'storeName', StoreName, SetupIniPath);
    SetIniString('setup', 'storeEmail', StoreEmail, SetupIniPath);
    SetIniString('setup', 'storePhone', StorePhone, SetupIniPath);
    SetIniString('setup', 'storeAddress', StoreAddress, SetupIniPath);
    SetIniString('setup', 'adminName', AdminName, SetupIniPath);
    SetIniString('setup', 'adminEmail', AdminEmail, SetupIniPath);
    SetIniString('setup', 'adminPassword', AdminPassword, SetupIniPath);
  end;
end;
