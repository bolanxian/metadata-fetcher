use nwg::NativeUi;
use winapi::um::wincon::{GetConsoleWindow, SetConsoleOutputCP, SetConsoleTitleW};
use winapi::um::winuser::{ShowWindow, SW_HIDE, SW_SHOW};

mod system_tray;
use system_tray::{Dispatch, Handle, SystemTray, SystemTrayUi};
static mut UI: Option<SystemTrayUi> = None;

use std::os::windows::ffi;
use std::{iter, slice, str};
fn string_to_wide(string: &str) -> iter::Chain<ffi::EncodeWide<'_>, iter::Once<u16>> {
    use ffi::OsStrExt;
    use std::ffi::OsStr;
    OsStr::new(string).encode_wide().chain(iter::once(0))
}
unsafe fn from_raw_parts<'a>(pointer: *const u8, length: usize) -> &'a str {
    str::from_utf8_unchecked(slice::from_raw_parts(pointer, length))
}

#[no_mangle]
pub extern "C" fn set_console_output_code_page(code_page_id: u32) -> i32 {
    unsafe { SetConsoleOutputCP(code_page_id) }
}

#[no_mangle]
pub extern "C" fn set_title(title_ptr: *const u8, title_len: usize) -> i32 {
    let title = unsafe { from_raw_parts(title_ptr, title_len) };
    let wide: Box<[u16]> = string_to_wide(title).collect();
    unsafe { SetConsoleTitleW(wide.as_ptr()) }
}

#[no_mangle]
pub extern "C" fn show_console(show: i32) -> i32 {
    let show = show != 0;
    unsafe { UI.as_ref() }.map(|ui| ui.set_show(show));
    unsafe { ShowWindow(GetConsoleWindow(), if show { SW_SHOW } else { SW_HIDE }) }
}

#[no_mangle]
pub extern "C" fn tray_init(
    name_ptr: *const u8,
    name_len: usize,
    path_ptr: *const u8,
    path_len: usize,
    handle: Handle,
) -> i32 {
    let ui = unsafe { &mut *&raw mut UI };
    if ui.is_some() {
        SystemTray::dispatch(handle, "!Already inited");
        return -1;
    }
    if let Err(e) = nwg::init() {
        let msg = format!("!Nwg init error: {:?}", e);
        SystemTray::dispatch(handle, &msg);
        return -2;
    }
    let name = String::from(unsafe { from_raw_parts(name_ptr, name_len) });
    let path = String::from(unsafe { from_raw_parts(path_ptr, path_len) });
    *ui = match SystemTray::build_ui(SystemTray::new(handle, name, path)) {
        Ok(ui) => Some(ui),
        Err(e) => {
            let msg = format!("!Tray build error: {:?}", e);
            SystemTray::dispatch(handle, &msg);
            return -3;
        }
    };
    SystemTray::dispatch(handle, "@success");
    nwg::dispatch_thread_events();
    return 0;
}

#[no_mangle]
pub extern "C" fn tray_deinit() {
    nwg::stop_thread_dispatch();
    *unsafe { &mut *&raw mut UI } = None;
}

#[no_mangle]
pub extern "C" fn tray_notification(
    text_ptr: *const u8,
    text_len: usize,
    title_ptr: *const u8,
    title_len: usize,
) {
    if let Some(ui) = unsafe { UI.as_ref() } {
        let text = unsafe { from_raw_parts(text_ptr, text_len) };
        let title = unsafe { from_raw_parts(title_ptr, title_len) };
        let title = if title_len > 0 { Some(title) } else { None };
        ui.notification(text, title);
    }
}
