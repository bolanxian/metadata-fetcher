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
static EXECUTER: Mutex<Weak<Executer>> = Mutex::new(Weak::new());

mod string {
    use std::os::windows::ffi;
    use std::{iter, slice, str};
    pub fn to_wide(string: &str) -> iter::Chain<ffi::EncodeWide<'_>, iter::Once<u16>> {
        use ffi::OsStrExt;
        use std::ffi::OsStr;
        OsStr::new(string).encode_wide().chain(iter::once(0))
    }
    pub unsafe fn from_raw_parts<'a>(pointer: *const u8, length: usize) -> &'a str {
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
    let wide: Box<[u16]> = string::to_wide(title).collect();
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
    fn to_str(&self) -> Cow<str> {
        match *self {
            Self::Success => Cow::Borrowed("@success"),
            Self::AlreadyInited => Cow::Borrowed("!Already inited"),
            Self::InitError(ref e) => Cow::Owned(format!("!Nwg init error: {:?}", e)),
            Self::TrayBuildError(ref e) => Cow::Owned(format!("!Tray build error: {:?}", e)),
        }
    }
}

fn tray_init_inner(name: &str, icon: &str, handle: Handle) -> Result<SystemTrayUi, InitStatus> {
    nwg::init().map_err(InitStatus::InitError)?;

    let ui = SystemTray {
        name,
        icon_path: icon,
        on_build: |list| {
            list.push_item("open", "打开WebUI")?;
            list.push_item("pick_file", "打开文件")?;
            list.push_item("pick_directory", "打开目录")?;
            list.push_separator()?;
            list.push_item("create_lnk", "创建桌面快捷方式")?;
            list.push_separator()?;
            list.push_item("show", "显示控制台")?;
            list.push_item("hide", "隐藏控制台")?;
            list.push_separator()?;
            list.push_item("exit", "退出")?;
            Ok(())
        },
        on_click: move |_| {
            dispatch(handle, "@click");
        },
        on_select: move |ui, name| {
            if name.starts_with("pick_") {
                let is_dir = match name {
                    "pick_file" => false,
                    "pick_directory" => true,
                    _ => return,
                };
                let item = ui.pick(is_dir);
                let item = item.as_deref().map(OsStr::to_str).flatten();
                let Some(item) = item else { return };
                let item = format!("#{}{}", if is_dir { "D" } else { "F" }, item);
                dispatch(handle, item);
            } else {
                dispatch(handle, format!("@{}", name));
            }
        },
    };
    let ui = SystemTray::build_ui(ui).map_err(InitStatus::TrayBuildError)?;

    return Ok(ui);
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

    let (init_tx, init_rx) = mpsc::channel::<InitStatus>();
    let name = unsafe { string::from_raw_parts(name_ptr, name_len) };
    let icon = unsafe { string::from_raw_parts(path_ptr, path_len) };

    *thread = Some(thread::spawn(move || {
        let ui = match tray_init_inner(name, icon, handle) {
            Err(e) => {
                let _ = init_tx.send(e);
                return;
            }
            Ok(ui) => {
                let mut executer = EXECUTER.lock().unwrap_or_else(PoisonError::into_inner);
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

    let status = init_rx
        .recv()
        .unwrap_or_else(|_| InitStatus::InitError(nwg::NwgError::Unknown));
    dispatch(handle, status.to_str().as_ref());
    let InitStatus::Success = status else {
        *thread = None;
        return -1;
    };
    0
}

#[no_mangle]
pub extern "C" fn tray_deinit() {
    let executer = EXECUTER.lock().unwrap_or_else(PoisonError::into_inner);
    let Some(executer) = Weak::upgrade(&*executer) else {
        return;
    };
    executer.execute(|_| {
        nwg::stop_thread_dispatch();
    });
    let mut thread = THREAD.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(thread) = (*thread).take() {
        let _ = thread.join();
    }
}

#[no_mangle]
pub extern "C" fn show_console(show: i32) -> i32 {
    let executer = EXECUTER.lock().unwrap_or_else(PoisonError::into_inner);
    let Some(executer) = Weak::upgrade(&*executer) else {
        return -1;
    };
    if let Some(ret) = executer.execute(move |ui| {
        let show = show != 0;

        ui.find("show").map(|item| item.set_enabled(!show));
        ui.find("hide").map(|item| item.set_enabled(show));

        let show = if show { SW_SHOW } else { SW_HIDE };
        unsafe { ShowWindow(GetConsoleWindow(), show) }
    }) {
        return ret;
    }
    -1
}

#[no_mangle]
pub extern "C" fn tray_pick(handle: Handle, flags: u32) -> i32 {
    let executer = EXECUTER.lock().unwrap_or_else(PoisonError::into_inner);
    let Some(executer) = Weak::upgrade(&*executer) else {
        return -1;
    };
    let is_dir = flags & 0x1 != 0;
    if let Some(_) = executer.execute_async(move |ui| {
        let item = ui.pick(is_dir);
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
    let executer = EXECUTER.lock().unwrap_or_else(PoisonError::into_inner);
    let Some(executer) = Weak::upgrade(&*executer) else {
        return;
    };

    let text = unsafe { string::from_raw_parts(text_ptr, text_len) };
    let title = unsafe { string::from_raw_parts(title_ptr, title_len) };
    let title = if title_len > 0 { Some(title) } else { None };

    let _ = executer.execute(move |ui| {
        ui.notification(text, title);
    });
}
