#[macro_use]
extern crate mashup;
use json::{object, JsonValue};
use std::collections::BTreeMap as Map;
use std::io;
use std::ops::Deref;
use windows_sys::core::{GUID, PWSTR};
use windows_sys::Win32::System::Com;
use windows_sys::Win32::UI::Shell;
use winreg::{enums as e, RegKey};

static HKCU: RegKey = RegKey::predef(e::HKEY_CURRENT_USER);
static HKCR: RegKey = RegKey::predef(e::HKEY_CLASSES_ROOT);
static HKLM: RegKey = RegKey::predef(e::HKEY_LOCAL_MACHINE);

pub fn get_default_webbrowser_id() -> io::Result<String> {
    let path = r"SOFTWARE\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice";
    HKCU.open_subkey(path)?.get_value("ProgId")
}
pub fn get_webbrowser_command(prog_id: &str) -> io::Result<String> {
    HKCR.open_subkey(prog_id)?
        .open_subkey(r"shell\open\command")?
        .get_value("")
}
pub fn get_default_webbrowser_command() -> io::Result<String> {
    let prog_id = get_default_webbrowser_id()?;
    get_webbrowser_command(&prog_id)
}

pub struct BrowserInfo {
    pub name: String,
    pub command: String,
}
impl From<BrowserInfo> for JsonValue {
    fn from(info: BrowserInfo) -> JsonValue {
        let args = shell_words::split(&info.command).ok();
        object! {
            name: info.name,
            command: info.command,
            args: args,
        }
    }
}

// 枚举安装的浏览器(https://www.cnblogs.com/talenth/p/14049927.html)
pub fn collect_webbrowser() -> Map<String, String> {
    let path = (
        r"SOFTWARE\Wow6432Node\Clients\StartMenuInternet",
        r"SOFTWARE\Clients\StartMenuInternet",
    );
    let keys = [
        HKLM.open_subkey(path.0),
        HKLM.open_subkey(path.1),
        HKCU.open_subkey(path.0),
        HKCU.open_subkey(path.1),
    ];
    keys.iter()
        .map(Result::as_ref)
        .filter_map(Result::ok)
        .flat_map(|key: &RegKey| {
            key.enum_keys().filter_map(Result::ok).map(|name: String| {
                let key = key.open_subkey(&name)?;
                let name = key.get_value("")?;
                let path = r"Capabilities\URLAssociations";
                let id = key.open_subkey(path)?.get_value("https")?;
                io::Result::Ok((id, name))
            })
        })
        .filter_map(Result::ok)
        .collect()
}
pub fn collect_webbrowser_info() -> Map<String, BrowserInfo> {
    collect_webbrowser()
        .into_iter()
        .map(|(id, name)| {
            let command = get_webbrowser_command(&id)?;
            io::Result::Ok((id, BrowserInfo { name, command }))
        })
        .filter_map(Result::ok)
        .collect()
}

pub struct SoftwareInfo {
    pub name: String,
    pub version: String,
    pub path: String,
}
impl From<SoftwareInfo> for JsonValue {
    fn from(info: SoftwareInfo) -> JsonValue {
        object! {
            name: info.name,
            version: info.version,
            path: info.path,
        }
    }
}

