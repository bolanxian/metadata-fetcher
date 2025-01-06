use nwg::NativeUi;
use std::ptr::addr_of_mut;
use winapi::um::wincon::{GetConsoleWindow, SetConsoleOutputCP, SetConsoleTitleW};
use winapi::um::winuser::{ShowWindow, SW_HIDE, SW_SHOW};

mod system_tray;
use system_tray::{Dispatch, Handle, SystemTray, SystemTrayUi};
static mut UI: Option<SystemTrayUi> = None;

fn string_to_wide(string: &str) -> Vec<u16> {
    use std::ffi::OsStr;
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;
    OsStr::new(string).encode_wide().chain(once(0)).collect()
}
unsafe fn from_raw_parts<'a>(pointer: *const u8, length: usize) -> &'a str {
    use std::{slice::from_raw_parts, str::from_utf8_unchecked};
    from_utf8_unchecked(from_raw_parts(pointer, length))
}

#[no_mangle]
pub extern "C" fn set_console_output_code_page(code_page_id: u32) -> i32 {
    unsafe { SetConsoleOutputCP(code_page_id) }
}

#[no_mangle]
pub extern "C" fn set_title(title_ptr: *const u8, title_len: usize) -> i32 {
    let title = unsafe { from_raw_parts(title_ptr, title_len) };
    let wide = string_to_wide(title);
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
    let ui = unsafe { &mut *addr_of_mut!(UI) };
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
    *unsafe { &mut *addr_of_mut!(UI) } = None;
}

#[no_mangle]
pub extern "C" fn tray_notification(
    text_ptr: *const u8,
    text_len: usize,
    title_ptr: *const u8,
    title_len: usize,
) {
    if let Some(ui) = unsafe { UI.as_ref() } {
        let text = String::from(unsafe { from_raw_parts(text_ptr, text_len) });
        let title = if title_len > 0 { Some(()) } else { None };
        let title = title.map(|_| String::from(unsafe { from_raw_parts(title_ptr, title_len) }));
        ui.notification(&text, title.as_deref());
    }
}
