use nwg::NativeUi;
use std::borrow::Cow;
use std::ffi::OsStr;
use std::sync::{mpsc, Arc, Mutex, PoisonError, Weak};
use std::thread;
use winapi::um::wincon::{GetConsoleWindow, SetConsoleOutputCP, SetConsoleTitleW};
use winapi::um::winuser::{ShowWindow, SW_HIDE, SW_SHOW};

mod system_tray;
use system_tray::{Executer, SystemTray, SystemTrayUi};
static THREAD: Mutex<Option<thread::JoinHandle<()>>> = Mutex::new(None);
static UI: Mutex<Weak<Executer>> = Mutex::new(Weak::new());

mod string {
    use std::{ffi, iter, slice, str};
    pub fn to_wide(string: &str) -> Box<[u16]> {
        use std::os::windows::ffi::OsStrExt;
        ffi::OsStr::new(string)
            .encode_wide()
            .chain(iter::once(0))
            .collect()
    }
    pub unsafe fn from_raw_parts(pointer: *const u8, length: usize) -> &'static str {
        str::from_utf8_unchecked(slice::from_raw_parts(pointer, length))
    }
}

#[no_mangle]
pub extern "C" fn set_console_output_code_page(code_page_id: u32) -> i32 {
    unsafe { SetConsoleOutputCP(code_page_id) }
}

#[no_mangle]
pub extern "C" fn set_title(title_ptr: *const u8, title_len: usize) -> i32 {
    let title = unsafe { string::from_raw_parts(title_ptr, title_len) };
    let wide = string::to_wide(title);
    unsafe { SetConsoleTitleW(wide.as_ptr()) }
}

type Handle = extern "C" fn(*const u8, usize);
fn dispatch<S: AsRef<[u8]>>(handle: Handle, data: S) {
    let data = S::as_ref(&data);
    handle(<[u8]>::as_ptr(data), <[u8]>::len(data));
}

enum InitStatus {
    Success,
    AlreadyInited,
    InitError(nwg::NwgError),
    TrayBuildError(nwg::NwgError),
}
impl InitStatus {
    fn to_str(&self) -> Cow<'static, str> {
        match *self {
            Self::Success => Cow::Borrowed("@success"),
            Self::AlreadyInited => Cow::Borrowed("!Already inited"),
            Self::InitError(ref e) => Cow::Owned(format!("!Nwg init error: {:?}", e)),
            Self::TrayBuildError(ref e) => Cow::Owned(format!("!Tray build error: {:?}", e)),
        }
    }
}
impl Default for InitStatus {
    fn default() -> Self {
        Self::InitError(nwg::NwgError::Unknown)
    }
}

fn tray_init_inner(
    name: &str,
    icon_path: &str,
    handle: Handle,
) -> Result<SystemTrayUi, InitStatus> {
    nwg::init().map_err(InitStatus::InitError)?;

    let ui = SystemTray {
        name,
        icon_path,
        on_build: |ui| {
            ui.item("打开WebUI(&O)", "open");
            ui.item("打开文件(&F)", "pick_file");
            ui.item("打开目录(&D)", "pick_directory");
            ui.separator();
            ui.submenu("附件", |ui| {
                ui.item("创建桌面快捷方式", "create_lnk");
            });
            ui.separator();
            ui.submenu("控制台", |ui| {
                ui.item("显示(&S)", "show");
                ui.item("隐藏(&H)", "hide");
            });
            ui.separator();
            ui.item("退出", "exit");
        },
        on_click: move |_| {
            dispatch(handle, "@click");
        },
        on_select: move |ui, name, _| {
            use nwg::FileDialogAction as Action;
            if name.starts_with("pick_") {
                let (action, prefix) = match name {
                    "pick_file" => (Action::Open, "F"),
                    "pick_directory" => (Action::OpenDirectory, "D"),
                    _ => return,
                };
                let item = ui.pick(action);
                let item = item.as_deref().map(OsStr::to_str).flatten();
                let Some(item) = item else { return };
                let item = format!("#{}{}", prefix, item);
                dispatch(handle, item);
            } else {
                dispatch(handle, format!("@{}", name));
            }
        },
    };
    SystemTray::build_ui(ui).map_err(InitStatus::TrayBuildError)
}