pub fn get_installed_software() -> Map<String, SoftwareInfo> {
    let keys = [HKLM.open_subkey(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall")];
    keys.iter()
        .map(Result::as_ref)
        .filter_map(Result::ok)
        .flat_map(|key: &RegKey| {
            key.enum_keys().filter_map(Result::ok).map(|id: String| {
                let key = key.open_subkey(&id)?;
                let info = SoftwareInfo {
                    name: key.get_value("DisplayName")?,
                    version: key.get_value("DisplayVersion")?,
                    path: key.get_value("InstallLocation")?,
                };
                io::Result::Ok((id, info))
            })
        })
        .filter_map(Result::ok)
        .collect()
}

macro_rules! known_folder_id {
    [$($x:ident),+ $(,)?] => (
        #[allow(unused)]
        static KNOWN_FOLDER_ID_LIST: &[&'static str] = &[$(stringify!($x)),+];
        fn known_folder_id(input: &str) -> Option<&GUID> {
            Some(match input {
                $(stringify!($x) => {
                    mashup!{ m[$x] = FOLDERID_ $x; }
                    &m! { Shell::$x }
                })+
                _ => return None
            })
        }
    );
}

known_folder_id![Desktop, Documents, SendTo, StartMenu, Startup];

unsafe fn len<T: Copy + Default + std::cmp::PartialEq>(ptr: *const T) -> usize {
    if ptr.is_null() {
        return 0;
    }
    let default: T = Default::default();
    let mut i = 0usize;
    while unsafe { *ptr.add(i) } != default {
        i += 1;
    }
    i
}

fn known_folder(input: &str) -> Option<String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use std::ptr::null_mut;

    let rfid = known_folder_id(input)?;
    let path = {
        let mut path: PWSTR = null_mut();
        let hr = unsafe { Shell::SHGetKnownFolderPath(rfid, 0, null_mut(), &mut path) };
        if hr < 0 || path.is_null() {
            return None;
        }
        path
    };
    let wide = unsafe { std::slice::from_raw_parts(path, len(path)) };
    let result = OsString::from_wide(wide).into_string().ok();
    unsafe { Com::CoTaskMemFree(path as *mut _) };
    result
}

fn help_known_folder<D: std::fmt::Display>(arg0: D) -> ! {
    eprintln!("Usage:");
    eprintln!("\t$ {} <known-folder> <", &arg0);
    for item in KNOWN_FOLDER_ID_LIST {
        eprintln!("\t\t| \"{}\"", item);
    }
    eprintln!("\t>");
    std::process::exit(-1)
}

fn help<D: std::fmt::Display>(arg0: D) -> ! {
    let lnk = "{ targetPath, iconPath, savePath }";
    eprintln!("Usage:");
    eprintln!("\t$ {} <browser|software|default>", &arg0);
    eprintln!("\t$ {} <shortcut> \"{}\"", &arg0, lnk);
    eprintln!("\t$ {} <known-folder> <...>", &arg0);
    std::process::exit(-1)
}

pub fn main() -> io::Result<()> {
    let args: Box<[String]> = std::env::args().collect();
    if !(args.len() >= 2) {
        help(&args[0]);
    }
    match args[1].as_ref() {
        "browser" => {
            let browsers = collect_webbrowser_info();
            let default = get_default_webbrowser_id().ok();
            let obj = object! {
                browsers: browsers,
                defaultBrowser: default,
            };
            println!("{}", json::stringify(obj));
        }
        "software" => {
            let map = get_installed_software();
            println!("{}", json::stringify(map));
        }
        "default" => {
            let command = get_default_webbrowser_command().ok();
            let args = command
                .as_deref()
                .map(shell_words::split)
                .map(Result::ok)
                .flatten();
            let obj = object! { command: command, args: args };
            println!("{}", json::stringify(obj));
        }
        "shortcut" => {
            let Some(arg2) = args.get(2) else {
                help(&args[0]);
            };
            let mut data = json::parse(arg2).map_err(io::Error::other)?;
            let icon_path = data["iconPath"].take_string();
            let Some((target_path, save_path)) =
                Option::zip(data["targetPath"].as_str(), data["savePath"].as_str())
            else {
                help(&args[0]);
            };

            let mut shortcut = mslnk::ShellLink::new(target_path).map_err(io::Error::other)?;
            shortcut.set_icon_location(icon_path);
            shortcut.create_lnk(save_path).map_err(io::Error::other)?;
        }
        "known-folder" => {
            let Some(path) = args
                .get(2)
                .as_ref()
                .map(Deref::deref)
                .map(Deref::deref)
                .map(known_folder)
                .flatten()
            else {
                help_known_folder(&args[0]);
            };
            println!("{}", path);
        }
        arg1 => {
            eprintln!("Unknown command: {}", arg1);
            help(&args[0]);
        }
    }
    Ok(())
}
