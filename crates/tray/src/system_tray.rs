use std::cell::RefCell;
use std::ops::Deref;
use std::rc::{Rc, Weak};

pub type Handle = extern "C" fn(*const u8, usize);
type BuildResult = Result<(), nwg::NwgError>;

enum MenuItem {
    Item(&'static str, nwg::MenuItem),
    Separator(nwg::MenuSeparator),
}
fn push_item(
    list: &mut Vec<MenuItem>,
    menu: &nwg::Menu,
    name: &'static str,
    text: &str,
) -> BuildResult {
    let mut item: nwg::MenuItem = Default::default();
    nwg::MenuItem::builder()
        .text(text)
        .parent(menu)
        .build(&mut item)?;
    list.push(MenuItem::Item(name, item));
    Ok(())
}
fn push_separator(list: &mut Vec<MenuItem>, menu: &nwg::Menu) -> BuildResult {
    let mut sep: nwg::MenuSeparator = Default::default();
    nwg::MenuSeparator::builder().parent(menu).build(&mut sep)?;
    list.push(MenuItem::Separator(sep));
    Ok(())
}

pub struct SystemTray {
    window: nwg::MessageWindow,
    pub notice: nwg::Notice,
    icon: nwg::Icon,
    tray: nwg::TrayNotification,
    tray_menu: nwg::Menu,
    pub picker_file: nwg::FileDialog,
    pub picker_directory: nwg::FileDialog,

    item_list: Box<[MenuItem]>,

    pub handle: Handle,
    on_notice: Box<dyn Fn()>,
    name: Weak<String>,
    icon_path: Weak<String>,
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
    pub fn new(
        handle: Handle,
        name: Weak<String>,
        icon: Weak<String>,
        on_notice: Box<dyn Fn()>,
    ) -> SystemTray {
        SystemTray {
            window: Default::default(),
            notice: Default::default(),
            icon: Default::default(),
            tray: Default::default(),
            tray_menu: Default::default(),
            picker_file: Default::default(),
            picker_directory: Default::default(),

            item_list: Default::default(),

            handle: handle,
            on_notice: on_notice,
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
        self.find("show").map(|item| item.set_enabled(!show));
        self.find("hide").map(|item| item.set_enabled(show));
    }
    fn show_menu(&self) {
        let (x, y) = nwg::GlobalCursor::position();
        self.tray_menu.popup(x, y);
    }
    fn click(&self) {
        SystemTray::dispatch(self, "@click");
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
    fn find(&self, name: &str) -> Option<&nwg::MenuItem> {
        self.item_list.iter().find_map(|item| {
            if let MenuItem::Item(target_name, item) = item {
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
                MenuItem::Item(target_name, item) => {
                    if handle == item {
                        return Some((*target_name, item));
                    }
                }
                MenuItem::Separator(item) => {
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
                () if handle == &self.tray => Self::click(self),
                () => (),
            },
            E::OnContextMenu => match () {
                () if handle == &self.tray => Self::show_menu(self),
                () => (),
            },
            E::OnMenuItemSelected => {
                let item = self.find_handle(handle);
                let (name, _) = match item {
                    Some(item) => item,
                    _ => return,
                };
                if name.starts_with("pick_") {
                    match name {
                        "pick_file" => Self::pick(self, false),
                        "pick_directory" => Self::pick(self, true),
                        _ => (),
                    }
                } else {
                    SystemTray::dispatch(self, format!("@{}", name));
                }
            }
            E::OnNotice => match () {
                () if handle == &self.notice => (self.on_notice)(),
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

        let menu = &data.tray_menu;
        let mut list_owned = Vec::new();
        let list = &mut list_owned;
        push_item(list, menu, "open", "打开WebUI")?;
        push_item(list, menu, "pick_file", "打开文件")?;
        push_item(list, menu, "pick_directory", "打开目录")?;
        push_separator(list, menu)?;
        push_item(list, menu, "show", "显示控制台")?;
        push_item(list, menu, "hide", "隐藏控制台")?;
        push_separator(list, menu)?;
        push_item(list, menu, "exit", "退出")?;
        data.item_list = list_owned.into_boxed_slice();

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
