# Blade 2.3.5 release verification

Base: published 2.3.4, commit `2e333295c17cb42171c618832e2c93351eb49c70`.

- Windows PowerShell 5.1 isolated registry suite: 17/17 PASS. Real user registrations unchanged.
- Native protocol enumeration includes the independent Blade Browser executable for HTTP/HTTPS.
- Live launcher tests use a fake engine to verify explicit profile, URL quoting, engine fallback and current directory; real browser never launched by tests.
- Updater Node VM fixture: 24/24 PASS. Installed/profile guards, process results, retry and cross-window lock covered.
- 61 JavaScript/MJS files parse with Node. WPF .NET 9 build: zero warnings/errors.
- ZIP compared byte-for-byte against published 2.3.4: no deletions; one new launcher, seven changed metadata/registration/update entries. Unrelated modules, styles and images unchanged.
- Archive has no private profile databases/session data. Changed source scanned for credentials and personal installation paths.

Limits: native Shell enumeration does not prove the complete Windows Settings UI. The registry fixture suppresses global Shell-change broadcasts, uses real shortcut COM property store, intercepts Settings launch without opening UI, and preserves user defaults. User still confirms default browser in Windows. Legacy dead generic Firefox entries are not rewritten without proof of Blade ownership.

Commands:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File Patches\tests\Test-BrowserRegistration.ps1
node --test TestReports\test-BladeUpdater-registration.js
dotnet build BladeSetup\BladeSetup.csproj -c Release -p:SelfContained=false
```

Runtime artifacts and real registry fingerprints are local-only, not committed.