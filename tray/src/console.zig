const std = @import("std");
const windows = std.os.windows;
const BOOL = windows.BOOL;
const HANDLE = windows.HANDLE;
const WINAPI = windows.WINAPI;

pub extern "kernel32" fn GetConsoleWindow() callconv(WINAPI) HANDLE;
pub extern "user32" fn ShowWindow(hWnd: HANDLE, nCmdShow: c_int) callconv(WINAPI) BOOL;

const SW_HIDE = 0;
const SW_SHOW = 5;

pub export fn hideConsole() void {
    _ = ShowWindow(GetConsoleWindow(), SW_HIDE);
}

pub export fn showConsole() void {
    _ = ShowWindow(GetConsoleWindow(), SW_SHOW);
}
