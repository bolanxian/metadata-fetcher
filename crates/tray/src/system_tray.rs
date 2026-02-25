use std::cell::RefCell;
use std::ops::Deref;
use std::rc::{Rc, Weak};

pub type Handle = extern "C" fn(*const u8, usize);

pub struct SystemTray {
    pub window: nwg::MessageWindow,
    pub icon: nwg::Icon,
    pub tray: nwg::TrayNotification,
    pub tray_menu: nwg::Menu,
    pub picker_file: nwg::FileDialog,
    pub picker_directory: nwg::FileDialog,

    pub item_open: nwg::MenuItem,
    pub item_pick_file: nwg::MenuItem,
    pub item_pick_directory: nwg::MenuItem,
    pub item_sep1: nwg::MenuSeparator,
    pub item_show: nwg::MenuItem,
    pub item_hide: nwg::MenuItem,
    pub item_sep2: nwg::MenuSeparator,
    pub item_exit: nwg::MenuItem,

    pub handle: Handle,
    pub name: Weak<String>,
    pub icon_path: Weak<String>,
}

pub trait Dispatch<T, A> {
    fn dispatch(_: T, _: A);
}
impl<S: AsRef<[u8]>> Dispatch<Handle, S> for SystemTray {
    fn dispatch(handle: Handle, data: S) {
        let data = S::as_ref(&data);
        handle(<[u8]>::as_ptr(data), <[u8]>::len(data));
    }
}
impl<S: AsRef<[u8]>> Dispatch<&SystemTray, S> for SystemTray {
    fn dispatch(this: &SystemTray, data: S) {
        SystemTray::dispatch(this.handle, data);
    }
}

impl SystemTray {
    pub fn new(handle: Handle, name: Weak<String>, icon: Weak<String>) -> SystemTray {
        SystemTray {
            window: Default::default(),
            icon: Default::default(),
            tray: Default::default(),
            tray_menu: Default::default(),
            picker_file: Default::default(),
            picker_directory: Default::default(),

            item_open: Default::default(),
            item_pick_file: Default::default(),
            item_pick_directory: Default::default(),
            item_sep1: Default::default(),
            item_show: Default::default(),
            item_hide: Default::default(),
            item_sep2: Default::default(),
            item_exit: Default::default(),

            handle: handle,
            name: name,
            icon_path: icon,
        }
    }
    pub fn notification<'a>(&self, text: &'a str, title: Option<&'a str>) {
        use nwg::TrayNotificationFlags as Flags;
        let flags = Flags::USER_ICON | Flags::LARGE_ICON;
        self.tray.show(text, title, Some(flags), Some(&self.icon));
    }
    pub fn set_show(&self, show: bool) {
        self.item_show.set_enabled(!show);
        self.item_hide.set_enabled(show);
    }
    fn show_menu(&self) {
        let (x, y) = nwg::GlobalCursor::position();
        self.tray_menu.popup(x, y);
    }
    fn click(&self) {
        SystemTray::dispatch(self, "@click");
    }
    fn open(&self) {
        SystemTray::dispatch(self, "@open");
    }
    fn pick(&self, is_dir: bool) {
        let picker = match is_dir {
            true => &self.picker_directory,
            false => &self.picker_file,
        };
        if !picker.run(Some(&self.window)) {
            return;
        }
        let item = match picker.get_selected_item() {
            Ok(item) => item,
            Err(_) => return,
        };
        let item = match item.to_str() {
            Some(item) => item,
            None => return,
        };
        let ret = format!("#{}{}", if is_dir { "D" } else { "F" }, item);
        SystemTray::dispatch(self, &ret);
    }
    fn show(&self) {
        SystemTray::dispatch(self, "@show");
    }
    fn hide(&self) {
        SystemTray::dispatch(self, "@hide");
    }
    fn exit(&self) {
        SystemTray::dispatch(self, "@exit");
    }
    fn handle_event(&self, evt: &nwg::Event, handle: &nwg::ControlHandle) {
        use nwg::Event as E;
        match evt {
            E::OnMousePress(nwg::MousePressEvent::MousePressLeftUp) => match () {
                () if handle == &self.tray => Self::click(self),
                () => (),
            },
            E::OnContextMenu => match () {
                () if handle == &self.tray => Self::show_menu(self),
                () => (),
            },
            E::OnMenuItemSelected => match () {
                () if handle == &self.item_open => Self::open(self),
                () if handle == &self.item_pick_file => Self::pick(self, false),
                () if handle == &self.item_pick_directory => Self::pick(self, true),
                () if handle == &self.item_show => Self::show(self),
                () if handle == &self.item_hide => Self::hide(self),
                () if handle == &self.item_exit => Self::exit(self),
                () => (),
            },
            _ => {}
        }
    }
}

pub struct SystemTrayUi {
    inner: Rc<SystemTray>,
    default_handler: RefCell<Vec<nwg::EventHandler>>,
}

type BuildResult = Result<(), nwg::NwgError>;
trait Build<T, A> {
    fn build(_: &nwg::Menu, _: &mut T, _: A) -> BuildResult;
}
impl Build<nwg::MenuItem, &str> for SystemTrayUi {
    fn build(menu: &nwg::Menu, item: &mut nwg::MenuItem, text: &str) -> BuildResult {
        nwg::MenuItem::builder().text(text).parent(menu).build(item)
    }
}
impl Build<nwg::MenuSeparator, ()> for SystemTrayUi {
    fn build(menu: &nwg::Menu, sep: &mut nwg::MenuSeparator, _: ()) -> BuildResult {
        nwg::MenuSeparator::builder().parent(menu).build(sep)
    }
}

impl nwg::NativeUi<SystemTrayUi> for SystemTray {
    fn build_ui(mut data: SystemTray) -> Result<SystemTrayUi, nwg::NwgError> {
        use SystemTrayUi as Ui;

        let name = Weak::upgrade(&data.name);
        let name: Option<&str> = name.as_deref().map(String::as_str);
        let icon = Weak::upgrade(&data.icon_path);
        let icon: Option<&str> = icon.as_deref().map(String::as_str);

        nwg::Icon::builder()
            .source_file(icon)
            .build(&mut data.icon)?;

        nwg::MessageWindow::builder().build(&mut data.window)?;

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

        let menu = &data.tray_menu;
        Ui::build(menu, &mut data.item_open, "打开WebUI")?;
        Ui::build(menu, &mut data.item_pick_file, "打开文件")?;
        Ui::build(menu, &mut data.item_pick_directory, "打开目录")?;
        Ui::build(menu, &mut data.item_sep1, ())?;
        Ui::build(menu, &mut data.item_show, "显示控制台")?;
        Ui::build(menu, &mut data.item_hide, "隐藏控制台")?;
        Ui::build(menu, &mut data.item_sep2, ())?;
        Ui::build(menu, &mut data.item_exit, "退出")?;

        let ui = Ui {
            inner: Rc::new(data),
            default_handler: Default::default(),
        };

        let evt_ui = Rc::downgrade(&ui.inner);
        let handle_events = move |evt, _evt_data, handle| {
            if let Some(evt_ui) = Weak::upgrade(&evt_ui) {
                SystemTray::handle_event(&evt_ui, &evt, &handle);
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
    type Target = SystemTray;

    fn deref(&self) -> &SystemTray {
        &self.inner
    }
}
