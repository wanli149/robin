@echo off
REM 强制使用 Visual Studio 2026 构建 Windows 应用
REM 通过直接调用 CMake 来绕过 Flutter 的 Visual Studio 版本检测

echo 清理旧的构建文件...
if exist build\windows rmdir /s /q build\windows

echo 运行 Flutter 构建（会失败，但会生成必要的文件）...
flutter build windows --debug 2>nul

echo 手动运行 CMake 配置...
cd build\windows
cmake -G "Visual Studio 18 2026" -A x64 ..\..\..\windows
if errorlevel 1 (
    echo CMake 配置失败
    cd ..\..
    exit /b 1
)

echo 构建项目...
cmake --build . --config Debug
if errorlevel 1 (
    echo 构建失败
    cd ..\..
    exit /b 1
)

cd ..\..
echo 构建成功！
echo 可执行文件位置: build\windows\x64\runner\Debug\robin_video.exe
