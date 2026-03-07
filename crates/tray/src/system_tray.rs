use std::cell::RefCell;
use std::ffi::OsString;
use std::ops::Deref;
use std::rc::{Rc, Weak};
use std::sync::{mpsc, Arc};

type BuildResult = Result<(), nwg::NwgError>;
type ExecuterNotice = &'static (dyn Fn(&'static SystemTrayInner) + Sync);

pub enum MenuEnum {
    Item(&'static str, nwg::MenuItem),
    Separator(nwg::MenuSeparator),
}
pub struct SystemTray<
    'a,
    OnBuild: FnOnce(&mut SystemTrayBuild) -> BuildResult,
    OnClick: Fn(&SystemTrayInner),
    OnSelect: Fn(&SystemTrayInner, &str),
> {
    pub name: &'a str,
    pub icon_path: &'a str,
    pub on_build: OnBuild,
    pub on_click: OnClick,
    pub on_select: OnSelect,
}
pub struct SystemTrayBuild<'a> {
    list: Vec<MenuEnum>,
    menu: &'a nwg::Menu,
}
#[derive(Default)]
pub struct SystemTrayInnerInner {
    window: nwg::MessageWindow,
    notice: nwg::Notice,
    icon: nwg::Icon,
    tray: nwg::TrayNotification,
    tray_menu: nwg::Menu,
    picker_file: nwg::FileDialog,
    picker_directory: nwg::FileDialog,
}
pub struct SystemTrayInner {
    inner: SystemTrayInnerInner,
    item_list: Box<[MenuEnum]>,

    on_click: Box<dyn Fn(&SystemTrayInner)>,
    on_select: Box<dyn Fn(&SystemTrayInner, &str)>,

    notice_rx: mpsc::Receiver<ExecuterNotice>,
}
pub struct Executer {
    notice_tx: mpsc::Sender<ExecuterNotice>,
    notice_sender: nwg::NoticeSender,
}
pub struct SystemTrayUi {
    inner: Rc<SystemTrayInner>,
    pub executer: Arc<Executer>,
    default_handler: RefCell<Vec<nwg::EventHandler>>,
}

impl SystemTrayBuild<'_> {
    pub fn push_item(&mut self, name: &'static str, text: &str) -> BuildResult {
        let mut item: nwg::MenuItem = Default::default();
        nwg::MenuItem::builder()
            .text(text)
            .parent(self.menu)
            .build(&mut item)?;
        self.list.push(MenuEnum::Item(name, item));
        Ok(())
    }
    pub fn push_separator(&mut self) -> BuildResult {
        let mut sep: nwg::MenuSeparator = Default::default();
        nwg::MenuSeparator::builder()
            .parent(self.menu)
            .build(&mut sep)?;
        self.list.push(MenuEnum::Separator(sep));
        Ok(())
    }
}
impl SystemTrayInner {
    pub fn notification<'a>(&self, text: &'a str, title: Option<&'a str>) {
        use nwg::TrayNotificationFlags as Flags;
        let flags = Flags::USER_ICON | Flags::LARGE_ICON;
        self.tray.show(text, title, Some(flags), Some(&self.icon));
    }
    fn show_menu(&self) {
        let (x, y) = nwg::GlobalCursor::position();
        self.tray_menu.popup(x, y);
    }
    pub fn pick(&self, is_dir: bool) -> Option<OsString> {
        let picker = match is_dir {
            true => &self.picker_directory,
            false => &self.picker_file,
        };
        if !picker.run(Some(&self.window)) {
            return None;
        }
        let item = picker.get_selected_item();
        let Ok(item) = item else { return None };
        Some(item)
    }
    pub fn find(&self, name: &str) -> Option<&nwg::MenuItem> {
        self.item_list.iter().find_map(|item| {
            if let MenuEnum::Item(target_name, item) = item {
                if name == *target_name {
                    return Some(item);
                }
            }
            None
        })
    }
    fn find_handle(&self, handle: &nwg::ControlHandle) -> Option<(&str, &nwg::MenuItem)> {
        self.item_list.iter().find_map(|item| {
            match item {
                MenuEnum::Item(target_name, item) => {
                    if handle == item {
                        return Some((*target_name, item));
                    }
                }
                MenuEnum::Separator(item) => {
                    let _ = item;
                }
            }
            None
        })
    }
    fn handle_event(&self, evt: &nwg::Event, handle: &nwg::ControlHandle) {
        use nwg::Event as E;
        match evt {
            E::OnMousePress(nwg::MousePressEvent::MousePressLeftUp) => match () {
                () if handle == &self.tray => (self.on_click)(self),
                () => (),
            },
            E::OnContextMenu => match () {
                () if handle == &self.tray => Self::show_menu(self),
                () => (),
            },
            E::OnMenuItemSelected => {
                let item = Self::find_handle(self, handle);
                let Some((name, _)) = item else { return };
                (self.on_select)(self, name);
            }
            E::OnNotice => match () {
                () if handle == &self.notice => {
                    let ui: &'static Self = unsafe { &*&raw const *self };
                    while let Ok(f) = self.notice_rx.try_recv() {
                        f(ui);
                    }
                }
                () => (),
            },
            _ => {}
        }
    }
}
impl Executer {
    pub fn execute<F, T>(&self, f: F) -> Option<T>
    where
        F: Fn(&SystemTrayInner) -> T + Sync + 'static,
        T: Send + 'static,
    {
        let (tx, rx) = mpsc::channel::<T>();
        let handle = move |ui| {
            let _ = tx.send(f(ui));
        };
        self.notice_tx.send(unsafe { &*&raw const handle }).ok()?;
        self.notice_sender.notice();
        rx.recv().ok()
    }
}

