//#![windows_subsystem = "windows"]

extern crate nwg;
use nwg::NativeUi;

mod system_tray;
use system_tray::*;

use std::ptr::addr_of;
use std::{slice::from_raw_parts, str::from_utf8_unchecked};
unsafe fn from_pointer(pointer: *const u8, length: usize) -> String {
    String::from(from_utf8_unchecked(from_raw_parts(pointer, length)))
}

static mut UI: Option<SystemTrayUi> = None;

#[no_mangle]
pub extern "C" fn init(
    func: extern "C" fn(i32),
    _name: *const u8,
    _name_length: usize,
    _path: *const u8,
    _path_length: usize,
) -> i32 {
    if unsafe { UI.is_some() } {
        return -1;
    }
    if nwg::init().is_err() {
        return -2;
    }
    let name = unsafe { from_pointer(_name, _name_length) };
    let path = unsafe { from_pointer(_path, _path_length) };
    let ui = SystemTray::build_ui(SystemTray::new(func, name, path)).ok();
    if ui.is_none() {
        return -3;
    }
    unsafe { UI = ui };
    func(0);
    nwg::dispatch_thread_events();
    return 0;
}

#[no_mangle]
pub extern "C" fn deinit() {
    nwg::stop_thread_dispatch();
    unsafe { UI = None };
}

#[no_mangle]
pub extern "C" fn notification(
    _text: *const u8,
    _text_length: usize,
    _title: *const u8,
    _title_length: usize,
) {
    if let Some(ui) = unsafe { &*addr_of!(UI) } {
        let text = unsafe { from_pointer(_text, _text_length) };
        let title = if _title_length > 0 {
            Some(unsafe { from_pointer(_title, _title_length) })
        } else {
            None
        };
        ui.notification(&text, title.as_deref());
    }
}
