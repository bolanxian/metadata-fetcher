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
    name_ptr: *const u8,
    name_len: usize,
    path_ptr: *const u8,
    path_len: usize,
) -> i32 {
    if unsafe { UI.is_some() } {
        func(-1);
        return -1;
    }
    if nwg::init().is_err() {
        func(-2);
        return -2;
    }
    let name = unsafe { from_pointer(name_ptr, name_len) };
    let path = unsafe { from_pointer(path_ptr, path_len) };
    let ui = SystemTray::build_ui(SystemTray::new(func, name, path)).ok();
    if ui.is_none() {
        func(-3);
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
    text_ptr: *const u8,
    text_len: usize,
    title_ptr: *const u8,
    title_len: usize,
) {
    if let Some(ui) = unsafe { &*addr_of!(UI) } {
        let text = unsafe { from_pointer(text_ptr, text_len) };
        let title = if title_len > 0 {
            Some(unsafe { from_pointer(title_ptr, title_len) })
        } else {
            None
        };
        ui.notification(&text, title.as_deref());
    }
}
