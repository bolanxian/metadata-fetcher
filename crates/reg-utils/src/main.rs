use json;
use json::{object, JsonValue};
use shell_words;
use std::collections::BTreeMap as Map;
use std::io;
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
        let words = shell_words::split(&info.command).unwrap_or_else(|_| vec![]);
        object! {
            name: info.name,
            command: info.command,
            words: words,
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
            key.enum_keys().filter_map(Result::ok).map(|name| {
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
        .flat_map(|key| {
            key.enum_keys().filter_map(Result::ok).map(|id| {
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

pub fn main() -> Result<(), String> {
    let mut args = std::env::args().skip(1);
    let arg1 = args.next();
    match arg1.as_deref() {
        Some("browser") => {
            let map = collect_webbrowser_info();
            let default_id = get_default_webbrowser_id().ok();
            let mut json = JsonValue::from(map);
            json["$default"] = JsonValue::from(default_id);
            println!("{}", json::stringify(json));
        }
        Some("software") => {
            let map = get_installed_software();
            println!("{}", json::stringify(map));
        }
        Some("default") | None => {
            let command = get_default_webbrowser_command().ok();
            let words = match command {
                Some(ref command) => shell_words::split(command).ok(),
                None => None,
            };
            let obj = object! { command: command, words: words };
            println!("{}", json::stringify(obj));
        }
        Some(arg1) => {
            return Err(format!("unknown command: {arg1}"));
        }
    }
    Ok(())
}
