# Windows

Windows x64: NSIS installer для текущего пользователя и portable launcher. Node.js и Java для запуска не нужны. EXE не подписаны сертификатом издателя.

## Особенности поставки

- Installer поддерживает выбор каталога и языка установки, добавляет ассоциацию `.bpmn`.
- Portable распаковывает приложение во временный каталог; настройки и recovery находятся в обычном пользовательском профиле Electron.
- `.bpmn20.xml`/`.xml` открываются через приложение, drag-and-drop или CLI.

## Сборка и проверка

[Команды разработки](development.md) содержат нативную сборку и кросс-сборку на Linux. Docker-вариант использует закреплённый `electronuserland/builder:24-wine`, UID/GID разработчика и только каталог проекта. Docker daemon должен видеть его для bind mount; кеши остаются в `.cache/`.

```powershell
npm run test:e2e -- --project=windows
```

Проверяется `release/win-unpacked/BPMN Desk.exe`: sandbox/preload, открытие файла с кириллицей и пробелами, XML, свойства, сохранение и примеры. Для установленного приложения путь задаётся переменной `BPMN_DESK_WINDOWS_EXECUTABLE`; installer/portable launcher ею не проверяются.

Нативный CI выполняется на Windows Server 2022. Автотесты приложения не подтверждают ручную установку, удаление, запуск portable и ассоциации Windows 10/11. [Подтверждённые результаты](validation.md).
