use std::cell::Cell;
use std::ffi::OsString;
use std::ops::Deref;
use std::rc::{Rc, Weak};
use std::sync::{mpsc, Arc};

type ExecuterHandle = Box<dyn FnOnce(&SystemTrayInner) + Send>;

pub enum MenuEnum {
    #[allow(unused)]
    SubMenu(nwg::Menu),

    Item(nwg::MenuItem, &'static str),

    #[allow(unused)]
    Separator(nwg::MenuSeparator),
}
pub struct SystemTray<
    'a,
    OnBuild: FnOnce(&mut SystemTrayInit),
    OnClick: Fn(&SystemTrayInner),
    OnSelect: Fn(&SystemTrayInner, &str, &nwg::MenuItem),
> {
    pub name: &'a str,
    pub icon_path: &'a str,
    pub on_build: OnBuild,
    pub on_click: OnClick,
    pub on_select: OnSelect,
}
pub struct SystemTrayInit<'a> {
    list: Vec<MenuEnum>,
    error_list: Vec<nwg::NwgError>,
    menu: &'a nwg::Menu,
}
#[derive(Default)]
pub struct SystemTrayInnerInner {
    window: nwg::MessageWindow,
    notice: nwg::Notice,
    icon: nwg::Icon,
    tray: nwg::TrayNotification,
    menu: nwg::Menu,
    picker_file: nwg::FileDialog,
    picker_directory: nwg::FileDialog,
}
pub struct SystemTrayInner {
    inner: SystemTrayInnerInner,
    item_list: Box<[MenuEnum]>,

    on_click: Box<dyn Fn(&SystemTrayInner)>,
    on_select: Box<dyn Fn(&SystemTrayInner, &str, &nwg::MenuItem)>,

    notice_rx: mpsc::Receiver<ExecuterHandle>,
}
pub struct Executer {
    notice_tx: mpsc::SyncSender<ExecuterHandle>,
    notice_sender: nwg::NoticeSender,
}
pub struct SystemTrayUi {
    inner: Rc<SystemTrayInner>,
    pub executer: Arc<Executer>,
    handler_list: Cell<Box<[nwg::EventHandler]>>,
}

