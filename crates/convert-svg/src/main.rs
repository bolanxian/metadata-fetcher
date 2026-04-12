use std::io;
use std::io::{Read, Write};

fn convert_svg_to_png<S: AsRef<[u8]>>(input: S) -> io::Result<Box<[u8]>> {
    use resvg::tiny_skia::{Pixmap, Transform};
    use resvg::usvg::{Options, Tree};
    let tree = {
        let mut opt: Options = Default::default();
        opt.fontdb_mut().load_system_fonts();
        Tree::from_data(input.as_ref(), &opt).map_err(io::Error::other)?
    };
    let transform: Transform = Default::default();
    let size = tree.size().to_int_size();
    let mut pixmap = Pixmap::new(size.width(), size.height())
        .ok_or(io::ErrorKind::InvalidInput)
        .map_err(io::Error::from)?;

    resvg::render(&tree, transform, &mut pixmap.as_mut());

    Ok(pixmap.encode_png()?.into_boxed_slice())
}

fn convert_png_to_ico<S: AsRef<[u8]>>(input: S) -> io::Result<Box<[u8]>> {
    let mut icon = ico::IconDir::new(ico::ResourceType::Icon);
    icon.add_entry({
        let image = ico::IconImage::read_png(input.as_ref())?;
        ico::IconDirEntry::encode(&image)?
    });

    Ok({
        let mut buffer = Vec::new();
        icon.write(&mut buffer)?;
        buffer.into_boxed_slice()
    })
}

enum Format {
    Png,
    Ico,
}
impl TryFrom<&str> for Format {
    type Error = io::Error;
    fn try_from(format: &str) -> Result<Self, Self::Error> {
        Ok(match format {
            "png" => Self::Png,
            "ico" => Self::Ico,
            _ => return Err(io::ErrorKind::InvalidInput.into()),
        })
    }
}
impl Format {
    fn convert<R: Read>(&self, mut input: R) -> io::Result<Box<[u8]>> {
        let data = {
            let mut buffer = Vec::new();
            input.read_to_end(&mut buffer)?;
            buffer.into_boxed_slice()
        };
        Ok(match self {
            Self::Png => convert_svg_to_png(data)?,
            Self::Ico => convert_png_to_ico(convert_svg_to_png(data)?)?,
        })
    }
}

fn help<D: std::fmt::Display>(arg0: D) -> ! {
    eprintln!("Usage:\n\t$ cat <in-svg> | {} <png|ico> > <output>", arg0);
    std::process::exit(-1)
}

fn main() -> io::Result<()> {
    let args: Box<[Box<str>]> = std::env::args().map(String::into_boxed_str).collect();
    let Some(args) = args.as_array::<2>() else {
        help(&args[0]);
    };

    let stdin = io::stdin().lock();
    let mut stdout = io::stdout().lock();

    let result = Format::try_from(&*args[1])?.convert(stdin)?;
    stdout.write_all(&result)?;

    Ok(())
}
