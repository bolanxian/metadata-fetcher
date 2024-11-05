use std::cell::RefCell;
use std::ops::Deref;
use std::rc::Rc;

fn item(item: &mut nwg::MenuItem, menu: &nwg::Menu, text: &str) -> Result<(), nwg::NwgError> {
    nwg::MenuItem::builder().text(text).parent(menu).build(item)
}
fn separator(sep: &mut nwg::MenuSeparator, menu: &nwg::Menu) -> Result<(), nwg::NwgError> {
    nwg::MenuSeparator::builder().parent(menu).build(sep)
}

pub struct SystemTray {
    pub window: nwg::MessageWindow,
    pub icon: nwg::Icon,
    pub tray: nwg::TrayNotification,
    pub tray_menu: nwg::Menu,

    pub item_open: nwg::MenuItem,
    pub item_sep1: nwg::MenuSeparator,
    pub item_show: nwg::MenuItem,
    pub item_hide: nwg::MenuItem,
    pub item_sep2: nwg::MenuSeparator,
    pub item_exit: nwg::MenuItem,

    pub func: extern "C" fn(i32),
    pub name: String,
    pub path: String,
}

impl SystemTray {
    pub fn new(func: extern "C" fn(i32), name: String, path: String) -> SystemTray {
        SystemTray {
            window: Default::default(),
            icon: Default::default(),
            tray: Default::default(),
            tray_menu: Default::default(),
            item_open: Default::default(),
            item_sep1: Default::default(),
            item_show: Default::default(),
            item_hide: Default::default(),
            item_sep2: Default::default(),
            item_exit: Default::default(),
            func: func,
            name: name,
            path: path,
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
        (self.func)(1);
    }
    fn open(&self) {
        (self.func)(1);
    }
    fn show(&self) {
        (self.func)(2);
    }
    fn hide(&self) {
        (self.func)(3);
    }
    fn exit(&self) {
        (self.func)(16);
    }
}

pub struct SystemTrayUi {
    inner: Rc<SystemTray>,
    default_handler: RefCell<Vec<nwg::EventHandler>>,
}

impl nwg::NativeUi<SystemTrayUi> for SystemTray {
    fn build_ui(mut data: SystemTray) -> Result<SystemTrayUi, nwg::NwgError> {
        use nwg::Event as E;

        nwg::Icon::builder()
            .source_file(Some(&data.path))
            .build(&mut data.icon)?;

        nwg::MessageWindow::builder().build(&mut data.window)?;

        nwg::TrayNotification::builder()
            .parent(&data.window)
            .icon(Some(&data.icon))
            .tip(Some(&data.name))
            .build(&mut data.tray)?;

        nwg::Menu::builder()
            .popup(true)
            .parent(&data.window)
            .build(&mut data.tray_menu)?;

        item(&mut data.item_open, &data.tray_menu, "打开")?;
        separator(&mut data.item_sep1, &data.tray_menu)?;
        item(&mut data.item_show, &data.tray_menu, "显示控制台")?;
        item(&mut data.item_hide, &data.tray_menu, "隐藏控制台")?;
        separator(&mut data.item_sep2, &data.tray_menu)?;
        item(&mut data.item_exit, &data.tray_menu, "退出")?;

        let ui = SystemTrayUi {
            inner: Rc::new(data),
            default_handler: Default::default(),
        };

        let evt_ui = Rc::downgrade(&ui.inner);
        let handle_events = move |evt, _evt_data, handle| {
            if let Some(evt_ui) = evt_ui.upgrade() {
                match evt {
                    E::OnMousePress(e) => {
                        if nwg::MousePressEvent::MousePressLeftUp == e {
                            if &handle == &evt_ui.tray {
                                SystemTray::click(&evt_ui);
                            }
                        }
                    }
                    E::OnContextMenu => {
                        if &handle == &evt_ui.tray {
                            SystemTray::show_menu(&evt_ui);
                        }
                    }
                    E::OnMenuItemSelected => {
                        if &handle == &evt_ui.item_open {
                            SystemTray::open(&evt_ui);
                        } else if &handle == &evt_ui.item_show {
                            SystemTray::show(&evt_ui);
                        } else if &handle == &evt_ui.item_hide {
                            SystemTray::hide(&evt_ui);
                        } else if &handle == &evt_ui.item_exit {
                            SystemTray::exit(&evt_ui);
                        }
                    }
                    _ => {}
                }
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