#[no_mangle]
pub extern "C" fn tray_init(
    name_ptr: *const u8,
    name_len: usize,
    path_ptr: *const u8,
    path_len: usize,
    handle: Handle,
) -> i32 {
    let mut thread = THREAD.lock().unwrap_or_else(PoisonError::into_inner);
    let None = *thread else {
        dispatch(handle, InitStatus::AlreadyInited.to_str().as_ref());
        return -1;
    };

    let (init_tx, init_rx) = mpsc::sync_channel::<InitStatus>(0);
    let name = unsafe { string::from_raw_parts(name_ptr, name_len) };
    let icon = unsafe { string::from_raw_parts(path_ptr, path_len) };

    *thread = Some(thread::spawn(move || {
        let ui = match tray_init_inner(name, icon, handle) {
            Err(e) => {
                let _ = init_tx.send(e);
                return;
            }
            Ok(ui) => {
                let mut executer = UI.lock().unwrap_or_else(PoisonError::into_inner);
                *executer = Arc::downgrade(&ui.executer);
                ui
            }
        };
        let Ok(_) = init_tx.send(InitStatus::Success) else {
            return;
        };
        nwg::dispatch_thread_events();
        drop(ui);
    }));

    let status = init_rx.recv().unwrap_or_default();
    dispatch(handle, status.to_str().as_ref());
    let InitStatus::Success = status else {
        *thread = None;
        return -1;
    };
    0
}

#[no_mangle]
pub extern "C" fn tray_deinit() {
    let ui = UI.lock().unwrap_or_else(PoisonError::into_inner);
    let Some(ui) = Weak::upgrade(&*ui) else {
        return;
    };
    ui.run_async(|_| {
        nwg::stop_thread_dispatch();
    });
    let mut thread = THREAD.lock().unwrap_or_else(PoisonError::into_inner);
    let _ = Option::take(&mut *thread)
        .map(thread::JoinHandle::join)
        .transpose();
}

#[no_mangle]
pub extern "C" fn show_console(show: i32) -> i32 {
    let ui = UI.lock().unwrap_or_else(PoisonError::into_inner);
    let Some(ui) = Weak::upgrade(&*ui) else {
        return 0;
    };
    if let Some(ret) = ui.run(move |ui| {
        let show = show != 0;

        ui.find("show").map(|item| item.set_enabled(!show));
        ui.find("hide").map(|item| item.set_enabled(show));

        let show = if show { SW_SHOW } else { SW_HIDE };
        unsafe { ShowWindow(GetConsoleWindow(), show) }
    }) {
        return ret;
    }
    0
}

#[no_mangle]
pub extern "C" fn tray_pick(handle: Handle, flags: u32) -> i32 {
    let ui = UI.lock().unwrap_or_else(PoisonError::into_inner);
    let Some(ui) = Weak::upgrade(&*ui) else {
        return -1;
    };
    use nwg::FileDialogAction as Action;
    let action = match flags & 0x1 {
        0 => Action::Open,
        _ => Action::OpenDirectory,
    };
    if let Some(_) = ui.run_async(move |ui| {
        let item = ui.pick(action);
        let item = item.as_deref().map(OsStr::to_str).flatten();
        dispatch(handle, item.unwrap_or(""));
    }) {
        return 0;
    }
    -1
}

#[no_mangle]
pub extern "C" fn tray_notification(
    text_ptr: *const u8,
    text_len: usize,
    title_ptr: *const u8,
    title_len: usize,
) {
    let ui = UI.lock().unwrap_or_else(PoisonError::into_inner);
    let Some(ui) = Weak::upgrade(&*ui) else {
        return;
    };

    let text = unsafe { string::from_raw_parts(text_ptr, text_len) };
    let title = unsafe { string::from_raw_parts(title_ptr, title_len) };
    let title = if title_len > 0 { Some(title) } else { None };

    let _ = ui.run(move |ui| {
        ui.notification(text, title);
    });
}