impl SystemTrayInit<'_> {
    pub fn submenu<OnBuild>(&mut self, text: &str, on_build: OnBuild)
    where
        OnBuild: FnOnce(&mut SystemTrayInit) + 'static,
    {
        let mut menu: nwg::Menu = Default::default();
        if let Err(e) = nwg::Menu::builder()
            .text(text)
            .parent(self.menu)
            .build(&mut menu)
        {
            self.error_list.push(e);
            return;
        }

        let mut init = SystemTrayInit {
            list: Vec::new(),
            error_list: Vec::new(),
            menu: &menu,
        };
        on_build(&mut init);
        let item_list = init.list;

        self.error_list.extend(init.error_list);
        self.list.push(MenuEnum::SubMenu(menu));
        self.list.extend(item_list);
    }
    pub fn item(&mut self, text: &str, name: &'static str) {
        let mut item: nwg::MenuItem = Default::default();
        if let Err(e) = nwg::MenuItem::builder()
            .text(text)
            .parent(self.menu)
            .build(&mut item)
        {
            self.error_list.push(e);
            return;
        }
        self.list.push(MenuEnum::Item(item, name));
    }
    pub fn separator(&mut self) {
        let mut sep: nwg::MenuSeparator = Default::default();
        if let Err(e) = nwg::MenuSeparator::builder()
            .parent(self.menu)
            .build(&mut sep)
        {
            self.error_list.push(e);
            return;
        }
        self.list.push(MenuEnum::Separator(sep));
    }
}
impl SystemTrayInner {
    pub fn show_menu(&self) {
        let (x, y) = nwg::GlobalCursor::position();
        self.menu.popup(x, y);
    }
    pub fn notification<'a>(&self, text: &'a str, title: Option<&'a str>) {
        use nwg::TrayNotificationFlags as Flags;
        let flags = Flags::USER_ICON | Flags::LARGE_ICON;
        self.tray.show(text, title, Some(flags), Some(&self.icon));
    }
    pub fn pick(&self, action: nwg::FileDialogAction) -> Option<OsString> {
        use nwg::FileDialogAction as Action;
        let picker = match action {
            Action::OpenDirectory => &self.picker_directory,
            Action::Open => &self.picker_file,
            Action::Save => return None,
        };
        if !picker.run(Some(&self.window)) {
            return None;
        }
        picker.get_selected_item().ok()
    }
    pub fn find(&self, name: &str) -> Option<&nwg::MenuItem> {
        self.item_list.iter().find_map(|item| {
            if let MenuEnum::Item(item, target_name) = item {
                if name == *target_name {
                    return Some(item);
                }
            }
            None
        })
    }
    fn find_handle(&self, handle: &nwg::ControlHandle) -> Option<(&str, &nwg::MenuItem)> {
        self.item_list.iter().find_map(|item| {
            if let MenuEnum::Item(item, target_name) = item {
                if handle == item {
                    return Some((*target_name, item));
                }
            }
            None
        })
    }
    fn handle_event(&self, e: &nwg::Event, handle: &nwg::ControlHandle) {
        use nwg::Event as E;
        match e {
            E::OnMousePress(nwg::MousePressEvent::MousePressLeftUp) => match () {
                () if handle == &self.tray => (self.on_click)(self),
                () => (),
            },
            E::OnContextMenu => match () {
                () if handle == &self.tray => Self::show_menu(self),
                () => (),
            },
            E::OnMenuItemSelected => {
                if let Some((name, item)) = Self::find_handle(self, handle) {
                    (self.on_select)(self, name, item);
                }
            }
            E::OnNotice => match () {
                () if handle == &self.notice => {
                    while let Ok(handle) = self.notice_rx.try_recv() {
                        handle(self);
                    }
                }
                () => (),
            },
            _ => {}
        }
    }
}
impl Executer {
    pub fn run<F, T>(&self, f: F) -> Option<T>
    where
        F: FnOnce(&SystemTrayInner) -> T + Send + 'static,
        T: Send + 'static,
    {
        let (tx, rx) = mpsc::sync_channel::<T>(0);
        let handle: ExecuterHandle = Box::new(move |ui| {
            let _ = tx.send(f(ui));
        });
        self.notice_tx.send(handle).ok()?;
        self.notice_sender.notice();
        rx.recv().ok()
    }
    pub fn run_async<F>(&self, f: F) -> Option<()>
    where
        F: FnOnce(&SystemTrayInner) + Send + 'static,
    {
        self.notice_tx.send(Box::new(f)).ok()?;
        self.notice_sender.notice();
        Some(())
    }
}

impl<OnBuild, OnClick, OnSelect> nwg::NativeUi<SystemTrayUi>
    for SystemTray<'_, OnBuild, OnClick, OnSelect>
where
    OnBuild: FnOnce(&mut SystemTrayInit) + 'static,
    OnClick: Fn(&SystemTrayInner) + 'static,
    OnSelect: Fn(&SystemTrayInner, &str, &nwg::MenuItem) + 'static,
{
    fn build_ui(options: Self) -> Result<SystemTrayUi, nwg::NwgError> {
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
            .build(&mut data.menu)?;

        nwg::FileDialog::builder()
            .action(nwg::FileDialogAction::Open)
            .build(&mut data.picker_file)?;

        nwg::FileDialog::builder()
            .action(nwg::FileDialogAction::OpenDirectory)
            .build(&mut data.picker_directory)?;

        let mut init = SystemTrayInit {
            list: Vec::new(),
            error_list: Vec::new(),
            menu: &data.menu,
        };
        (options.on_build)(&mut init);
        for e in init.error_list {
            return Err(e);
        }
        let item_list = init.list.into_boxed_slice();
        let (notice_tx, notice_rx) = mpsc::sync_channel(1);
        let notice_sender = data.notice.sender();

        let ui = SystemTrayUi {
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
            handler_list: Default::default(),
        };

        let handler = nwg::full_bind_event_handler(&ui.window.handle, {
            let ui = Rc::downgrade(&ui.inner);
            move |e, _evt_data, handle| {
                if let Some(ui) = Weak::upgrade(&ui) {
                    SystemTrayInner::handle_event(&ui, &e, &handle);
                }
            }
        });
        ui.handler_list.set(Box::from([handler]));

        Ok(ui)
    }
}

impl Drop for SystemTrayUi {
    fn drop(&mut self) {
        let handlers = self.handler_list.take();
        for handler in handlers {
            nwg::unbind_event_handler(&handler);
        }
    }
}

impl Deref for SystemTrayUi {
    type Target = SystemTrayInner;
    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}
impl Deref for SystemTrayInner {
    type Target = SystemTrayInnerInner;
    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}