impl<OnBuild, OnClick, OnSelect> nwg::NativeUi<SystemTrayUi>
    for SystemTray<'_, OnBuild, OnClick, OnSelect>
where
    OnBuild: FnOnce(&mut SystemTrayBuild) -> BuildResult + 'static,
    OnClick: Fn(&SystemTrayInner) + 'static,
    OnSelect: Fn(&SystemTrayInner, &str) + 'static,
{
    fn build_ui(
        options: SystemTray<OnBuild, OnClick, OnSelect>,
    ) -> Result<SystemTrayUi, nwg::NwgError> {
        use SystemTrayUi as Ui;

        let name = Some(options.name);
        let icon = Some(options.icon_path);

        let mut data: SystemTrayInnerInner = Default::default();

        nwg::Icon::builder()
            .source_file(icon)
            .build(&mut data.icon)?;

        nwg::MessageWindow::builder().build(&mut data.window)?;

        nwg::Notice::builder()
            .parent(&data.window)
            .build(&mut data.notice)?;

        nwg::TrayNotification::builder()
            .parent(&data.window)
            .icon(Some(&data.icon))
            .tip(name)
            .build(&mut data.tray)?;

        nwg::Menu::builder()
            .popup(true)
            .parent(&data.window)
            .build(&mut data.tray_menu)?;

        nwg::FileDialog::builder()
            .action(nwg::FileDialogAction::Open)
            .build(&mut data.picker_file)?;

        nwg::FileDialog::builder()
            .action(nwg::FileDialogAction::OpenDirectory)
            .build(&mut data.picker_directory)?;

        let mut init = SystemTrayBuild {
            list: Vec::new(),
            menu: &data.tray_menu,
        };
        (options.on_build)(&mut init)?;
        let item_list = init.list.into_boxed_slice();
        let (notice_tx, notice_rx) = mpsc::channel();
        let notice_sender = data.notice.sender();

        let ui = Ui {
            inner: Rc::new(SystemTrayInner {
                inner: data,
                item_list,
                on_click: Box::new(options.on_click),
                on_select: Box::new(options.on_select),
                notice_rx,
            }),
            executer: Arc::new(Executer {
                notice_tx,
                notice_sender,
            }),
            default_handler: Default::default(),
        };

        let evt_ui = Rc::downgrade(&ui.inner);
        let handle_events = move |evt, _evt_data, handle| {
            if let Some(evt_ui) = Weak::upgrade(&evt_ui) {
                SystemTrayInner::handle_event(&evt_ui, &evt, &handle);
            }
        };

        ui.default_handler
            .borrow_mut()
            .push(nwg::full_bind_event_handler(
                &ui.window.handle,
                handle_events,
            ));

        Ok(ui)
    }
}

impl Drop for SystemTrayUi {
    fn drop(&mut self) {
        let mut handlers = self.default_handler.borrow_mut();
        for handler in handlers.drain(0..) {
            nwg::unbind_event_handler(&handler);
        }
    }
}

impl Deref for SystemTrayUi {
    type Target = SystemTrayInner;
    fn deref(&self) -> &SystemTrayInner {
        &self.inner
    }
}
impl Deref for SystemTrayInner {
    type Target = SystemTrayInnerInner;
    fn deref(&self) -> &SystemTrayInnerInner {
        &self.inner
    }
}
