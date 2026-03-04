use nwg::NativeUi;
use std::borrow::Cow;
use std::ops::DerefMut;
use std::rc::Rc;
use std::sync::{mpsc, Mutex, PoisonError};
use std::thread;
use winapi::um::wincon::{GetConsoleWindow, SetConsoleOutputCP, SetConsoleTitleW};
use winapi::um::winuser::{ShowWindow, SW_HIDE, SW_SHOW};

mod system_tray;
use system_tray::{Dispatch, Handle, SystemTray, SystemTrayUi};
static THREAD: Mutex<Option<thread::JoinHandle<()>>> = Mutex::new(None);
static TX: Mutex<Option<(nwg::NoticeSender, mpsc::Sender<Event>)>> = Mutex::new(None);
static mut UI: Option<SystemTrayUi> = None;

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
impl Dispatch<Handle, &InitStatus> for SystemTray {
    fn dispatch(handle: Handle, data: &InitStatus) {
        let data = InitStatus::to_str(data);
        SystemTray::dispatch(handle, &*data);
    }
}

enum Event<'a> {
    Deinit,
    ShowConsole(mpsc::Sender<i32>, i32),
    Notification(mpsc::Sender<()>, &'a str, Option<&'a str>),
}
impl Event<'_> {
    fn dispatch(self, ui: &SystemTrayUi) {
        match self {
            Event::Deinit => {
                nwg::stop_thread_dispatch();
            }
            Event::ShowConsole(tx, show) => {
                let show = show != 0;
                ui.set_show(show);
                let show = if show { SW_SHOW } else { SW_HIDE };
                let ret = unsafe { ShowWindow(GetConsoleWindow(), show) };
                let _ = tx.send(ret);
            }
            Event::Notification(tx, text, title) => {
                ui.notification(text, title);
                let _ = tx.send(());
            }
        }
    }
}

fn tray_init_inner<Ui: DerefMut<Target = Option<SystemTrayUi>>>(
    mut ui: Ui,
    name: &str,
    icon: &str,
    handle: Handle,
    on_notice: Box<dyn Fn()>,
) -> Result<nwg::NoticeSender, InitStatus> {
    if ui.is_some() {
        return Err(InitStatus::AlreadyInited);
    }
    nwg::init().map_err(InitStatus::InitError)?;

    let name = Rc::new(String::from(name));
    let icon = Rc::new(String::from(icon));

    let tray_ui = SystemTray::new(
        handle,
        Rc::downgrade(&name),
        Rc::downgrade(&icon),
        on_notice,
    );
    let tray_ui = SystemTray::build_ui(tray_ui).map_err(InitStatus::TrayBuildError)?;
    let sender = tray_ui.notice.sender();

    *ui = Some(tray_ui);
    return Ok(sender);
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
    if (*thread).is_some() {
        SystemTray::dispatch(handle, &InitStatus::AlreadyInited);
        return -1;
    }

    let (init_tx, init_rx) = mpsc::channel::<InitStatus>();
    let name = unsafe { string::from_raw_parts(name_ptr, name_len) };
    let icon = unsafe { string::from_raw_parts(path_ptr, path_len) };

    *thread = Some(thread::spawn(move || {
        let (ev_tx, ev_rx) = mpsc::channel::<Event>();
        let on_notice = Box::new(move || {
            let Some(ui) = (unsafe { UI.as_ref() }) else {
                return;
            };
            while let Ok(ev) = ev_rx.try_recv() {
                Event::dispatch(ev, ui);
            }
        });
        let ui = unsafe { &mut *&raw mut UI };
        match tray_init_inner(&mut *ui, name, icon, handle, on_notice) {
            Err(e) => {
                let _ = init_tx.send(e);
                return;
            }
            Ok(sender) => {
                let mut tx = TX.lock().unwrap_or_else(PoisonError::into_inner);
                *tx = Some((sender, ev_tx));
            }
        }
        if init_tx.send(InitStatus::Success).is_err() {
            return;
        }
        nwg::dispatch_thread_events();
        *ui = None;
    }));

    let status = init_rx
        .recv()
        .unwrap_or_else(|_| InitStatus::InitError(nwg::NwgError::Unknown));
    SystemTray::dispatch(handle, &status);
    match status {
        InitStatus::Success => drop(thread),
        _ => *thread = None,
    }
    match status {
        InitStatus::Success => 0,
        _ => -1,
    }
}

#[no_mangle]
pub extern "C" fn tray_deinit() {
    let tx = TX.lock().unwrap_or_else(PoisonError::into_inner);
    let Some((ref sender, ref ev_tx)) = *tx else {
        return;
    };
    let _ = ev_tx.send(Event::Deinit);
    sender.notice();
    let mut thread = THREAD.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(thread) = (*thread).take() {
        let _ = thread.join();
    }
}

#[no_mangle]
pub extern "C" fn show_console(show: i32) -> i32 {
    let tx = TX.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some((ref sender, ref ev_tx)) = *tx {
        let (tx, rx) = mpsc::channel::<i32>();
        let _ = ev_tx.send(Event::ShowConsole(tx, show));
        sender.notice();
        if let Ok(ret) = rx.recv() {
            return ret;
        }
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
    let tx = TX.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some((ref sender, ref ev_tx)) = *tx {
        let text = unsafe { string::from_raw_parts(text_ptr, text_len) };
        let title = unsafe { string::from_raw_parts(title_ptr, title_len) };
        let title = if title_len > 0 { Some(title) } else { None };

        let (tx, rx) = mpsc::channel::<()>();
        let _ = ev_tx.send(Event::Notification(tx, text, title));
        sender.notice();
        let _ = rx.recv();
    }
}
