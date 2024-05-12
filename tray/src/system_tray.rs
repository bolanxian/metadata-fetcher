extern crate nwg;

pub struct SystemTray {
    pub window: nwg::MessageWindow,
    pub icon: nwg::Icon,
    pub tray: nwg::TrayNotification,
    pub tray_menu: nwg::Menu,
    pub item_show: nwg::MenuItem,
    pub item_hide: nwg::MenuItem,
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
            item_show: Default::default(),
            item_hide: Default::default(),
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

    fn show_menu(&self) {
        let (x, y) = nwg::GlobalCursor::position();
        self.tray_menu.popup(x, y);
    }
    fn click(&self) {
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

pub mod system_tray_ui {
    use super::*;
    use std::cell::RefCell;
    use std::ops::Deref;
    use std::rc::Rc;

    pub struct SystemTrayUi {
        inner: Rc<SystemTray>,
        default_handler: RefCell<Vec<nwg::EventHandler>>,
    }

    impl nwg::NativeUi<SystemTrayUi> for SystemTray {
        fn build_ui(mut data: SystemTray) -> Result<SystemTrayUi, nwg::NwgError> {
            use nwg::Event as E;

            // Resources
            nwg::Icon::builder()
                .source_file(Some(&data.path))
                .build(&mut data.icon)?;

            // Controls
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

            nwg::MenuItem::builder()
                .text("显示控制台")
                .parent(&data.tray_menu)
                .build(&mut data.item_show)?;

            nwg::MenuItem::builder()
                .text("隐藏控制台")
                .parent(&data.tray_menu)
                .build(&mut data.item_hide)?;

            nwg::MenuItem::builder()
                .text("退出")
                .parent(&data.tray_menu)
                .build(&mut data.item_exit)?;

            // Wrap-up
            let ui = SystemTrayUi {
                inner: Rc::new(data),
                default_handler: Default::default(),
            };

            // Events
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
                            if &handle == &evt_ui.item_show {
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

            return Ok(ui);
        }
    }

    impl Drop for SystemTrayUi {
        /// To make sure that everything is freed without issues, the default handler must be unbound.
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
}

pub use system_tray_ui::SystemTrayUi;
