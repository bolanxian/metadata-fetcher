use std::io;
use std::io::{Read, Write};

fn convert_svg_to_png<S: AsRef<[u8]>>(input: S) -> io::Result<Box<[u8]>> {
    use resvg::tiny_skia::{Pixmap, Transform};
    use resvg::usvg::{Options, Tree};
    let tree = {
        let mut opt = Options::default();
        opt.fontdb_mut().load_system_fonts();
        Tree::from_data(input.as_ref(), &opt).map_err(io::Error::other)?
    };
    let size = tree.size().to_int_size();
    let mut pixmap = match Pixmap::new(size.width(), size.height()) {
        Some(pixmap) => pixmap,
        None => return Err(io::ErrorKind::InvalidInput.into()),
    };
    resvg::render(&tree, Transform::default(), &mut pixmap.as_mut());

    Ok(pixmap.encode_png()?.into_boxed_slice())
}

fn convert_png_to_ico<S: AsRef<[u8]>>(input: S) -> io::Result<Box<[u8]>> {
    let mut icon = ico::IconDir::new(ico::ResourceType::Icon);
    let image = ico::IconImage::read_png(input.as_ref())?;
    icon.add_entry(ico::IconDirEntry::encode(&image)?);

    let mut buffer = Vec::new();
    icon.write(&mut buffer)?;
    Ok(buffer.into_boxed_slice())
}

enum ConvertSvg {
    ToPng(Box<[u8]>),
    ToIco(Box<[u8]>),
}
impl ConvertSvg {
    fn new<S: AsRef<str>, R: Read>(format: S, mut input: R) -> io::Result<Self> {
        let op: fn(Box<[u8]>) -> Self = match format.as_ref() {
            "png" => Self::ToPng,
            "ico" => Self::ToIco,
            _ => return Err(io::ErrorKind::InvalidInput.into()),
        };
        let mut buffer = Vec::new();
        input.read_to_end(&mut buffer)?;
        Ok(op(buffer.into_boxed_slice()))
    }
    fn to(&self) -> io::Result<Box<[u8]>> {
        Ok(match self {
            Self::ToPng(ref data) => convert_svg_to_png(data)?,
            Self::ToIco(ref data) => convert_png_to_ico(convert_svg_to_png(data)?)?,
        })
    }
}

fn help<D: std::fmt::Display>(arg0: D) -> ! {
    eprintln!("Usage:\n\t$ cat <in-svg> | {} <png|ico> > <output>", arg0);
    std::process::exit(-1)
}

fn main() -> io::Result<()> {
    let args: Box<[String]> = std::env::args().collect();
    if args.len() != 2 {
        help(&args[0]);
    }

    let stdin = io::stdin().lock();
    let result = ConvertSvg::new(&args[1], stdin)?.to()?;

    let mut stdout = io::stdout().lock();
    stdout.write_all(&result)?;

    Ok(())
}
